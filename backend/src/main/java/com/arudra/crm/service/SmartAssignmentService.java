package com.arudra.crm.service;

import com.arudra.crm.dto.assignment.RecommendRequest;
import com.arudra.crm.dto.workforce.AssignResourceRequest;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The Smart Employee Auto Assignment engine.
 *
 * <p>Given a task's staffing requirement (department / role / skills / headcount / estimated
 * hours) it screens every active employee against the eligibility rules, analyses each candidate's
 * live workload (from task assignments, attendance and leave), scores them 0–100 on weighted
 * suitability factors, and returns a ranked recommendation list plus the reasons and warnings the
 * PM sees on each card. It also performs the one-click assignment / replacement writes, keeps an
 * audit history, and powers the workload dashboard widgets.
 *
 * <p>Identity note: an employee's HR master record lives in {@code employees} (department, status,
 * attendance, leave, skills via its workforce header), but task assignments key off the linked
 * {@code users} row (resolved by shared email). Every candidate therefore carries both ids.
 */
@Service
public class SmartAssignmentService {

    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private AttendanceRepository attendanceRepository;
    @Autowired private LeaveRequestRepository leaveRequestRepository;
    @Autowired private PerformanceReviewRepository performanceReviewRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private AssignmentSettingsRepository settingsRepository;
    @Autowired private AssignmentHistoryRepository historyRepository;
    @Autowired private EmployeeTaskService employeeTaskService;
    @Autowired private NotificationService notificationService;

    private static final Set<String> ACTIVE_STATUSES =
            Set.of("ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED", "WAITING_MATERIAL", "REWORK");
    private static final Set<String> HIGH_PRIORITIES = Set.of("HIGH", "URGENT", "CRITICAL");

    // ============================================================ Settings

    public AssignmentSettings getSettings() {
        // The V26 migration seeds the singleton row (id = 1). Fall back to any existing row before
        // creating one, so a missing id can never spawn duplicate settings rows.
        return settingsRepository.findById(AssignmentSettings.SINGLETON_ID)
                .or(() -> settingsRepository.findAll().stream().findFirst())
                .orElseGet(() -> settingsRepository.save(new AssignmentSettings()));
    }

    @Transactional
    public AssignmentSettings updateSettings(AssignmentSettings incoming) {
        AssignmentSettings s = getSettings();
        if (incoming.getMaxTasksPerDay() != null) s.setMaxTasksPerDay(incoming.getMaxTasksPerDay());
        if (incoming.getMaxWorkingHours() != null) s.setMaxWorkingHours(incoming.getMaxWorkingHours());
        if (incoming.getMaxOvertimeHours() != null) s.setMaxOvertimeHours(incoming.getMaxOvertimeHours());
        if (incoming.getAutoBalanceEnabled() != null) s.setAutoBalanceEnabled(incoming.getAutoBalanceEnabled());
        if (incoming.getAllowOvertime() != null) s.setAllowOvertime(incoming.getAllowOvertime());
        if (incoming.getAllowLowPriorityReassign() != null) s.setAllowLowPriorityReassign(incoming.getAllowLowPriorityReassign());
        if (incoming.getMinSuitabilityScore() != null) s.setMinSuitabilityScore(incoming.getMinSuitabilityScore());
        if (incoming.getMandatorySkillMatching() != null) s.setMandatorySkillMatching(incoming.getMandatorySkillMatching());
        if (incoming.getPreferSameProjectTeam() != null) s.setPreferSameProjectTeam(incoming.getPreferSameProjectTeam());
        if (incoming.getPreferNearest() != null) s.setPreferNearest(incoming.getPreferNearest());
        if (incoming.getMinPerformanceScore() != null) s.setMinPerformanceScore(incoming.getMinPerformanceScore());
        if (incoming.getWeightAvailability() != null) s.setWeightAvailability(incoming.getWeightAvailability());
        if (incoming.getWeightWorkload() != null) s.setWeightWorkload(incoming.getWeightWorkload());
        if (incoming.getWeightSkills() != null) s.setWeightSkills(incoming.getWeightSkills());
        if (incoming.getWeightDepartment() != null) s.setWeightDepartment(incoming.getWeightDepartment());
        if (incoming.getWeightPerformance() != null) s.setWeightPerformance(incoming.getWeightPerformance());
        if (incoming.getWeightLocation() != null) s.setWeightLocation(incoming.getWeightLocation());
        if (incoming.getWeightExperience() != null) s.setWeightExperience(incoming.getWeightExperience());
        return settingsRepository.save(s);
    }

    // ============================================================ Recommendation engine

    @Transactional(readOnly = true)
    public Map<String, Object> recommend(RecommendRequest req) {
        AssignmentSettings cfg = getSettings();
        LocalDate today = LocalDate.now();
        double estHours = req.getEstimatedHours() == null ? 0 : req.getEstimatedHours();
        int requiredCount = req.getRequiredCount() == null || req.getRequiredCount() < 1 ? 1 : req.getRequiredCount();
        boolean overtimeAllowed = req.getAllowOvertime() != null ? req.getAllowOvertime() : Boolean.TRUE.equals(cfg.getAllowOvertime());
        List<String> requiredSkills = normalizeSkills(req.getRequiredSkills());
        boolean skillMandatory = Boolean.TRUE.equals(cfg.getMandatorySkillMatching()) && !requiredSkills.isEmpty();

        Project project = req.getProjectId() == null ? null : projectRepository.findById(req.getProjectId()).orElse(null);
        Set<Long> alreadyAssigned = req.getTaskId() == null ? Set.of() :
                assignmentRepository.findByTaskId(req.getTaskId()).stream()
                        .filter(a -> !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus()))
                        .filter(a -> a.getResourceId() != null)
                        .map(TaskAssignment::getResourceId)
                        .collect(Collectors.toSet());

        List<Employee> pool = req.getDepartmentId() != null
                ? employeeRepository.findByDepartmentId(req.getDepartmentId())
                : employeeRepository.findAll();

        List<Map<String, Object>> recommendations = new ArrayList<>();
        List<Map<String, Object>> excluded = new ArrayList<>();

        for (Employee emp : pool) {
            if (Boolean.TRUE.equals(emp.getIsDeleted())) continue;

            String exclusion = eligibilityFailure(emp, req, requiredSkills, skillMandatory, today);
            User user = resolveUser(emp);
            if (exclusion == null && user == null) exclusion = "No login account (cannot be assigned)";
            if (exclusion == null && alreadyAssigned.contains(user.getId())) exclusion = "Already assigned to this task";

            if (exclusion != null) {
                if (Boolean.TRUE.equals(req.getIncludeExcluded())) {
                    excluded.add(excludedCard(emp, exclusion));
                }
                continue;
            }

            Workload w = workload(emp, user, cfg, today);
            double perf = performanceRating(emp.getId());

            if (cfg.getMinPerformanceScore() != null && cfg.getMinPerformanceScore() > 0
                    && perf > 0 && perf < cfg.getMinPerformanceScore()) {
                excluded.add(excludedCard(emp, "Performance below minimum threshold (" + round1(perf) + ")"));
                continue;
            }

            // Capacity validation.
            double remaining = w.remainingHours;
            boolean fits = remaining >= estHours || estHours == 0;
            boolean overtimeNeeded = !fits;
            double overtimeShortfall = overtimeNeeded ? (estHours - remaining) : 0;
            boolean overtimeWithinCap = overtimeShortfall <= cfg.getMaxOvertimeHours().doubleValue();

            if (overtimeNeeded && !(overtimeAllowed && overtimeWithinCap)) {
                excluded.add(excludedCard(emp, "Insufficient Capacity (" + round1(remaining) + "h left, needs "
                        + round1(estHours) + "h)"));
                continue;
            }

            double score = score(emp, user, w, perf, req, requiredSkills, project, cfg);
            if (cfg.getMinSuitabilityScore() != null && score < cfg.getMinSuitabilityScore()) {
                excluded.add(excludedCard(emp, "Below minimum suitability score (" + round1(score) + ")"));
                continue;
            }

            Map<String, Object> card = candidateCard(emp, user, w, perf, score, project);
            card.put("reasons", buildReasons(emp, w, perf, requiredSkills, req, project, cfg));
            card.put("warnings", buildWarnings(emp, w, perf, estHours, overtimeNeeded, overtimeShortfall, requiredSkills, req, cfg, today));
            card.put("overtimeRequired", overtimeNeeded);
            recommendations.add(card);
        }

        recommendations.sort((a, b) -> Double.compare(num(b.get("suitabilityScore")), num(a.get("suitabilityScore"))));

        int availableCount = recommendations.size();
        List<Map<String, Object>> top = recommendations.stream().limit(requiredCount).collect(Collectors.toList());
        for (Map<String, Object> c : top) c.put("recommended", true);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requiredCount", requiredCount);
        result.put("availableCount", availableCount);
        result.put("recommendations", recommendations);
        result.put("topPicks", top);
        result.put("excluded", excluded);
        if (availableCount < requiredCount) {
            result.put("warning", "Only " + availableCount + " of " + requiredCount + " required employees are available.");
        }
        result.put("settings", settingsView(cfg));
        return result;
    }

    // ------------------------------------------------------ eligibility

    /** @return exclusion reason, or null when the employee passes every hard eligibility rule. */
    private String eligibilityFailure(Employee emp, RecommendRequest req, List<String> requiredSkills,
                                      boolean skillMandatory, LocalDate today) {
        String status = emp.getStatus() == null ? "" : emp.getStatus().toUpperCase();
        if (!"ACTIVE".equals(status)) {
            return "Not active (status: " + (emp.getStatus() == null ? "unknown" : emp.getStatus()) + ")";
        }
        if (req.getDepartmentId() != null &&
                (emp.getDepartment() == null || !req.getDepartmentId().equals(emp.getDepartment().getId()))) {
            return "Different department";
        }
        if (req.getRequiredRole() != null && !req.getRequiredRole().isBlank()) {
            String need = req.getRequiredRole().trim().toLowerCase();
            String have = emp.getDesignation() == null ? "" : emp.getDesignation().toLowerCase();
            if (!have.contains(need)) return "Role mismatch (needs " + req.getRequiredRole() + ")";
        }
        if (onLeaveOn(emp.getId(), today)) return "On leave today";
        Attendance att = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(emp.getId(), today).orElse(null);
        if (att != null && ("ABSENT".equalsIgnoreCase(att.getStatus()) || "LEAVE".equalsIgnoreCase(att.getStatus()))) {
            return "Marked " + att.getStatus().toLowerCase() + " today";
        }
        if (skillMandatory) {
            Set<String> have = employeeSkills(emp);
            List<String> missing = requiredSkills.stream().filter(s -> !have.contains(s)).collect(Collectors.toList());
            if (!missing.isEmpty()) return "Missing required skill(s): " + String.join(", ", missing);
        }
        return null;
    }

    private boolean onLeaveOn(Long employeeId, LocalDate date) {
        return leaveRequestRepository.findByEmployeeIdAndStatus(employeeId, "APPROVED").stream()
                .anyMatch(l -> !date.isBefore(l.getStartDate()) && !date.isAfter(l.getEndDate()));
    }

    private boolean leaveStartsTomorrow(Long employeeId, LocalDate today) {
        LocalDate tomorrow = today.plusDays(1);
        return leaveRequestRepository.findByEmployeeIdAndStatus(employeeId, "APPROVED").stream()
                .anyMatch(l -> tomorrow.equals(l.getStartDate()));
    }

    // ------------------------------------------------------ workload

    private static class Workload {
        int tasksToday;
        double assignedHoursToday;
        double actualHoursToday;
        double remainingHours;
        double overtimeThisWeek;
        int pendingTasks;
        int highPriorityTasks;
        int avgProjectCompletion;
        Set<Long> projectIds = new HashSet<>();
    }

    private Workload workload(Employee emp, User user, AssignmentSettings cfg, LocalDate today) {
        Workload w = new Workload();
        double maxHours = cfg.getMaxWorkingHours().doubleValue();

        List<TaskAssignment> active = assignmentRepository
                .findByResourceTypeAndResourceId(ResourceType.EMPLOYEE, user.getId()).stream()
                .filter(a -> ACTIVE_STATUSES.contains(a.getStatus()))
                .collect(Collectors.toList());

        List<Integer> completions = new ArrayList<>();
        for (TaskAssignment a : active) {
            Task t = a.getTask();
            if (t == null) continue;
            w.pendingTasks++;
            if (t.getPriority() != null && HIGH_PRIORITIES.contains(t.getPriority().toUpperCase())) w.highPriorityTasks++;
            if (isScheduledFor(t, today)) {
                w.tasksToday++;
                w.assignedHoursToday += t.getEstimatedHours() == null ? 0 : t.getEstimatedHours();
            }
            if (t.getProject() != null) {
                w.projectIds.add(t.getProject().getId());
                completions.add(t.getProject().getProgress() == null ? 0 : t.getProject().getProgress());
            }
        }

        Attendance att = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(emp.getId(), today).orElse(null);
        if (att != null && att.getWorkedHours() != null) w.actualHoursToday = att.getWorkedHours().doubleValue();

        w.remainingHours = Math.max(0, maxHours - w.assignedHoursToday);
        w.overtimeThisWeek = overtimeThisWeek(emp.getId(), today);
        w.avgProjectCompletion = completions.isEmpty() ? 0 :
                (int) Math.round(completions.stream().mapToInt(Integer::intValue).average().orElse(0));
        return w;
    }

    private boolean isScheduledFor(Task t, LocalDate today) {
        LocalDate start = t.getStartDate();
        LocalDate due = t.getDueDate();
        if (start == null && due == null) return true; // undated active work counts against today
        if (due != null && due.equals(today)) return true;
        if (start != null && start.equals(today)) return true;
        if (start != null && due != null) return !today.isBefore(start) && !today.isAfter(due);
        if (due != null) return !today.isAfter(due);
        return !today.isBefore(start);
    }

    private double overtimeThisWeek(Long employeeId, LocalDate today) {
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        return attendanceRepository.findByEmployeeIdAndDateBetween(employeeId, weekStart, today).stream()
                .map(Attendance::getOvertimeHours)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .sum();
    }

    // ------------------------------------------------------ scoring

    private double score(Employee emp, User user, Workload w, double perf, RecommendRequest req,
                         List<String> requiredSkills, Project project, AssignmentSettings cfg) {
        double maxHours = cfg.getMaxWorkingHours().doubleValue();

        double availability = clamp01(w.remainingHours / maxHours);
        double workloadFactor = 0.7 * (1 - clamp01(w.assignedHoursToday / maxHours))
                + 0.3 * (1 - clamp01((double) w.tasksToday / Math.max(1, cfg.getMaxTasksPerDay())));
        double skills = skillScore(emp, requiredSkills);
        double department = req.getDepartmentId() == null ? 0.7 : 1.0; // filtered pool ⇒ match guaranteed
        double performance = perf > 0 ? perf / 100.0 : 0.7;
        double location = locationScore(emp, project, cfg);
        double experience = experienceScore(emp, user, req, requiredSkills, project, cfg);

        double[] weights = {
                nz(cfg.getWeightAvailability()), nz(cfg.getWeightWorkload()), nz(cfg.getWeightSkills()),
                nz(cfg.getWeightDepartment()), nz(cfg.getWeightPerformance()), nz(cfg.getWeightLocation()),
                nz(cfg.getWeightExperience())
        };
        double[] scores = {availability, workloadFactor, skills, department, performance, location, experience};
        double weightSum = Arrays.stream(weights).sum();
        if (weightSum <= 0) weightSum = 1;
        double total = 0;
        for (int i = 0; i < weights.length; i++) total += weights[i] * scores[i];
        return round1(clamp01(total / weightSum) * 100.0);
    }

    private double skillScore(Employee emp, List<String> requiredSkills) {
        if (requiredSkills.isEmpty()) return 1.0;
        Set<String> have = employeeSkills(emp);
        long matched = requiredSkills.stream().filter(have::contains).count();
        return (double) matched / requiredSkills.size();
    }

    private double locationScore(Employee emp, Project project, AssignmentSettings cfg) {
        if (project == null || project.getPropertyAddress() == null) return 0.7;
        String city = emp.getWorkforce() != null ? emp.getWorkforce().getCity() : null;
        if (city == null || city.isBlank()) return 0.6;
        return project.getPropertyAddress().toLowerCase().contains(city.toLowerCase()) ? 1.0 : 0.5;
    }

    private double experienceScore(Employee emp, User user, RecommendRequest req, List<String> requiredSkills,
                                   Project project, AssignmentSettings cfg) {
        List<TaskAssignment> all = assignmentRepository.findByResourceTypeAndResourceId(ResourceType.EMPLOYEE, user.getId());
        long completed = all.stream().filter(a -> "COMPLETED".equalsIgnoreCase(a.getStatus())).count();
        double base = clamp01(completed / 5.0);
        boolean sameProject = project != null && all.stream()
                .anyMatch(a -> a.getTask() != null && a.getTask().getProject() != null
                        && project.getId().equals(a.getTask().getProject().getId()));
        if (sameProject && Boolean.TRUE.equals(cfg.getPreferSameProjectTeam())) {
            base = clamp01(base + 0.3);
        }
        return base;
    }

    // ------------------------------------------------------ reasons & warnings

    private List<String> buildReasons(Employee emp, Workload w, double perf, List<String> requiredSkills,
                                      RecommendRequest req, Project project, AssignmentSettings cfg) {
        List<String> r = new ArrayList<>();
        r.add("✓ Available today");
        if (w.assignedHoursToday <= 2) r.add("✓ Only " + round1(w.assignedHoursToday) + " hours assigned");
        else if (w.remainingHours >= (req.getEstimatedHours() == null ? 0 : req.getEstimatedHours()))
            r.add("✓ Has spare capacity (" + round1(w.remainingHours) + "h free)");
        if (!requiredSkills.isEmpty() && skillScore(emp, requiredSkills) >= 1.0) r.add("✓ Required skills match");
        if (req.getDepartmentId() != null) r.add("✓ Same department");
        if (perf >= 80) r.add("✓ High performance (" + round1(perf) + ")");
        if (w.tasksToday == 0) r.add("✓ No tasks assigned today");
        if (project != null && w.projectIds.contains(project.getId()) && Boolean.TRUE.equals(cfg.getPreferSameProjectTeam()))
            r.add("✓ Already on this project team");
        return r;
    }

    private List<String> buildWarnings(Employee emp, Workload w, double perf, double estHours, boolean overtimeNeeded,
                                       double overtimeShortfall, List<String> requiredSkills, RecommendRequest req,
                                       AssignmentSettings cfg, LocalDate today) {
        List<String> warn = new ArrayList<>();
        if (overtimeNeeded) warn.add("Overtime required (" + round1(overtimeShortfall) + "h beyond capacity)");
        if (w.assignedHoursToday >= cfg.getMaxWorkingHours().doubleValue()) warn.add("Working hour limit reached");
        if (w.tasksToday >= cfg.getMaxTasksPerDay()) warn.add("Daily task limit reached (" + w.tasksToday + ")");
        if (w.pendingTasks > 0) warn.add("Already on " + w.pendingTasks + " active task(s)");
        if (leaveStartsTomorrow(emp.getId(), today)) warn.add("Leave starts tomorrow");
        if (perf > 0 && cfg.getMinPerformanceScore() != null && cfg.getMinPerformanceScore() > 0
                && perf < cfg.getMinPerformanceScore()) warn.add("Performance below preferred threshold");
        if (w.overtimeThisWeek > 0) warn.add("Already " + round1(w.overtimeThisWeek) + "h overtime this week");
        return warn;
    }

    // ============================================================ Assignment / replacement

    /**
     * One-click assign the given resources to a task, record history, and return the recommendation
     * refresh. {@code method} is MANUAL / AUTO / REPLACEMENT.
     */
    @Transactional
    public Map<String, Object> assign(Long taskId, List<Map<String, Object>> selections, String method, User me) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new RuntimeException("Task not found"));
        String m = method == null ? AssignmentHistory.METHOD_MANUAL : method.toUpperCase();

        List<AssignResourceRequest> requests = new ArrayList<>();
        for (Map<String, Object> sel : selections) {
            String type = ResourceType.normalize(str(sel.getOrDefault("resourceType", ResourceType.EMPLOYEE)));
            Long rid = asLong(sel.get("resourceId"));
            String role = str(sel.get("role"));
            if (rid == null) continue;
            requests.add(new AssignResourceRequest(type, rid, role));
        }
        employeeTaskService.assignResources(taskId, requests, me);

        for (Map<String, Object> sel : selections) {
            String type = ResourceType.normalize(str(sel.getOrDefault("resourceType", ResourceType.EMPLOYEE)));
            Long rid = asLong(sel.get("resourceId"));
            if (rid == null) continue;
            Double sc = sel.get("suitabilityScore") == null ? null : num(sel.get("suitabilityScore"));
            String reason = str(sel.get("reason"));
            writeHistory(task, type, rid, me, m, sc, reason, null, null);
        }
        return Map.of("assigned", requests.size(), "taskId", taskId, "method", m);
    }

    /** Candidates for replacing a resource on a task — the recommend engine minus the current holder. */
    @Transactional(readOnly = true)
    public Map<String, Object> suggestReplacement(Long taskId, String resourceType, Long resourceId, String reason) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new RuntimeException("Task not found"));
        RecommendRequest req = new RecommendRequest();
        req.setTaskId(taskId);
        req.setProjectId(task.getProject() != null ? task.getProject().getId() : null);
        req.setEstimatedHours(task.getEstimatedHours());
        req.setRequiredSkills(splitSkills(task.getRequiredSkills()));
        req.setRequiredCount(1);
        req.setIncludeExcluded(false);
        Map<String, Object> res = new LinkedHashMap<>(recommend(req));
        res.put("replacing", Map.of(
                "resourceType", ResourceType.normalize(resourceType),
                "resourceId", resourceId,
                "reason", reason == null ? "" : reason));
        return res;
    }

    /**
     * Auto-replacement: unassign the outgoing resource, assign the incoming one, chain the history
     * rows, and notify the project manager. Returns a small summary.
     */
    @Transactional
    public Map<String, Object> replace(Long taskId, String oldType, Long oldId,
                                       Map<String, Object> replacement, String reason, User me) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new RuntimeException("Task not found"));
        String outType = ResourceType.normalize(oldType);

        // Close the outgoing assignment + its active history row.
        employeeTaskService.removeResourceAssignment(taskId, outType, oldId);
        AssignmentHistory oldHistory = historyRepository
                .findByTaskIdAndResourceTypeAndResourceIdAndStatus(taskId, outType, oldId, AssignmentHistory.STATUS_ACTIVE)
                .stream().findFirst().orElse(null);
        if (oldHistory != null) {
            oldHistory.setStatus(AssignmentHistory.STATUS_REPLACED);
            oldHistory.setReassignmentReason(reason);
            historyRepository.save(oldHistory);
        }

        // Assign the incoming resource.
        String newType = ResourceType.normalize(str(replacement.getOrDefault("resourceType", ResourceType.EMPLOYEE)));
        Long newId = asLong(replacement.get("resourceId"));
        String role = str(replacement.get("role"));
        if (newId == null) throw new RuntimeException("Replacement resourceId is required");
        employeeTaskService.assignResources(taskId, List.of(new AssignResourceRequest(newType, newId, role)), me);
        Double sc = replacement.get("suitabilityScore") == null ? null : num(replacement.get("suitabilityScore"));
        AssignmentHistory added = writeHistory(task, newType, newId, me, AssignmentHistory.METHOD_REPLACEMENT,
                sc, str(replacement.get("reason")), reason, oldHistory != null ? oldHistory.getId() : null);

        // Notify the PM of the change.
        if (task.getProject() != null && task.getProject().getProjectManager() != null) {
            notificationService.dispatch("Task Reassigned",
                    added.getEmployeeName() + " now covers \"" + task.getTaskName() + "\" (reason: "
                            + (reason == null ? "unavailable" : reason) + ")",
                    "TASK", task.getProject().getProjectManager().getId(),
                    "/projects/" + task.getProject().getId());
        }
        return Map.of("taskId", taskId, "newResourceId", newId, "replacedHistoryId",
                oldHistory != null ? oldHistory.getId() : -1);
    }

    private AssignmentHistory writeHistory(Task task, String type, Long rid, User me, String method,
                                           Double score, String reason, String reassignmentReason, Long replacedId) {
        AssignmentHistory h = new AssignmentHistory();
        h.setTaskId(task.getId());
        h.setTaskName(task.getTaskName());
        if (task.getProject() != null) {
            h.setProjectId(task.getProject().getId());
            h.setProjectName(task.getProject().getProjectName());
        }
        h.setResourceType(type);
        h.setResourceId(rid);
        if (ResourceType.EMPLOYEE.equals(type)) {
            User u = userRepository.findById(rid).orElse(null);
            if (u != null) {
                h.setEmployeeName(u.getName());
                employeeRepository.findByEmailIgnoreCaseAndIsDeletedFalse(u.getEmail())
                        .ifPresent(e -> h.setEmployeeId(e.getId()));
            }
        } else {
            h.setEmployeeName(type + " #" + rid);
        }
        if (me != null) {
            h.setAssignedById(me.getId());
            h.setAssignedByName(me.getName());
        }
        h.setAssignmentMethod(method);
        if (score != null) h.setSuitabilityScore(BigDecimal.valueOf(score).setScale(2, RoundingMode.HALF_UP));
        h.setReason(reason);
        h.setReassignmentReason(reassignmentReason);
        h.setReplacedHistoryId(replacedId);
        h.setStatus(AssignmentHistory.STATUS_ACTIVE);
        return historyRepository.save(h);
    }

    // ============================================================ History

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getHistory(Long taskId) {
        List<AssignmentHistory> rows = taskId != null
                ? historyRepository.findByTaskIdOrderByCreatedAtDesc(taskId)
                : historyRepository.findAllByOrderByCreatedAtDesc();
        return rows.stream().map(this::historyView).collect(Collectors.toList());
    }

    private Map<String, Object> historyView(AssignmentHistory h) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", h.getId());
        m.put("taskId", h.getTaskId());
        m.put("taskName", h.getTaskName());
        m.put("projectId", h.getProjectId());
        m.put("projectName", h.getProjectName());
        m.put("resourceType", h.getResourceType());
        m.put("resourceId", h.getResourceId());
        m.put("employeeId", h.getEmployeeId());
        m.put("employeeName", h.getEmployeeName());
        m.put("assignedByName", h.getAssignedByName());
        m.put("assignmentMethod", h.getAssignmentMethod());
        m.put("suitabilityScore", h.getSuitabilityScore());
        m.put("reason", h.getReason());
        m.put("reassignmentReason", h.getReassignmentReason());
        m.put("status", h.getStatus());
        m.put("createdAt", h.getCreatedAt());
        return m;
    }

    // ============================================================ Dashboard widgets

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        AssignmentSettings cfg = getSettings();
        LocalDate today = LocalDate.now();
        List<Employee> employees = employeeRepository.findAll().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .collect(Collectors.toList());

        int availableToday = 0, onLeave = 0, workingNow = 0, freeEmployees = 0, inOvertime = 0;
        String highestName = null, lowestName = null;
        double highest = -1, lowest = Double.MAX_VALUE;

        for (Employee emp : employees) {
            boolean active = "ACTIVE".equalsIgnoreCase(emp.getStatus());
            boolean leaveToday = onLeaveOn(emp.getId(), today) || "ON_LEAVE".equalsIgnoreCase(emp.getStatus());
            Attendance att = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(emp.getId(), today).orElse(null);
            boolean absentToday = att != null && ("ABSENT".equalsIgnoreCase(att.getStatus()) || "LEAVE".equalsIgnoreCase(att.getStatus()));
            if (leaveToday || (att != null && "LEAVE".equalsIgnoreCase(att.getStatus()))) onLeave++;
            if (att != null && att.getCheckInTime() != null && att.getCheckOutTime() == null) workingNow++;
            if (overtimeThisWeek(emp.getId(), today) > 0) inOvertime++;

            if (!active || leaveToday || absentToday) continue;
            availableToday++;

            User user = resolveUser(emp);
            if (user == null) continue;
            Workload w = workload(emp, user, cfg, today);
            if (w.tasksToday == 0) freeEmployees++;
            String name = emp.getFirstName() + " " + emp.getLastName();
            if (w.assignedHoursToday > highest) { highest = w.assignedHoursToday; highestName = name; }
            if (w.assignedHoursToday < lowest) { lowest = w.assignedHoursToday; lowestName = name; }
        }

        long pendingTasks = taskRepository.findAll().stream()
                .filter(t -> !"COMPLETED".equalsIgnoreCase(t.getStatus()) && !"CANCELLED".equalsIgnoreCase(t.getStatus()))
                .filter(t -> assignmentRepository.findByTaskId(t.getId()).stream()
                        .noneMatch(a -> !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus())))
                .count();
        long aiRecommended = historyRepository.findAll().stream()
                .filter(h -> AssignmentHistory.METHOD_AUTO.equals(h.getAssignmentMethod())
                        || AssignmentHistory.METHOD_REPLACEMENT.equals(h.getAssignmentMethod()))
                .count();

        Map<String, Object> d = new LinkedHashMap<>();
        d.put("availableToday", availableToday);
        d.put("onLeave", onLeave);
        d.put("workingNow", workingNow);
        d.put("freeEmployees", freeEmployees);
        d.put("highestWorkload", highest < 0 ? null : Map.of("name", highestName, "hours", round1(highest)));
        d.put("lowestWorkload", lowest == Double.MAX_VALUE ? null : Map.of("name", lowestName, "hours", round1(lowest)));
        d.put("inOvertime", inOvertime);
        d.put("pendingAssignments", pendingTasks);
        d.put("aiRecommendedAssignments", aiRecommended);
        d.put("totalEmployees", employees.size());
        return d;
    }

    // ============================================================ Cards & helpers

    private Map<String, Object> candidateCard(Employee emp, User user, Workload w, double perf, double score, Project project) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("employeeId", emp.getId());
        m.put("userId", user.getId());
        m.put("resourceType", ResourceType.EMPLOYEE);
        m.put("resourceId", user.getId());
        m.put("employeeCode", emp.getEmployeeCode());
        m.put("name", emp.getFirstName() + " " + emp.getLastName());
        m.put("photoUrl", emp.getProfilePhotoUrl() != null ? emp.getProfilePhotoUrl()
                : (emp.getWorkforce() != null ? emp.getWorkforce().getProfilePhotoUrl() : null));
        m.put("department", emp.getDepartment() != null ? emp.getDepartment().getName() : null);
        m.put("designation", emp.getDesignation());
        m.put("skills", new ArrayList<>(employeeSkills(emp)));
        m.put("tasksToday", w.tasksToday);
        m.put("assignedHours", round1(w.assignedHoursToday));
        m.put("actualHoursToday", round1(w.actualHoursToday));
        m.put("remainingHours", round1(w.remainingHours));
        m.put("pendingTasks", w.pendingTasks);
        m.put("highPriorityTasks", w.highPriorityTasks);
        m.put("overtimeThisWeek", round1(w.overtimeThisWeek));
        m.put("currentProjectCompletion", w.avgProjectCompletion);
        m.put("performanceRating", perf > 0 ? round1(perf) : null);
        m.put("starRating", perf > 0 ? Math.round(perf / 20.0) : null); // 0–5 stars
        m.put("distanceToProject", null); // reserved: no geo-coords on projects yet
        m.put("suitabilityScore", score);
        return m;
    }

    private Map<String, Object> excludedCard(Employee emp, String reason) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("employeeId", emp.getId());
        m.put("name", emp.getFirstName() + " " + emp.getLastName());
        m.put("department", emp.getDepartment() != null ? emp.getDepartment().getName() : null);
        m.put("designation", emp.getDesignation());
        m.put("reason", reason);
        return m;
    }

    private Map<String, Object> settingsView(AssignmentSettings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("minSuitabilityScore", s.getMinSuitabilityScore());
        m.put("allowOvertime", s.getAllowOvertime());
        m.put("mandatorySkillMatching", s.getMandatorySkillMatching());
        m.put("maxWorkingHours", s.getMaxWorkingHours());
        m.put("maxTasksPerDay", s.getMaxTasksPerDay());
        return m;
    }

    private User resolveUser(Employee emp) {
        if (emp.getEmail() == null) return null;
        return userRepository.findByEmail(emp.getEmail()).orElse(null);
    }

    private double performanceRating(Long employeeId) {
        List<PerformanceReview> reviews = performanceReviewRepository.findByEmployeeIdOrderByReviewDateDesc(employeeId);
        OptionalDouble avg = reviews.stream()
                .filter(r -> r.getRating() != null)
                .mapToInt(PerformanceReview::getRating)
                .average();
        return avg.isPresent() ? avg.getAsDouble() * 20.0 : 0; // 1–5 stars → 0–100
    }

    /** Skill tokens for an employee: workforce primary + secondary skills, plus designation. */
    private Set<String> employeeSkills(Employee emp) {
        Set<String> skills = new LinkedHashSet<>();
        Workforce wf = emp.getWorkforce();
        if (wf != null) {
            addSkill(skills, wf.getPrimarySkill());
            for (String s : splitSkills(wf.getSecondarySkills())) addSkill(skills, s);
        }
        addSkill(skills, emp.getDesignation());
        return skills;
    }

    private void addSkill(Set<String> set, String raw) {
        if (raw != null && !raw.isBlank()) set.add(raw.trim().toLowerCase());
    }

    private List<String> splitSkills(String csv) {
        if (csv == null || csv.isBlank()) return new ArrayList<>();
        return Arrays.stream(csv.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    private List<String> normalizeSkills(List<String> skills) {
        if (skills == null) return new ArrayList<>();
        return skills.stream()
                .filter(Objects::nonNull).map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isEmpty()).distinct()
                .collect(Collectors.toList());
    }

    private static double clamp01(double v) { return Math.max(0, Math.min(1, v)); }
    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }
    private static double nz(Integer v) { return v == null ? 0 : v; }
    private static double num(Object o) { return o instanceof Number n ? n.doubleValue() : 0; }
    private static String str(Object o) { return o == null ? null : String.valueOf(o); }
    private static Long asLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.parseLong(o.toString()); } catch (NumberFormatException e) { return null; }
    }
}

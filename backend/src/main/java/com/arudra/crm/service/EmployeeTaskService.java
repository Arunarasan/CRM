package com.arudra.crm.service;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.dto.workforce.AssignResourceRequest;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Business logic for the mobile Employee Task & Work Execution module. Kept separate from
 * TaskService (which backs the existing desktop CRUD/Kanban endpoints) so the new accept/start/
 * pause/complete/progress/issue/material/checkin flows can't regress the desktop module.
 */
@Service
public class EmployeeTaskService {

    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private TaskAssignmentRepository assignmentRepository;
    @Autowired
    private TaskChecklistRepository checklistRepository;
    @Autowired
    private TaskChecklistItemRepository checklistItemRepository;
    @Autowired
    private TaskCommentRepository commentRepository;
    @Autowired
    private TaskAttachmentRepository attachmentRepository;
    @Autowired
    private TaskProgressUpdateRepository progressUpdateRepository;
    @Autowired
    private TaskIssueRepository issueRepository;
    @Autowired
    private TaskMaterialUsageRepository materialUsageRepository;
    @Autowired
    private TaskCheckInRepository checkInRepository;
    @Autowired
    private ProjectRoomItemRepository roomItemRepository;
    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ContractorRepository contractorRepository;
    @Autowired
    private WorkforceResourceService workforceResourceService;
    @Autowired
    private InventoryService inventoryService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private WorkflowTriggerService workflowTriggerService;
    @Autowired
    private TaskEligibilityService taskEligibilityService;
    @Autowired
    private AssignmentSettingsRepository assignmentSettingsRepository;

    private static final List<String> ACTIVE_ASSIGNMENT_STATUSES =
            List.of("ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED", "WAITING_MATERIAL", "REWORK", "COMPLETED");

    /** Statuses that count toward an employee's active-task capacity (excludes done/closed). */
    private static final List<String> CAPACITY_STATUSES =
            List.of("ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED", "WAITING_MATERIAL", "REWORK");

    /**
     * Once work is done a task is locked from further field updates, so an employee re-opening a
     * completed task can no longer keep posting progress/photos/issues/material (which polluted the
     * record). Locked when EITHER this employee's own assignment is COMPLETED (submitted, awaiting
     * manager approval) OR the whole task is manager-approved/closed. A manager "reject → REWORK"
     * moves the assignment out of COMPLETED and the task to REWORK, which unlocks it again.
     */
    private void assertTaskEditableBy(Long taskId, User employee) {
        assignmentRepository.findByTaskIdAndEmployeeId(taskId, employee.getId()).ifPresent(a -> {
            if ("COMPLETED".equals(a.getStatus())) {
                throw new IllegalStateException("You've already completed this task — it's awaiting manager approval "
                        + "and can't be updated until a manager requests rework.");
            }
        });
        Task t = getTask(taskId);
        if ("COMPLETED".equals(t.getStatus()) || "CANCELLED".equals(t.getStatus())) {
            throw new IllegalStateException("This task is " + t.getStatus().toLowerCase().replace('_', ' ')
                    + " and can no longer be updated.");
        }
    }

    // ---------------------------------------------------------------- Home / list / detail

    public Map<String, Object> getHome(User employee) {
        List<TaskAssignment> mine = activeAssignments(employee.getId());
        LocalDate today = LocalDate.now();

        List<Task> tasks = mine.stream().map(TaskAssignment::getTask).distinct().collect(Collectors.toList());
        long overdue = tasks.stream().filter(t -> isOverdue(t, today)).count();
        long dueToday = tasks.stream().filter(t -> today.equals(t.getDueDate()) && !"COMPLETED".equals(t.getStatus())).count();
        long upcoming = tasks.stream().filter(t -> t.getDueDate() != null && t.getDueDate().isAfter(today)).count();
        long completedToday = tasks.stream().filter(t -> today.equals(t.getCompletedDate())).count();
        LocalDate weekStart = today.with(java.time.DayOfWeek.MONDAY);
        long completedThisWeek = tasks.stream()
                .filter(t -> t.getCompletedDate() != null && !t.getCompletedDate().isBefore(weekStart))
                .count();
        long pending = tasks.stream().filter(t -> !"COMPLETED".equals(t.getStatus())).count();

        Map<String, Object> home = new HashMap<>();
        home.put("activeTaskCount", activeTaskCount(employee.getId()));
        home.put("maxActiveTasks", maxActiveTasks());
        home.put("availableCount", getAvailablePool(employee).size());
        home.put("dueToday", dueToday);
        home.put("overdue", overdue);
        home.put("upcoming", upcoming);
        home.put("completedToday", completedToday);
        home.put("completedThisWeek", completedThisWeek);
        home.put("pending", pending);
        home.put("todaysTasks", tasks.stream()
                .filter(t -> today.equals(t.getDueDate()) || isOverdue(t, today))
                .map(t -> toCard(t, employee.getId()))
                .collect(Collectors.toList()));
        return home;
    }

    public List<Map<String, Object>> getMyTasks(User employee, String status, String search) {
        List<TaskAssignment> mine = assignmentRepository.findByEmployeeId(employee.getId());
        return mine.stream()
                .map(TaskAssignment::getTask)
                .distinct()
                .filter(t -> status == null || status.isBlank() || status.equalsIgnoreCase(t.getStatus()))
                .filter(t -> search == null || search.isBlank()
                        || t.getTaskName().toLowerCase().contains(search.toLowerCase())
                        || (t.getProject() != null && t.getProject().getProjectName().toLowerCase().contains(search.toLowerCase())))
                .sorted(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(t -> toCard(t, employee.getId()))
                .collect(Collectors.toList());
    }

    /**
     * Distinct projects the employee is currently working on, derived from their active task
     * assignments. Each card carries the employee's own task counts and progress on that project —
     * the self-service "My Projects" view. Employee sees only projects they are assigned to.
     */
    public List<Map<String, Object>> getMyProjects(User employee) {
        List<TaskAssignment> mine = activeAssignments(employee.getId());
        Map<Long, List<Task>> byProject = mine.stream()
                .map(TaskAssignment::getTask)
                .filter(t -> t.getProject() != null)
                .distinct()
                .collect(Collectors.groupingBy(t -> t.getProject().getId()));

        List<Map<String, Object>> cards = new ArrayList<>();
        for (List<Task> tasks : byProject.values()) {
            Project project = tasks.get(0).getProject();
            long completed = tasks.stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();
            Map<String, Object> card = new HashMap<>();
            card.put("id", project.getId());
            card.put("projectName", project.getProjectName());
            card.put("location", project.getPropertyAddress());
            card.put("status", project.getStatus());
            card.put("progress", project.getProgress());
            card.put("projectManager", project.getProjectManager() != null ? project.getProjectManager().getName() : null);
            card.put("myTaskCount", tasks.size());
            card.put("myCompletedCount", completed);
            cards.add(card);
        }
        cards.sort(Comparator.comparing(c -> String.valueOf(c.get("projectName")), String.CASE_INSENSITIVE_ORDER));
        return cards;
    }

    /** A task nobody is currently working (no assignment that isn't cancelled/rejected). */
    private boolean isUnassigned(Task task) {
        return assignmentRepository.findByTaskId(task.getId()).stream()
                .noneMatch(a -> !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus()));
    }

    /**
     * Active projects the employee is NOT assigned to, each carrying how many UNASSIGNED tasks they
     * can pick up. Powers the portal's "Other Projects" list — employees can browse beyond their own
     * projects and take on open work. Only projects with at least one pickable task are returned.
     */
    public List<Map<String, Object>> getOtherProjects(User employee) {
        java.util.Set<Long> mineProjectIds = activeAssignments(employee.getId()).stream()
                .map(TaskAssignment::getTask)
                .filter(t -> t != null && t.getProject() != null)
                .map(t -> t.getProject().getId())
                .collect(Collectors.toSet());

        List<Map<String, Object>> cards = new ArrayList<>();
        for (Project p : projectRepository.findAll()) {
            if (mineProjectIds.contains(p.getId())) continue;
            if ("COMPLETED".equals(p.getStatus()) || "CANCELLED".equals(p.getStatus())) continue;
            long open = taskRepository.findByProjectId(p.getId()).stream()
                    .filter(t -> !"COMPLETED".equals(t.getStatus()) && !"CANCELLED".equals(t.getStatus()))
                    .filter(this::isUnassigned)
                    .count();
            if (open == 0) continue; // nothing to pick up — don't clutter the list
            Map<String, Object> card = new HashMap<>();
            card.put("id", p.getId());
            card.put("projectName", p.getProjectName());
            card.put("location", p.getPropertyAddress());
            card.put("status", p.getStatus());
            card.put("progress", p.getProgress());
            card.put("projectManager", p.getProjectManager() != null ? p.getProjectManager().getName() : null);
            card.put("openTaskCount", open);
            cards.add(card);
        }
        cards.sort(Comparator.comparing(c -> String.valueOf(c.get("projectName")), String.CASE_INSENSITIVE_ORDER));
        return cards;
    }

    /** The pickable (unassigned, not closed) tasks in a project — what an employee may take on. */
    public List<Map<String, Object>> getProjectOpenTasks(Long projectId, User employee) {
        return taskRepository.findByProjectId(projectId).stream()
                .filter(t -> !"COMPLETED".equals(t.getStatus()) && !"CANCELLED".equals(t.getStatus()))
                .filter(t -> !"LOCKED".equals(t.getStatus()))
                .filter(this::isUnassigned)
                .filter(t -> taskEligibilityService.isEligible(employee, t))
                .sorted(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(t -> toCard(t, employee.getId()))
                .collect(Collectors.toList());
    }

    /**
     * An employee picks up an UNASSIGNED task and starts owning it. Guarded so they can only take
     * tasks nobody else holds (per the chosen policy) — self-assigning never displaces another worker.
     * Set ACCEPTED since the employee actively chose it. Managers are notified for accountability.
     */
    @Transactional
    @LogActivity(module = "EMPLOYEE_TASK", action = "SELF_ASSIGN")
    public Task selfAssign(Long taskId, User employee) {
        // Pessimistic row lock serializes concurrent picks so only one employee can win a task.
        Task task = taskRepository.findByIdForUpdate(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        if ("COMPLETED".equals(task.getStatus()) || "CANCELLED".equals(task.getStatus())) {
            throw new IllegalStateException("This task is closed and can't be picked up.");
        }
        if ("LOCKED".equals(task.getStatus())) {
            throw new IllegalStateException("This task is locked until the work it depends on is completed.");
        }
        if (!taskEligibilityService.isEligible(employee, task)) {
            throw new IllegalStateException(taskEligibilityService.ineligibleReason(employee, task));
        }
        if (!isUnassigned(task)) {
            throw new IllegalStateException("This task was already picked by another employee.");
        }
        assertHasCapacity(employee);

        TaskAssignment a = new TaskAssignment();
        a.setTask(task);
        a.setResourceType(ResourceType.EMPLOYEE);
        a.setResourceId(employee.getId());
        a.setEmployee(employee);
        a.setAssignedBy(employee);
        a.setRole("Owner"); // first picker owns the task (matters for OWNER_APPROVAL completion)
        a.setStatus("ACCEPTED");
        a.setAcceptedAt(LocalDateTime.now());
        assignmentRepository.save(a);

        task.setAssignedEmployee(employee); // mirror primary pointer for display/back-compat
        Task saved = recomputeAndSave(task);
        for (Long mgr : managersForTask(task)) {
            notificationService.dispatch("Task picked up",
                    employee.getName() + " picked up \"" + task.getTaskName() + "\".", "TASK", mgr,
                    task.getProject() != null ? "/projects/" + task.getProject().getId() : null);
        }
        return saved;
    }

    /**
     * A second (and further) employee joins an already-owned collaborative task. Single-employee
     * tasks can't be joined. Consumes one capacity slot and is eligibility-gated like a pick.
     */
    @Transactional
    @LogActivity(module = "EMPLOYEE_TASK", action = "JOIN")
    public Task joinTask(Long taskId, User employee) {
        Task task = taskRepository.findByIdForUpdate(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        if ("COMPLETED".equals(task.getStatus()) || "CANCELLED".equals(task.getStatus())) {
            throw new IllegalStateException("This task is closed and can't be joined.");
        }
        String type = task.getAssignmentType();
        boolean collaborative = "MULTIPLE_EMPLOYEES".equals(type) || "TEAM".equals(type);
        if (!collaborative) {
            throw new IllegalStateException("This is a single-person task and can't be joined.");
        }
        if (isUnassigned(task)) {
            throw new IllegalStateException("No one has started this task yet — use Pick & Start instead.");
        }
        if (!taskEligibilityService.isEligible(employee, task)) {
            throw new IllegalStateException(taskEligibilityService.ineligibleReason(employee, task));
        }

        // Re-activate a prior cancelled/rejected assignment rather than stacking duplicate rows.
        TaskAssignment existing = assignmentRepository.findByTaskIdAndEmployeeId(taskId, employee.getId()).orElse(null);
        if (existing != null && !"CANCELLED".equals(existing.getStatus()) && !"REJECTED".equals(existing.getStatus())) {
            throw new IllegalStateException("You're already on this task.");
        }
        assertHasCapacity(employee);

        TaskAssignment a = existing != null ? existing : new TaskAssignment();
        a.setTask(task);
        a.setResourceType(ResourceType.EMPLOYEE);
        a.setResourceId(employee.getId());
        a.setEmployee(employee);
        a.setAssignedBy(employee);
        a.setRole("Participant");
        a.setStatus("ACCEPTED");
        a.setAcceptedAt(LocalDateTime.now());
        assignmentRepository.save(a);

        Task saved = recomputeAndSave(task);
        for (Long mgr : managersForTask(task)) {
            notificationService.dispatch("Task joined",
                    employee.getName() + " joined \"" + task.getTaskName() + "\".", "TASK", mgr,
                    task.getProject() != null ? "/projects/" + task.getProject().getId() : null);
        }
        return saved;
    }

    // ---------------------------------------------------------------- Capacity

    /** Distinct tasks the employee is actively holding (owned or participating, not yet done). */
    public int activeTaskCount(Long employeeId) {
        return (int) assignmentRepository.findByEmployeeId(employeeId).stream()
                .filter(a -> CAPACITY_STATUSES.contains(a.getStatus()))
                .filter(a -> a.getTask() != null)
                .map(a -> a.getTask().getId())
                .distinct().count();
    }

    /** Configurable capacity cap (assignment_settings singleton), default 3. */
    public int maxActiveTasks() {
        return assignmentSettingsRepository.findById(AssignmentSettings.SINGLETON_ID)
                .or(() -> assignmentSettingsRepository.findAll().stream().findFirst())
                .map(AssignmentSettings::getMaxActiveTasks)
                .orElse(3);
    }

    public Map<String, Object> getCapacity(User employee) {
        int active = activeTaskCount(employee.getId());
        int max = maxActiveTasks();
        Map<String, Object> m = new HashMap<>();
        m.put("active", active);
        m.put("max", max);
        m.put("canPick", active < max);
        return m;
    }

    private void assertHasCapacity(User employee) {
        int active = activeTaskCount(employee.getId());
        int max = maxActiveTasks();
        if (active >= max) {
            throw new IllegalStateException("You're at capacity (" + active + " / " + max
                    + "). Complete or release a task before picking another.");
        }
    }

    /**
     * The eligible, AVAILABLE workflow tasks an employee may pick up — the shared Task Pool. Each
     * card carries {@code canPick} reflecting the employee's remaining capacity.
     */
    public List<Map<String, Object>> getAvailablePool(User employee) {
        boolean hasCapacity = activeTaskCount(employee.getId()) < maxActiveTasks();
        return taskRepository.findByStatus("AVAILABLE").stream()
                .filter(this::isUnassigned)
                .filter(t -> taskEligibilityService.isEligible(employee, t))
                .sorted(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(t -> {
                    Map<String, Object> card = toCard(t, employee.getId());
                    card.put("canPick", hasCapacity);
                    return card;
                })
                .collect(Collectors.toList());
    }

    public Map<String, Object> getTaskDetail(Long taskId, User employee) {
        Task task = getTask(taskId);
        Map<String, Object> detail = toCard(task, employee != null ? employee.getId() : null);

        detail.put("description", task.getDescription());
        detail.put("assignmentType", task.getAssignmentType());
        detail.put("completionRule", task.getCompletionRule());
        // Lead-workflow tasks may carry a structured completion form (Contact/Requirement/Qualify/…),
        // or be module-driven (Measurement/BOQ) — done in a dedicated module, not by the generic button.
        String templateCode = task.getTaskTemplate() != null ? task.getTaskTemplate().getCode() : null;
        detail.put("formType", com.arudra.crm.util.LeadTaskForms.formTypeFor(templateCode));
        detail.put("leadId", task.getLeadId());
        boolean moduleDriven = com.arudra.crm.util.LeadTaskForms.isModuleDriven(templateCode);
        detail.put("moduleDriven", moduleDriven);
        detail.put("moduleLink", moduleDriven
                ? com.arudra.crm.util.LeadTaskForms.moduleLink(templateCode, task.getLeadId()) : null);
        detail.put("moduleLabel", moduleDriven
                ? com.arudra.crm.util.LeadTaskForms.moduleLabel(templateCode) : null);
        detail.put("customer", task.getProject() != null && task.getProject().getCustomer() != null
                ? task.getProject().getCustomer().getName() : null);
        detail.put("location", task.getProject() != null ? task.getProject().getPropertyAddress() : null);
        detail.put("floor", task.getRoom() != null ? task.getRoom().getFloorName() : null);
        detail.put("estimatedHours", task.getEstimatedHours());
        detail.put("actualHours", task.getActualHours());
        detail.put("startDate", task.getStartDate());
        detail.put("dueDate", task.getDueDate());
        detail.put("completedDate", task.getCompletedDate());

        detail.put("team", assignmentRepository.findByTaskId(taskId).stream().map(this::toAssignmentSummary).collect(Collectors.toList()));
        detail.put("checklist", checklistRepository.findByTaskId(taskId).stream().map(this::toChecklistSummary).collect(Collectors.toList()));
        detail.put("comments", commentRepository.findByTaskIdOrderByCreatedAtDesc(taskId).stream()
                .map(this::toCommentSummary).collect(Collectors.toList()));
        detail.put("attachments", attachmentRepository.findByTaskId(taskId).stream()
                .map(a -> Map.of("id", a.getId(), "fileName", a.getFileName(), "fileUrl", a.getFileUrl()))
                .collect(Collectors.toList()));
        detail.put("progress", progressUpdateRepository.findByTaskIdOrderByCreatedAtDesc(taskId).stream()
                .map(this::toProgressSummary).collect(Collectors.toList()));
        detail.put("issues", issueRepository.findByTaskIdOrderByReportedAtDesc(taskId).stream()
                .map(this::toIssueSummary).collect(Collectors.toList()));
        detail.put("materialUsage", materialUsageRepository.findByTaskIdOrderByUsedAtDesc(taskId).stream()
                .map(this::toMaterialUsageSummary).collect(Collectors.toList()));
        detail.put("checkins", checkInRepository.findByTaskIdOrderByCheckInTimeDesc(taskId).stream()
                .map(this::toCheckInSummary).collect(Collectors.toList()));
        return detail;
    }

    // ---------------------------------------------------------------- Assignment (manager side)

    /** Back-compat: assign one or more employees. Delegates to the unified resource path. */
    @LogActivity(module = "EMPLOYEE_TASK", action = "ASSIGN")
    public Task assignEmployees(Long taskId, List<Long> employeeIds, String role, User assignedBy) {
        List<AssignResourceRequest> requests = employeeIds.stream()
                .map(id -> new AssignResourceRequest(ResourceType.EMPLOYEE, id, role))
                .collect(Collectors.toList());
        return assignResources(taskId, requests, assignedBy);
    }

    /**
     * Unified assignment: attach any workforce resource (employee OR contractor, extensible) to a
     * task. Employees get the legacy {@code employee} pointer set too (so the mobile module keeps
     * working); contractors don't (no login). The primary pointer is mirrored onto the Task for
     * display. Both types then flow through the exact same lifecycle/progress/completion workflow.
     */
    @LogActivity(module = "EMPLOYEE_TASK", action = "ASSIGN")
    public Task assignResources(Long taskId, List<AssignResourceRequest> resources, User assignedBy) {
        Task task = getTask(taskId);
        for (AssignResourceRequest r : resources) {
            String type = ResourceType.normalize(r.getResourceType());
            Long rid = r.getResourceId();
            if (!ResourceType.isValid(type) || rid == null || !workforceResourceService.exists(type, rid)) {
                throw new RuntimeException("Unknown workforce resource: " + type + " #" + rid);
            }
            if (assignmentRepository.findByTaskIdAndResourceTypeAndResourceId(taskId, type, rid).isPresent()) {
                continue; // already assigned
            }
            TaskAssignment assignment = new TaskAssignment();
            assignment.setTask(task);
            assignment.setResourceType(type);
            assignment.setResourceId(rid);
            assignment.setAssignedBy(assignedBy);
            assignment.setRole(r.getRole());
            assignment.setStatus("ASSIGNED");

            if (ResourceType.EMPLOYEE.equals(type)) {
                User employee = userRepository.findById(rid).orElseThrow(() -> new RuntimeException("Employee not found"));
                assignment.setEmployee(employee);
                assignmentRepository.save(assignment);
                task.setAssignedEmployee(employee); // mirror primary pointer for display/back-compat
                notificationService.dispatch("Task Assigned", "You were assigned: " + task.getTaskName(),
                        "TASK", rid, "/employee/tasks/" + taskId);
            } else if (ResourceType.CONTRACTOR.equals(type)) {
                assignmentRepository.save(assignment);
                contractorRepository.findById(rid).ifPresent(task::setContractor);
                // Contractors have no login by default — notify the project managers instead.
                String cname = workforceResourceService.displayName(type, rid);
                Long projectId = task.getProject() != null ? task.getProject().getId() : null;
                for (Long mgr : managersForTask(task)) {
                    notificationService.dispatch("Contractor Assigned",
                            cname + " was assigned: " + task.getTaskName(), "TASK", mgr,
                            projectId != null ? "/projects/" + projectId : null);
                }
            }
        }
        recomputeTaskStatus(task);
        return taskRepository.save(task);
    }

    /** Back-compat: remove an employee assignment by employee id. */
    public void removeAssignment(Long taskId, Long employeeId) {
        removeResourceAssignment(taskId, ResourceType.EMPLOYEE, employeeId);
    }

    /** Unified: cancel a resource's assignment on a task. */
    public void removeResourceAssignment(Long taskId, String resourceType, Long resourceId) {
        assignmentRepository.findByTaskIdAndResourceTypeAndResourceId(
                taskId, ResourceType.normalize(resourceType), resourceId).ifPresent(a -> {
            a.setStatus("CANCELLED");
            assignmentRepository.save(a);
        });
        recomputeAndSave(getTask(taskId));
    }

    // ---------------------------------------------------------------- Lifecycle

    @LogActivity(module = "EMPLOYEE_TASK", action = "ACCEPT")
    public Task accept(Long taskId, User employee) {
        TaskAssignment a = getAssignment(taskId, employee.getId());
        a.setStatus("ACCEPTED");
        a.setAcceptedAt(LocalDateTime.now());
        assignmentRepository.save(a);
        return recomputeAndSave(a.getTask());
    }

    @LogActivity(module = "EMPLOYEE_TASK", action = "START")
    public Task start(Long taskId, User employee) {
        TaskAssignment a = getAssignment(taskId, employee.getId());
        a.setStatus("IN_PROGRESS");
        if (a.getStartedAt() == null) {
            a.setStartedAt(LocalDateTime.now());
        }
        assignmentRepository.save(a);
        return recomputeAndSave(a.getTask());
    }

    @LogActivity(module = "EMPLOYEE_TASK", action = "PAUSE")
    public Task pause(Long taskId, User employee, String remarks) {
        TaskAssignment a = getAssignment(taskId, employee.getId());
        a.setStatus("PAUSED");
        if (remarks != null) a.setRemarks(remarks);
        assignmentRepository.save(a);
        return recomputeAndSave(a.getTask());
    }

    @LogActivity(module = "EMPLOYEE_TASK", action = "RESUME")
    public Task resume(Long taskId, User employee) {
        TaskAssignment a = getAssignment(taskId, employee.getId());
        a.setStatus("IN_PROGRESS");
        assignmentRepository.save(a);
        return recomputeAndSave(a.getTask());
    }

    @LogActivity(module = "EMPLOYEE_TASK", action = "COMPLETE")
    public Task complete(Long taskId, User employee, String remarks) {
        assertTaskEditableBy(taskId, employee);
        // Module-driven tasks (Measurement/BOQ) can't be finished by hand — they close automatically
        // when the real work is finalized in their module. Manual completion would falsely advance the
        // workflow (e.g. generate the BOQ task with no measurement recorded).
        Task guard = getTask(taskId);
        if (guard.getTaskTemplate() != null
                && com.arudra.crm.util.LeadTaskForms.isModuleDriven(guard.getTaskTemplate().getCode())) {
            throw new IllegalStateException("This task is completed automatically when its work is finalized "
                    + "in its dedicated module — it can't be marked done here.");
        }
        TaskAssignment a = getAssignment(taskId, employee.getId());
        a.setStatus("COMPLETED");
        a.setCompletedAt(LocalDateTime.now());
        if (remarks != null) a.setRemarks(remarks);
        assignmentRepository.save(a);
        Task task = a.getTask();

        // Honor the task's completion rule (defaults to OWNER_APPROVAL for anything unset):
        //   ANY_PARTICIPANT   → the task is done the moment one participant finishes.
        //   ALL_PARTICIPANTS  → done once every active participant has finished (no manager step).
        //   OWNER_APPROVAL    → participants submit; owner/manager approves via approveCompletion.
        String rule = task.getCompletionRule() == null ? "OWNER_APPROVAL" : task.getCompletionRule();
        boolean finalizeNow = "ANY_PARTICIPANT".equals(rule)
                || ("ALL_PARTICIPANTS".equals(rule) && allActiveAssignmentsCompleted(task));
        if (finalizeNow) {
            return finalizeTaskCompletion(task, employee);
        }

        // Not final yet — notify delivery trackers that this participant submitted their part.
        String title = "Task Completed";
        String message = employee.getName() + " completed \"" + task.getTaskName() + "\"";
        for (Long mgr : managersForTask(task)) {
            notificationService.dispatch(title, message, "TASK", mgr, "/tasks");
        }
        notificationService.dispatchToAdmins(title, message, "TASK", "/tasks", employee.getId());

        return recomputeAndSave(task); // → WAITING_APPROVAL once all participants are done
    }

    /** Finalize a task as COMPLETED, close its assignments, notify, and drive the workflow forward. */
    private Task finalizeTaskCompletion(Task task, User byEmployee) {
        task.setStatus("COMPLETED");
        task.setCompletedDate(LocalDate.now());
        for (TaskAssignment a : assignmentRepository.findByTaskId(task.getId())) {
            if (!"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus())
                    && !"COMPLETED".equals(a.getStatus())) {
                a.setStatus("COMPLETED");
                if (a.getCompletedAt() == null) a.setCompletedAt(LocalDateTime.now());
                assignmentRepository.save(a);
            }
        }
        Task saved = taskRepository.save(task);

        String message = "\"" + task.getTaskName() + "\" is complete";
        for (Long mgr : managersForTask(task)) {
            notificationService.dispatch("Task Completed", message, "TASK", mgr, "/tasks");
        }
        notificationService.dispatchToAdmins("Task Completed", message, "TASK", "/tasks", byEmployee.getId());

        workflowTriggerService.onTaskCompleted(saved);
        return saved;
    }

    private boolean allActiveAssignmentsCompleted(Task task) {
        List<TaskAssignment> active = assignmentRepository.findByTaskId(task.getId()).stream()
                .filter(a -> !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus()))
                .collect(Collectors.toList());
        return !active.isEmpty() && active.stream().allMatch(a -> "COMPLETED".equals(a.getStatus()));
    }

    @LogActivity(module = "EMPLOYEE_TASK", action = "APPROVE")
    public Task approveCompletion(Long taskId, User manager) {
        Task task = getTask(taskId);
        task.setStatus("COMPLETED");
        task.setCompletedDate(LocalDate.now());
        taskRepository.save(task);
        for (TaskAssignment a : assignmentRepository.findByTaskId(taskId)) {
            if (!"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus())) {
                a.setStatus("COMPLETED");
                assignmentRepository.save(a);
                notificationService.dispatch("Task Approved", "\"" + task.getTaskName() + "\" was approved by your manager.",
                        "TASK", a.getEmployee().getId(), "/employee/tasks/" + taskId);
            }
        }

        // Drive the workflow forward: unlock dependents / advance the phase (no-op for manual tasks).
        workflowTriggerService.onTaskCompleted(task);
        return task;
    }

    @LogActivity(module = "EMPLOYEE_TASK", action = "REJECT")
    public Task rejectCompletion(Long taskId, User manager, String remarks) {
        Task task = getTask(taskId);
        task.setStatus("REWORK");
        taskRepository.save(task);
        for (TaskAssignment a : assignmentRepository.findByTaskId(taskId)) {
            if ("COMPLETED".equals(a.getStatus())) {
                a.setStatus("REWORK");
                a.setRemarks(remarks);
                assignmentRepository.save(a);
                notificationService.dispatch("Rework Requested", "\"" + task.getTaskName() + "\" needs rework: " + remarks,
                        "TASK", a.getEmployee().getId(), "/employee/tasks/" + taskId);
            }
        }
        return task;
    }

    // ---------------------------------------------------------------- Progress / checklist

    @LogActivity(module = "EMPLOYEE_TASK", action = "PROGRESS")
    public Map<String, Object> addProgress(Long taskId, User employee, Integer progressPercent, String remarks,
                                           Integer timeSpentMinutes, List<Map<String, Object>> mediaItems) {
        assertTaskEditableBy(taskId, employee);
        Task task = getTask(taskId);
        TaskProgressUpdate update = new TaskProgressUpdate();
        update.setTask(task);
        update.setEmployee(employee);
        update.setProgressPercent(progressPercent);
        update.setRemarks(remarks);
        update.setTimeSpentMinutes(timeSpentMinutes);

        if (mediaItems != null) {
            List<TaskProgressMedia> media = new ArrayList<>();
            for (Map<String, Object> item : mediaItems) {
                TaskProgressMedia m = new TaskProgressMedia();
                m.setProgressUpdate(update);
                m.setMediaType(String.valueOf(item.get("mediaType")));
                m.setFileUrl(String.valueOf(item.get("fileUrl")));
                if (item.get("caption") != null) m.setCaption(String.valueOf(item.get("caption")));
                if (item.get("latitude") != null) m.setLatitude(Double.valueOf(item.get("latitude").toString()));
                if (item.get("longitude") != null) m.setLongitude(Double.valueOf(item.get("longitude").toString()));
                media.add(m);
            }
            update.setMedia(media);
        }

        if (timeSpentMinutes != null && timeSpentMinutes > 0) {
            double addHours = timeSpentMinutes / 60.0;
            task.setActualHours((task.getActualHours() == null ? 0 : task.getActualHours()) + addHours);
            taskRepository.save(task);
        }

        TaskProgressUpdate saved = progressUpdateRepository.save(update);
        return toProgressSummary(saved);
    }

    public Map<String, Object> toggleChecklistItem(Long checklistItemId, User employee) {
        TaskChecklistItem item = checklistItemRepository.findById(checklistItemId)
                .orElseThrow(() -> new RuntimeException("Checklist item not found"));
        if (item.getChecklist() != null && item.getChecklist().getTask() != null) {
            assertTaskEditableBy(item.getChecklist().getTask().getId(), employee);
        }
        item.setIsCompleted(!Boolean.TRUE.equals(item.getIsCompleted()));
        TaskChecklistItem saved = checklistItemRepository.save(item);
        return Map.of("id", saved.getId(), "content", saved.getContent(),
                "isCompleted", saved.getIsCompleted(), "orderIndex", saved.getOrderIndex());
    }

    public Map<String, Object> addChecklistItem(Long taskId, String checklistName, String content) {
        Task task = getTask(taskId);
        TaskChecklist checklist = checklistRepository.findByTaskId(taskId).stream()
                .filter(c -> c.getName().equalsIgnoreCase(checklistName))
                .findFirst()
                .orElseGet(() -> {
                    TaskChecklist c = new TaskChecklist();
                    c.setTask(task);
                    c.setName(checklistName);
                    return checklistRepository.save(c);
                });
        List<TaskChecklistItem> existingItems = checklistItemRepository.findByChecklistId(checklist.getId());
        TaskChecklistItem item = new TaskChecklistItem();
        item.setChecklist(checklist);
        item.setContent(content);
        item.setOrderIndex(existingItems.size());
        checklistItemRepository.save(item);

        // Build the summary from a fresh repository query rather than checklist.getItems() — that
        // collection may already be lazily initialized (session-cached) from before this save and
        // would silently omit the item just added.
        List<TaskChecklistItem> allItems = checklistItemRepository.findByChecklistId(checklist.getId());
        Map<String, Object> summary = new HashMap<>();
        summary.put("id", checklist.getId());
        summary.put("name", checklist.getName());
        summary.put("items", allItems.stream().map(i -> Map.of(
                "id", i.getId(), "content", i.getContent(), "isCompleted", i.getIsCompleted(), "orderIndex", i.getOrderIndex()
        )).toList());
        return summary;
    }

    // ---------------------------------------------------------------- Issues

    @LogActivity(module = "EMPLOYEE_TASK", action = "REPORT_ISSUE")
    public Map<String, Object> reportIssue(Long taskId, User employee, String issueType, String description) {
        assertTaskEditableBy(taskId, employee);
        Task task = getTask(taskId);
        TaskIssue issue = new TaskIssue();
        issue.setTask(task);
        issue.setEmployee(employee);
        issue.setIssueType(issueType);
        issue.setDescription(description);
        issue.setStatus("OPEN");
        TaskIssue saved = issueRepository.save(issue);

        if ("MATERIAL_SHORTAGE".equals(issueType) && !"WAITING_MATERIAL".equals(task.getStatus())) {
            task.setStatus("WAITING_MATERIAL");
            taskRepository.save(task);
        }

        List<Long> managerIds = managersForTask(task);
        for (Long managerId : managerIds) {
            notificationService.dispatch("Task Issue Reported",
                    employee.getName() + " reported " + issueType + " on \"" + task.getTaskName() + "\"",
                    "TASK", managerId, "/projects/" + task.getProject().getId());
        }
        return toIssueSummary(saved);
    }

    public List<Map<String, Object>> getIssues(Long taskId) {
        return issueRepository.findByTaskIdOrderByReportedAtDesc(taskId).stream()
                .map(this::toIssueSummary).toList();
    }

    // ---------------------------------------------------------------- Material usage

    @LogActivity(module = "EMPLOYEE_TASK", action = "MATERIAL_USAGE")
    public Map<String, Object> logMaterialUsage(Long taskId, User employee, Long productId, BigDecimal quantity, String remarks) {
        assertTaskEditableBy(taskId, employee);
        Task task = getTask(taskId);
        Product product = productRepository.findById(productId).orElseThrow(() -> new RuntimeException("Product not found"));

        TaskMaterialUsage usage = new TaskMaterialUsage();
        usage.setTask(task);
        usage.setProduct(product);
        usage.setQuantityUsed(quantity);
        usage.setUnit(product.getUnit());
        usage.setUsedBy(employee);
        usage.setRemarks(remarks);
        TaskMaterialUsage saved = materialUsageRepository.save(usage);

        inventoryService.deductReservedStock(productId, quantity.intValue(), "TASK", taskId);
        return toMaterialUsageSummary(saved);
    }

    // ---------------------------------------------------------------- Check-in / check-out

    public Map<String, Object> checkIn(Long taskId, User employee, Double latitude, Double longitude, String locationLabel) {
        assertTaskEditableBy(taskId, employee);
        Task task = getTask(taskId);
        TaskCheckIn checkIn = new TaskCheckIn();
        checkIn.setTask(task);
        checkIn.setEmployee(employee);
        checkIn.setCheckInTime(LocalDateTime.now());
        checkIn.setCheckInLatitude(latitude);
        checkIn.setCheckInLongitude(longitude);
        checkIn.setLocationLabel(locationLabel);
        return toCheckInSummary(checkInRepository.save(checkIn));
    }

    public Map<String, Object> checkOut(Long taskId, User employee, Double latitude, Double longitude) {
        TaskCheckIn open = checkInRepository
                .findFirstByTaskIdAndEmployeeIdAndCheckOutTimeIsNullOrderByCheckInTimeDesc(taskId, employee.getId())
                .orElseThrow(() -> new RuntimeException("No open check-in for this task"));
        open.setCheckOutTime(LocalDateTime.now());
        open.setCheckOutLatitude(latitude);
        open.setCheckOutLongitude(longitude);
        return toCheckInSummary(checkInRepository.save(open));
    }

    // ---------------------------------------------------------------- Reports

    public Map<String, Object> getReportsSummary() {
        List<Task> all = taskRepository.findAll();
        LocalDate today = LocalDate.now();

        long completed = all.stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();
        long delayed = all.stream().filter(t -> isOverdue(t, today)).count();
        long rework = all.stream().filter(t -> "REWORK".equals(t.getStatus())).count();
        double avgHours = all.stream()
                .filter(t -> t.getActualHours() != null && t.getActualHours() > 0)
                .mapToDouble(Task::getActualHours).average().orElse(0);

        Map<String, Long> completedByEmployee = new HashMap<>();
        for (Task t : all) {
            if (!"COMPLETED".equals(t.getStatus())) continue;
            for (TaskAssignment a : assignmentRepository.findByTaskId(t.getId())) {
                if ("COMPLETED".equals(a.getStatus()) && a.getEmployee() != null) {
                    String name = a.getEmployee().getName();
                    completedByEmployee.merge(name, 1L, Long::sum);
                }
            }
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalTasks", all.size());
        summary.put("completedTasks", completed);
        summary.put("delayedTasks", delayed);
        summary.put("reworkTasks", rework);
        summary.put("averageActualHours", Math.round(avgHours * 100.0) / 100.0);
        summary.put("completedByEmployee", completedByEmployee);
        return summary;
    }

    // ---------------------------------------------------------------- Helpers

    private Task getTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new RuntimeException("Task not found"));
    }

    private TaskAssignment getAssignment(Long taskId, Long employeeId) {
        return assignmentRepository.findByTaskIdAndEmployeeId(taskId, employeeId)
                .orElseThrow(() -> new RuntimeException("You are not assigned to this task"));
    }

    private List<TaskAssignment> activeAssignments(Long employeeId) {
        return assignmentRepository.findByEmployeeId(employeeId).stream()
                .filter(a -> ACTIVE_ASSIGNMENT_STATUSES.contains(a.getStatus()))
                .collect(Collectors.toList());
    }

    private boolean isOverdue(Task t, LocalDate today) {
        return t.getDueDate() != null && t.getDueDate().isBefore(today) && !"COMPLETED".equals(t.getStatus()) && !"CANCELLED".equals(t.getStatus());
    }

    /**
     * Derived scheduling state — never mutates {@code status} (spec §16/26): ON_TRACK, DUE_SOON
     * (within 2 days) or OVERDUE. Closed tasks are always ON_TRACK.
     */
    private String dueState(Task t, LocalDate today) {
        if (t.getDueDate() == null || "COMPLETED".equals(t.getStatus()) || "CANCELLED".equals(t.getStatus())) {
            return "ON_TRACK";
        }
        if (t.getDueDate().isBefore(today)) return "OVERDUE";
        if (!t.getDueDate().isAfter(today.plusDays(2))) return "DUE_SOON";
        return "ON_TRACK";
    }

    private Task recomputeAndSave(Task task) {
        recomputeTaskStatus(task);
        return taskRepository.save(task);
    }

    /** Derives the manager-facing Task.status from the set of per-employee TaskAssignment statuses. */
    private void recomputeTaskStatus(Task task) {
        List<TaskAssignment> assignments = assignmentRepository.findByTaskId(task.getId()).stream()
                .filter(a -> !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus()))
                .collect(Collectors.toList());
        if (assignments.isEmpty()) {
            return;
        }
        boolean allCompleted = assignments.stream().allMatch(a -> "COMPLETED".equals(a.getStatus()));
        if (allCompleted) {
            task.setStatus("WAITING_APPROVAL");
            return;
        }
        if (assignments.stream().anyMatch(a -> "WAITING_MATERIAL".equals(a.getStatus()))) {
            task.setStatus("WAITING_MATERIAL");
            return;
        }
        if (assignments.stream().anyMatch(a -> "REWORK".equals(a.getStatus()))) {
            task.setStatus("REWORK");
            return;
        }
        if (assignments.stream().anyMatch(a -> "IN_PROGRESS".equals(a.getStatus()))) {
            task.setStatus("IN_PROGRESS");
            return;
        }
        if (assignments.stream().anyMatch(a -> "PAUSED".equals(a.getStatus()))) {
            task.setStatus("PAUSED");
            return;
        }
        if (assignments.stream().anyMatch(a -> "ACCEPTED".equals(a.getStatus()))) {
            task.setStatus("ACCEPTED");
            return;
        }
        task.setStatus("PENDING");
    }

    private List<Long> managersForTask(Task task) {
        List<Long> ids = new ArrayList<>();
        if (task.getProject() != null && task.getProject().getProjectManager() != null) {
            ids.add(task.getProject().getProjectManager().getId());
        }
        return ids;
    }

    private Map<String, Object> toCard(Task t, Long viewerEmployeeId) {
        Map<String, Object> card = new HashMap<>();
        card.put("id", t.getId());
        card.put("taskName", t.getTaskName());
        card.put("project", t.getProject() != null ? Map.of("id", t.getProject().getId(), "name", t.getProject().getProjectName()) : null);
        card.put("room", t.getRoom() != null ? t.getRoom().getRoomName() : null);
        card.put("floor", t.getRoom() != null ? t.getRoom().getFloorName() : null);
        card.put("itemName", resolveItemName(t));
        card.put("priority", t.getPriority());
        card.put("status", t.getStatus());
        card.put("dueDate", t.getDueDate());
        card.put("dueState", dueState(t, LocalDate.now())); // ON_TRACK | DUE_SOON | OVERDUE (derived, non-destructive)
        card.put("progressPercent", latestProgressPercent(t.getId()));

        List<TaskAssignment> assignments = assignmentRepository.findByTaskId(t.getId());
        card.put("assignedEmployees", assignments.stream()
                .filter(a -> !"CANCELLED".equals(a.getStatus()))
                .map(a -> a.getEmployee() != null ? a.getEmployee().getName() : null)
                .collect(Collectors.toList()));

        if (viewerEmployeeId != null) {
            assignments.stream()
                    .filter(a -> a.getEmployee() != null && a.getEmployee().getId().equals(viewerEmployeeId))
                    .findFirst()
                    .ifPresent(mine -> card.put("myAssignmentStatus", mine.getStatus()));
        }
        return card;
    }

    private String resolveItemName(Task t) {
        if (t.getRoom() == null || t.getGeneratedFromBoqItemId() == null) return null;
        return roomItemRepository.findByRoomIdAndBoqItemId(t.getRoom().getId(), t.getGeneratedFromBoqItemId())
                .map(ProjectRoomItem::getItemName).orElse(null);
    }

    private Integer latestProgressPercent(Long taskId) {
        return progressUpdateRepository.findByTaskIdOrderByCreatedAtDesc(taskId).stream()
                .map(TaskProgressUpdate::getProgressPercent)
                .filter(p -> p != null)
                .findFirst().orElse(null);
    }

    private Map<String, Object> toAssignmentSummary(TaskAssignment a) {
        Map<String, Object> m = new HashMap<>();
        m.put("employeeId", a.getEmployee() != null ? a.getEmployee().getId() : null);
        m.put("employeeName", a.getEmployee() != null ? a.getEmployee().getName() : null);
        m.put("role", a.getRole());
        m.put("status", a.getStatus());
        m.put("assignedDate", a.getAssignedDate());
        m.put("acceptedAt", a.getAcceptedAt());
        m.put("startedAt", a.getStartedAt());
        m.put("completedAt", a.getCompletedAt());
        return m;
    }

    private Map<String, Object> toChecklistSummary(TaskChecklist c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("items", c.getItems().stream().map(i -> Map.of(
                "id", i.getId(), "content", i.getContent(), "isCompleted", i.getIsCompleted(), "orderIndex", i.getOrderIndex()
        )).collect(Collectors.toList()));
        return m;
    }

    private Map<String, Object> toCommentSummary(TaskComment c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId());
        m.put("content", c.getContent());
        m.put("authorName", c.getAuthor() != null ? c.getAuthor().getName() : null);
        m.put("role", c.getRole());
        m.put("createdAt", c.getCreatedAt());
        return m;
    }

    private Map<String, Object> toIssueSummary(TaskIssue i) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", i.getId());
        m.put("issueType", i.getIssueType());
        m.put("description", i.getDescription());
        m.put("status", i.getStatus());
        m.put("employeeName", i.getEmployee() != null ? i.getEmployee().getName() : null);
        m.put("reportedAt", i.getReportedAt());
        m.put("resolvedAt", i.getResolvedAt());
        return m;
    }

    private Map<String, Object> toMaterialUsageSummary(TaskMaterialUsage u) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", u.getId());
        m.put("productName", u.getProduct() != null ? u.getProduct().getName() : null);
        m.put("quantityUsed", u.getQuantityUsed());
        m.put("unit", u.getUnit());
        m.put("usedByName", u.getUsedBy() != null ? u.getUsedBy().getName() : null);
        m.put("usedAt", u.getUsedAt());
        m.put("remarks", u.getRemarks());
        return m;
    }

    private Map<String, Object> toCheckInSummary(TaskCheckIn c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId());
        m.put("employeeName", c.getEmployee() != null ? c.getEmployee().getName() : null);
        m.put("checkInTime", c.getCheckInTime());
        m.put("checkOutTime", c.getCheckOutTime());
        m.put("checkInLatitude", c.getCheckInLatitude());
        m.put("checkInLongitude", c.getCheckInLongitude());
        m.put("locationLabel", c.getLocationLabel());
        return m;
    }

    private Map<String, Object> toProgressSummary(TaskProgressUpdate p) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("employeeName", p.getEmployee() != null ? p.getEmployee().getName() : null);
        m.put("progressPercent", p.getProgressPercent());
        m.put("remarks", p.getRemarks());
        m.put("timeSpentMinutes", p.getTimeSpentMinutes());
        m.put("createdAt", p.getCreatedAt());
        m.put("media", p.getMedia() == null ? List.of() : p.getMedia().stream().map(md -> Map.of(
                "mediaType", md.getMediaType(), "fileUrl", md.getFileUrl(), "caption", md.getCaption() == null ? "" : md.getCaption()
        )).collect(Collectors.toList()));
        return m;
    }
}

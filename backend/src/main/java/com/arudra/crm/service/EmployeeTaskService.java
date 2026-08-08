package com.arudra.crm.service;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.dto.workforce.AssignResourceRequest;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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

    private static final List<String> ACTIVE_ASSIGNMENT_STATUSES =
            List.of("ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED", "WAITING_MATERIAL", "REWORK", "COMPLETED");

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

    public Map<String, Object> getTaskDetail(Long taskId, User employee) {
        Task task = getTask(taskId);
        Map<String, Object> detail = toCard(task, employee != null ? employee.getId() : null);

        detail.put("description", task.getDescription());
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
        TaskAssignment a = getAssignment(taskId, employee.getId());
        a.setStatus("COMPLETED");
        a.setCompletedAt(LocalDateTime.now());
        if (remarks != null) a.setRemarks(remarks);
        assignmentRepository.save(a);
        Task task = a.getTask();

        // Notify the people who track delivery: the project manager and the admins.
        String title = "Task Completed";
        String message = employee.getName() + " completed \"" + task.getTaskName() + "\"";
        for (Long mgr : managersForTask(task)) {
            notificationService.dispatch(title, message, "TASK", mgr, "/tasks");
        }
        notificationService.dispatchToAdmins(title, message, "TASK", "/tasks", employee.getId());

        return recomputeAndSave(task);
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

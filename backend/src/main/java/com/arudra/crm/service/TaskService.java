package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TaskService {

    @Autowired @org.springframework.context.annotation.Lazy
    private LeadService leadService;

    @Autowired
    private TaskRepository taskRepository;
    
    @Autowired
    private TaskCommentRepository commentRepository;
    
    @Autowired
    private TaskAttachmentRepository attachmentRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ProjectPhaseRepository phaseRepository;

    @Autowired
    private ProjectRoomRepository roomRepository;

    @Autowired
    private ContractorRepository contractorRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskAssignmentRepository taskAssignmentRepository;

    @Autowired
    private TaskChecklistService taskChecklistService;

    @Autowired
    private WorkflowTriggerService workflowTriggerService;

    /** Compact assignment list for the desktop Tasks dialog — deliberately not the raw entity (avoids dumping the full User->roles->permissions graph). */
    public List<Task> getTasksByProject(Long projectId) {
        return taskRepository.findByProjectId(projectId);
    }

    public List<Map<String, Object>> getAssignments(Long taskId) {
        return taskAssignmentRepository.findByTaskId(taskId).stream()
                .map(a -> Map.<String, Object>of(
                        "employeeId", a.getEmployee() != null ? a.getEmployee().getId() : 0L,
                        "employeeName", a.getEmployee() != null ? a.getEmployee().getName() : "Unknown",
                        "role", a.getRole() == null ? "" : a.getRole(),
                        "status", a.getStatus()
                ))
                .toList();
    }

    public Page<Task> getTasks(String search, int page, int size) {
        // Order by orderIndex for Kanban support, then by id descending
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("orderIndex").ascending().and(Sort.by("id").descending()));
        if (search != null && !search.isEmpty()) {
            return taskRepository.searchTasks(search, pageRequest);
        }
        return taskRepository.findAll(pageRequest);
    }
    
    // For Kanban view without pagination
    public List<Task> getAllTasks() {
        return taskRepository.findAll(Sort.by("orderIndex").ascending().and(Sort.by("id").descending()));
    }

    public Task getTaskById(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new RuntimeException("Task not found"));
    }
    
    public Map<String, Object> getTaskDetails(Long id) {
        Task task = getTaskById(id);
        List<TaskComment> comments = commentRepository.findByTaskIdOrderByCreatedAtDesc(id);
        List<TaskAttachment> attachments = attachmentRepository.findByTaskId(id);
        
        return Map.of(
            "task", task,
            "comments", comments,
            "attachments", attachments
        );
    }

    public Task createTask(Task task) {
        if (task.getParentTask() != null && task.getParentTask().getId() != null) {
            task.setParentTask(getTaskById(task.getParentTask().getId()));
        }
        Task savedTask = taskRepository.save(task);

        // Seed a basic, trade-aware checklist so whoever is assigned immediately knows the work steps.
        taskChecklistService.ensureDefaultChecklist(savedTask);

        // Trigger Notification
        if (savedTask.getAssignedEmployee() != null) {
            notificationService.dispatch(
                "New Task Assigned",
                "You have been assigned to: " + savedTask.getTaskName(),
                "TASK",
                savedTask.getAssignedEmployee().getId(),
                "/tasks/" + savedTask.getId()
            );
        }
        
        return savedTask;
    }

    /** Set a task's completion percent (handover flow) and derive its status. */
    public Task updateTaskProgress(Long id, Integer progress, String stage) {
        Task task = getTaskById(id);
        if (progress != null) {
            int p = Math.max(0, Math.min(100, progress));
            task.setProgress(p);
            if (p >= 100) {
                task.setStatus("COMPLETED");
                if (task.getCompletedDate() == null) task.setCompletedDate(java.time.LocalDate.now());
            } else if (p > 0) {
                task.setStatus("IN_PROGRESS");
                task.setCompletedDate(null);
            } else {
                task.setStatus("PENDING");
                task.setCompletedDate(null);
            }
        }
        if (stage != null && !stage.isBlank()) task.setStage(stage);
        return taskRepository.save(task);
    }

    public Task updateTask(Long id, Task taskDetails) {
        Task task = getTaskById(id);
        String previousStatus = task.getStatus();
        task.setTaskName(taskDetails.getTaskName());
        task.setDescription(taskDetails.getDescription());
        task.setProject(taskDetails.getProject());
        task.setAssignedEmployee(taskDetails.getAssignedEmployee());
        task.setStartDate(taskDetails.getStartDate());
        task.setDueDate(taskDetails.getDueDate());
        task.setStatus(taskDetails.getStatus());
        task.setPriority(taskDetails.getPriority());
        task.setIsRecurring(taskDetails.getIsRecurring());
        task.setRecurringPattern(taskDetails.getRecurringPattern());
        task.setEstimatedHours(taskDetails.getEstimatedHours());
        task.setActualHours(taskDetails.getActualHours());
        task.setRequiredSkills(taskDetails.getRequiredSkills());
        task.setOrderIndex(taskDetails.getOrderIndex());
        
        // Handle subtasks
        if (taskDetails.getParentTask() != null && taskDetails.getParentTask().getId() != null) {
            task.setParentTask(getTaskById(taskDetails.getParentTask().getId()));
        } else {
            task.setParentTask(null);
        }

        Task saved = taskRepository.save(task);
        if (!"COMPLETED".equals(previousStatus) && "COMPLETED".equals(saved.getStatus())) {
            workflowTriggerService.onTaskCompleted(saved);
        }
        return saved;
    }

    public void updateTaskStatusAndOrder(Long id, String status, Integer orderIndex) {
        Task task = getTaskById(id);
        String previousStatus = task.getStatus();
        task.setStatus(status);
        task.setOrderIndex(orderIndex);
        Task saved = taskRepository.save(task);
        if (!"COMPLETED".equals(previousStatus) && "COMPLETED".equals(status)) {
            workflowTriggerService.onTaskCompleted(saved);
        }
    }

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    /** Tables holding money records — a task linked to one of these can be cancelled but never deleted. */
    private static final java.util.regex.Pattern FINANCIAL_TABLE = java.util.regex.Pattern.compile(
            "(?i).*(payment|invoice|ledger|salary|payslip|expense|bonus|incentive|refund|receipt|bill).*");

    /**
     * Deletes the task together with everything that hangs off it (assignments, checklists, comments,
     * time logs, issues, media…), so it vanishes for the admin and for every assigned employee. Links
     * from other tasks (sub-tasks, dependencies) are detached rather than deleted. Refuses when money
     * records point at the task.
     */
    @org.springframework.transaction.annotation.Transactional
    public void deleteTask(Long id) {
        getTaskById(id); // 404 when it doesn't exist
        List<String> blocked = new java.util.ArrayList<>();
        collectFinancialLinks("tasks", List.of(id), blocked, 0);
        if (!blocked.isEmpty()) {
            throw new IllegalStateException("This task has linked financial records (" + String.join(", ", blocked)
                    + ") and can't be deleted. Cancel it instead.");
        }
        removeReferencing("tasks", List.of(id), 0);
        jdbc.update("DELETE FROM tasks WHERE id = ?", id);
    }

    private record Fk(String table, String column, boolean nullable) {}

    private List<Fk> referrers(String parentTable) {
        return jdbc.query(
                "SELECT k.TABLE_NAME, k.COLUMN_NAME, c.IS_NULLABLE FROM information_schema.KEY_COLUMN_USAGE k "
                        + "JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME "
                        + "AND c.COLUMN_NAME = k.COLUMN_NAME "
                        + "WHERE k.REFERENCED_TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME = ?",
                (rs, i) -> new Fk(rs.getString(1), rs.getString(2), "YES".equalsIgnoreCase(rs.getString(3))), parentTable);
    }

    private static String in(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
    }

    private boolean hasIdColumn(String table) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'id'",
                Integer.class, table);
        return n != null && n > 0;
    }

    /** Dry run: names of money tables that would lose rows (through any depth of cascade). */
    private void collectFinancialLinks(String parent, List<Long> ids, List<String> out, int depth) {
        if (ids.isEmpty() || depth > 6) return;
        for (Fk fk : referrers(parent)) {
            if (fk.table().equals(parent) || fk.nullable()) continue; // nullable links are detached, not deleted
            List<Long> childIds = hasIdColumn(fk.table())
                    ? jdbc.queryForList("SELECT id FROM " + fk.table() + " WHERE " + fk.column() + " IN (" + in(ids) + ")", Long.class)
                    : List.of();
            Integer rows = jdbc.queryForObject("SELECT COUNT(*) FROM " + fk.table() + " WHERE " + fk.column() + " IN (" + in(ids) + ")", Integer.class);
            if (rows != null && rows > 0 && FINANCIAL_TABLE.matcher(fk.table()).matches() && !out.contains(fk.table())) out.add(fk.table());
            collectFinancialLinks(fk.table(), childIds, out, depth + 1);
        }
    }

    private void removeReferencing(String parent, List<Long> ids, int depth) {
        if (ids.isEmpty() || depth > 6) return;
        for (Fk fk : referrers(parent)) {
            String where = fk.column() + " IN (" + in(ids) + ")";
            if (fk.nullable() || fk.table().equals(parent)) {
                jdbc.update("UPDATE " + fk.table() + " SET " + fk.column() + " = NULL WHERE " + where);
                continue;
            }
            if (hasIdColumn(fk.table())) {
                List<Long> childIds = jdbc.queryForList("SELECT id FROM " + fk.table() + " WHERE " + where, Long.class);
                removeReferencing(fk.table(), childIds, depth + 1);
            }
            jdbc.update("DELETE FROM " + fk.table() + " WHERE " + where);
        }
    }

    /**
     * Focused edit for the project task board — updates only the human-editable fields
     * (name, priority, due date, description, and optionally status), leaving the project,
     * assignment, order and workflow links intact. Unlike {@link #updateTask}, a partial
     * body will not null out the untouched columns.
     */
    public Task editTaskBasics(Long id, String taskName, String priority, String status,
                               java.time.LocalDate dueDate, String description) {
        Task task = getTaskById(id);
        String previousStatus = task.getStatus();
        if (taskName != null && !taskName.isBlank()) task.setTaskName(taskName);
        if (priority != null) task.setPriority(priority);
        if (status != null) task.setStatus(status);
        if (dueDate != null) task.setDueDate(dueDate);
        if (description != null) task.setDescription(description);
        Task saved = taskRepository.save(task);
        if (!"COMPLETED".equals(previousStatus) && "COMPLETED".equals(saved.getStatus())) {
            workflowTriggerService.onTaskCompleted(saved);
        }
        return saved;
    }
    
    public TaskComment addComment(Long taskId, TaskComment comment, User user) {
        Task task = getTaskById(taskId);
        comment.setTask(task);
        comment.setAuthor(user);
        TaskComment saved = commentRepository.save(comment);
        // A note on a lead's task also lands in the lead's Notes, so the office sees it on the lead page.
        if (task.getLeadId() != null && comment.getContent() != null && !comment.getContent().isBlank()) {
            try {
                boolean voiceOnly = comment.getAudioUrl() != null && comment.getContent().trim().endsWith("Voice note");
                String text = voiceOnly ? "Voice note added (play it on the task)" : comment.getContent().trim();
                leadService.addNote(task.getLeadId(), "[" + task.getTaskName() + "] " + text, user);
            } catch (Exception ignored) { /* the task note is saved either way */ }
        }
        return saved;
    }
    
    public TaskAttachment addAttachment(Long taskId, TaskAttachment attachment) {
        Task task = getTaskById(taskId);
        attachment.setTask(task);
        return attachmentRepository.save(attachment);
    }

    /** Assigns a task's phase/room/contractor/employee in one call, firing a task-assigned notification. */
    public Task assignTask(Long taskId, Long phaseId, Long roomId, Long contractorId, Long employeeId) {
        Task task = getTaskById(taskId);

        if (phaseId != null) {
            task.setPhase(phaseRepository.findById(phaseId)
                    .orElseThrow(() -> new RuntimeException("Project phase not found")));
        }
        if (roomId != null) {
            task.setRoom(roomRepository.findById(roomId)
                    .orElseThrow(() -> new RuntimeException("Project room not found")));
        }
        if (contractorId != null) {
            task.setContractor(contractorRepository.findById(contractorId)
                    .orElseThrow(() -> new RuntimeException("Contractor not found")));
        }
        if (employeeId != null) {
            task.setAssignedEmployee(userRepository.findById(employeeId)
                    .orElseThrow(() -> new RuntimeException("Employee not found")));
        }

        Task saved = taskRepository.save(task);

        if (saved.getAssignedEmployee() != null) {
            notificationService.dispatch(
                    "Task Assigned",
                    "You have been assigned to: " + saved.getTaskName(),
                    "TASK",
                    saved.getAssignedEmployee().getId(),
                    "/tasks/" + saved.getId());
        }

        return saved;
    }

    public Task addDependency(Long taskId, Long dependsOnTaskId) {
        Task task = getTaskById(taskId);
        Task dependsOn = getTaskById(dependsOnTaskId);
        task.getDependencies().add(dependsOn);
        return taskRepository.save(task);
    }

    public Task removeDependency(Long taskId, Long dependsOnTaskId) {
        Task task = getTaskById(taskId);
        task.getDependencies().removeIf(d -> d.getId().equals(dependsOnTaskId));
        return taskRepository.save(task);
    }
}

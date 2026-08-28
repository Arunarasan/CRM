package com.arudra.crm.service;

import com.arudra.crm.entity.Project;
import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.TaskAssignment;
import com.arudra.crm.repository.TaskAssignmentRepository;
import com.arudra.crm.repository.TaskRepository;
import com.arudra.crm.repository.TaskTimeLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Admin/supervisor exception console (spec §44): a single read of the task landscape — what's
 * available, in progress, blocked, overdue, unassigned and done today — plus per-employee capacity,
 * projects at risk and the time-approval backlog. Admins act on exceptions here (extend, reprioritise,
 * return to pool, cancel); routine work stays self-service. Reuses existing task/assignment state.
 */
@Service
public class WorkflowConsoleService {

    private static final List<String> ACTIVE_ASSIGNMENT_STATUSES =
            List.of("ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED", "WAITING_MATERIAL", "REWORK");
    private static final Set<String> CLOSED = Set.of("COMPLETED", "CANCELLED");
    private static final int LIST_CAP = 100;

    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private TaskTimeLogRepository timeLogRepository;
    @Autowired private EmployeeTaskService employeeTaskService;

    public Map<String, Object> overview() {
        LocalDate today = LocalDate.now();
        List<Task> tasks = taskRepository.findAll().stream()
                .filter(t -> !Boolean.TRUE.equals(t.getIsDeleted()))
                .toList();

        // Active assignments once, indexed by task id, so "unassigned" and capacity are cheap.
        List<TaskAssignment> activeAssignments = assignmentRepository.findAll().stream()
                .filter(a -> !Boolean.TRUE.equals(a.getIsDeleted()))
                .filter(a -> ACTIVE_ASSIGNMENT_STATUSES.contains(a.getStatus()))
                .toList();
        Set<Long> assignedTaskIds = activeAssignments.stream()
                .filter(a -> a.getTask() != null).map(a -> a.getTask().getId()).collect(Collectors.toSet());

        List<Task> available = tasks.stream().filter(t -> "AVAILABLE".equals(t.getStatus())).toList();
        List<Task> inProgress = tasks.stream().filter(t -> "IN_PROGRESS".equals(t.getStatus())).toList();
        List<Task> blocked = tasks.stream()
                .filter(t -> "WAITING_MATERIAL".equals(t.getStatus()) || "REWORK".equals(t.getStatus())).toList();
        List<Task> overdue = tasks.stream().filter(t -> isOverdue(t, today)).toList();
        List<Task> unassigned = tasks.stream()
                .filter(t -> !CLOSED.contains(t.getStatus()) && !"LOCKED".equals(t.getStatus()))
                .filter(t -> !assignedTaskIds.contains(t.getId())).toList();
        List<Task> completedToday = tasks.stream().filter(t -> today.equals(t.getCompletedDate())).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("counts", Map.of(
                "available", available.size(),
                "inProgress", inProgress.size(),
                "blocked", blocked.size(),
                "overdue", overdue.size(),
                "unassigned", unassigned.size(),
                "completedToday", completedToday.size()));
        out.put("available", cards(available));
        out.put("inProgress", cards(inProgress));
        out.put("blocked", cards(blocked));
        out.put("overdue", cards(overdue));
        out.put("unassigned", cards(unassigned));
        out.put("employeeCapacity", employeeCapacity(activeAssignments));
        out.put("projectsAtRisk", projectsAtRisk(tasks, overdue, today));
        out.put("pendingTimeApprovals", timeLogRepository.findByStatusOrderByIdDesc("SUBMITTED").size());
        return out;
    }

    // ------------------------------------------------------ admin exception actions

    @Transactional
    public Task extendDueDate(Long taskId, LocalDate dueDate) {
        Task t = getTask(taskId);
        t.setDueDate(dueDate);
        return taskRepository.save(t);
    }

    @Transactional
    public Task changePriority(Long taskId, String priority) {
        Task t = getTask(taskId);
        t.setPriority(priority);
        return taskRepository.save(t);
    }

    /** Cancel all active assignments and put the task back in the pool for anyone eligible to pick. */
    @Transactional
    public Task returnToPool(Long taskId) {
        Task t = getTask(taskId);
        for (TaskAssignment a : assignmentRepository.findByTaskId(taskId)) {
            if (!CLOSED.contains(a.getStatus()) && !"REJECTED".equals(a.getStatus())) {
                a.setStatus("CANCELLED");
                assignmentRepository.save(a);
            }
        }
        t.setAssignedEmployee(null);
        t.setStatus("WORKFLOW".equals(t.getSource()) ? "AVAILABLE" : "PENDING");
        return taskRepository.save(t);
    }

    @Transactional
    public Task cancelTask(Long taskId) {
        Task t = getTask(taskId);
        t.setStatus("CANCELLED");
        return taskRepository.save(t);
    }

    // ------------------------------------------------------ helpers

    private Task getTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new RuntimeException("Task not found"));
    }

    private boolean isOverdue(Task t, LocalDate today) {
        return t.getDueDate() != null && t.getDueDate().isBefore(today) && !CLOSED.contains(t.getStatus());
    }

    private List<Map<String, Object>> cards(List<Task> tasks) {
        return tasks.stream()
                .sorted(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(LIST_CAP)
                .map(this::toCard).collect(Collectors.toList());
    }

    private Map<String, Object> toCard(Task t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("taskName", t.getTaskName());
        m.put("project", t.getProject() != null ? t.getProject().getProjectName() : null);
        m.put("projectId", t.getProject() != null ? t.getProject().getId() : null);
        m.put("status", t.getStatus());
        m.put("priority", t.getPriority());
        m.put("source", t.getSource());
        m.put("dueDate", t.getDueDate());
        m.put("assignee", t.getAssignedEmployee() != null ? t.getAssignedEmployee().getName() : null);
        return m;
    }

    private List<Map<String, Object>> employeeCapacity(List<TaskAssignment> activeAssignments) {
        int max = employeeTaskService.maxActiveTasks();
        // employeeId -> {name, set of distinct task ids}
        Map<Long, String> names = new LinkedHashMap<>();
        Map<Long, Set<Long>> taskIds = new LinkedHashMap<>();
        for (TaskAssignment a : activeAssignments) {
            if (a.getEmployee() == null || a.getTask() == null) continue;
            Long eid = a.getEmployee().getId();
            names.putIfAbsent(eid, a.getEmployee().getName());
            taskIds.computeIfAbsent(eid, k -> new java.util.HashSet<>()).add(a.getTask().getId());
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Long eid : names.keySet()) {
            int active = taskIds.get(eid).size();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("employeeId", eid);
            row.put("name", names.get(eid));
            row.put("active", active);
            row.put("max", max);
            row.put("atCapacity", active >= max);
            rows.add(row);
        }
        rows.sort(Comparator.comparing((Map<String, Object> r) -> (Integer) r.get("active")).reversed());
        return rows;
    }

    private List<Map<String, Object>> projectsAtRisk(List<Task> tasks, List<Task> overdue, LocalDate today) {
        Map<Long, Map<String, Object>> byProject = new LinkedHashMap<>();
        for (Task t : overdue) {
            Project p = t.getProject();
            if (p == null) continue;
            Map<String, Object> row = byProject.computeIfAbsent(p.getId(), k -> riskRow(p));
            row.put("overdueTasks", (Integer) row.get("overdueTasks") + 1);
        }
        // Projects past their end date but not completed also count as at-risk.
        for (Task t : tasks) {
            Project p = t.getProject();
            if (p == null || byProject.containsKey(p.getId())) continue;
            if (p.getEndDate() != null && p.getEndDate().isBefore(today)
                    && !CLOSED.contains(String.valueOf(p.getStatus()).toUpperCase())) {
                byProject.put(p.getId(), riskRow(p));
            }
        }
        return new ArrayList<>(byProject.values());
    }

    private Map<String, Object> riskRow(Project p) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("projectId", p.getId());
        row.put("projectName", p.getProjectName());
        row.put("status", p.getStatus());
        row.put("progress", p.getProgress());
        row.put("endDate", p.getEndDate());
        row.put("overdueTasks", 0);
        return row;
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.TaskAssignment;
import com.arudra.crm.repository.TaskAssignmentRepository;
import com.arudra.crm.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * The single source of truth for "is this task still open?". Every place that finishes a task closes it
 * through {@link #close}, so the task, its progress and every assignment always agree — and the employee
 * lists read {@link #lifecycleOf} instead of guessing from a raw status.
 */
@Service
public class TaskLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(TaskLifecycleService.class);

    public static final String ACTIVE = "ACTIVE";
    public static final String SUBMITTED = "SUBMITTED"; // employee finished, waiting for the office
    public static final String DONE = "DONE";
    public static final String CANCELLED = "CANCELLED";

    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private com.arudra.crm.repository.ProjectRepository projectRepository;

    /**
     * Completed project rule: every open task linked to the project, and to the lead it was converted
     * from, moves to COMPLETED. Service & warranty requests are post-completion work and stay open.
     */
    @Transactional
    public int completeAllForProject(Long projectId, Long leadId) {
        java.util.List<Task> tasks = new java.util.ArrayList<>();
        if (projectId != null) tasks.addAll(taskRepository.findByProjectId(projectId));
        if (leadId != null) tasks.addAll(taskRepository.findByLeadId(leadId));
        int n = 0;
        java.util.Set<Long> seen = new java.util.HashSet<>();
        for (Task t : tasks) {
            if (!seen.add(t.getId())) continue;
            if ("COMPLETED".equals(t.getStatus()) || "CANCELLED".equals(t.getStatus())) continue;
            if ("SERVICE_REQUEST".equals(t.getSource())) continue;
            close(t);
            n++;
        }
        return n;
    }

    /** Lifecycle of a task as one employee sees it; their own assignment status wins over the task status. */
    public static String lifecycleOf(Task t, String myAssignmentStatus) {
        String s = t.getStatus() == null ? "" : t.getStatus();
        if ("CANCELLED".equals(s)) return CANCELLED;
        if ("COMPLETED".equals(s)) return DONE;
        if ("COMPLETED".equals(myAssignmentStatus) || "WAITING_APPROVAL".equals(s)) return SUBMITTED;
        return ACTIVE;
    }

    /** Only ACTIVE work counts toward lists, tabs, due-today and overdue. */
    public static boolean isOpenForEmployee(Task t, String myAssignmentStatus) {
        return ACTIVE.equals(lifecycleOf(t, myAssignmentStatus));
    }

    /** Close the task: COMPLETED, 100%, dated, and every live assignment closed with it. Idempotent. */
    @Transactional
    public Task close(Task task) {
        if (task == null) return null;
        if (!"COMPLETED".equals(task.getStatus())) task.setStatus("COMPLETED");
        task.setProgress(100);
        if (task.getCompletedDate() == null) task.setCompletedDate(LocalDate.now());
        Task saved = taskRepository.save(task);
        closeAssignments(saved.getId());
        return saved;
    }

    /** Cancel the task and end every live assignment (they must not linger as open work). */
    @Transactional
    public Task cancel(Task task) {
        task.setStatus("CANCELLED");
        Task saved = taskRepository.save(task);
        for (TaskAssignment a : assignmentRepository.findByTaskId(saved.getId())) {
            if (isLive(a) && !"COMPLETED".equals(a.getStatus())) {
                a.setStatus("CANCELLED");
                assignmentRepository.save(a);
            }
        }
        return saved;
    }

    private void closeAssignments(Long taskId) {
        for (TaskAssignment a : assignmentRepository.findByTaskId(taskId)) {
            if (isLive(a) && !"COMPLETED".equals(a.getStatus())) {
                a.setStatus("COMPLETED");
                if (a.getCompletedAt() == null) a.setCompletedAt(LocalDateTime.now());
                assignmentRepository.save(a);
            }
        }
    }

    private static boolean isLive(TaskAssignment a) {
        return !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus());
    }

    /**
     * Repairs one task so status, progress and assignments agree. Returns true when it changed something.
     * A task whose participants all submitted is parked at WAITING_APPROVAL (never left looking active).
     */
    @Transactional
    public boolean reconcile(Task t) {
        String s = t.getStatus() == null ? "" : t.getStatus();
        List<TaskAssignment> all = assignmentRepository.findByTaskId(t.getId());
        if ("COMPLETED".equals(s)) {
            boolean open = all.stream().anyMatch(a -> isLive(a) && !"COMPLETED".equals(a.getStatus()));
            if (!open && t.getProgress() != null && t.getProgress() >= 100) return false;
            close(t);
            return true;
        }
        if ("CANCELLED".equals(s)) {
            boolean open = all.stream().anyMatch(a -> isLive(a) && !"COMPLETED".equals(a.getStatus()));
            if (!open) return false;
            cancel(t);
            return true;
        }
        if ("WAITING_APPROVAL".equals(s)) return false;
        List<TaskAssignment> live = all.stream().filter(TaskLifecycleService::isLive).toList();
        if (!live.isEmpty() && live.stream().allMatch(a -> "COMPLETED".equals(a.getStatus()))) {
            t.setStatus("WAITING_APPROVAL");
            taskRepository.save(t);
            return true;
        }
        if (t.getProgress() != null && t.getProgress() >= 100 && !"REWORK".equals(s)) {
            close(t);
            return true;
        }
        return false;
    }

    /** Sweep every non-deleted task. Returns how many were repaired. */
    @Transactional
    public int sweep() {
        int fixed = 0;
        for (Task t : taskRepository.findAll()) {
            if (Boolean.TRUE.equals(t.getIsDeleted())) continue;
            try {
                if (reconcile(t)) fixed++;
            } catch (Exception e) {
                log.warn("Task lifecycle sweep skipped task {}: {}", t.getId(), e.getMessage());
            }
        }
        // Completed projects: any task still open on the project or its source lead is completed.
        for (com.arudra.crm.entity.Project p : projectRepository.findByStatus("COMPLETED")) {
            try {
                fixed += completeAllForProject(p.getId(), p.getLead() != null ? p.getLead().getId() : null);
            } catch (Exception e) {
                log.warn("Task sweep skipped completed project {}: {}", p.getId(), e.getMessage());
            }
        }
        if (fixed > 0) log.info("Task lifecycle sweep repaired {} task(s)", fixed);
        return fixed;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void sweepOnStartup() {
        try { sweep(); } catch (Exception e) { log.warn("Startup task sweep failed: {}", e.getMessage()); }
    }

    @Scheduled(cron = "0 30 2 * * *")
    public void nightlySweep() {
        try { sweep(); } catch (Exception e) { log.warn("Nightly task sweep failed: {}", e.getMessage()); }
    }
}

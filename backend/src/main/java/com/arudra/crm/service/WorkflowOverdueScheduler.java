package com.arudra.crm.service;

import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.TaskAssignment;
import com.arudra.crm.repository.TaskAssignmentRepository;
import com.arudra.crm.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Daily overdue management (spec §26). Nudges the owner(s) of an overdue task and, once it has been
 * overdue past the escalation window, escalates to the project manager and admins. Unowned overdue
 * pool tasks are surfaced to admins so someone reassigns them. Uses {@code dispatchIfAbsent} so a
 * task that stays overdue doesn't generate a fresh alert every morning. Never mutates task status —
 * overdue is a derived state, not a stored one.
 */
@Component
public class WorkflowOverdueScheduler {

    private static final Logger log = LoggerFactory.getLogger(WorkflowOverdueScheduler.class);

    /** Days overdue before an owned task is escalated to management. Configurable later. */
    private static final long ESCALATION_DAYS = 2;

    private static final List<String> ACTIVE_ASSIGNMENT_STATUSES =
            List.of("ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED", "WAITING_MATERIAL", "REWORK");

    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private NotificationService notificationService;

    @Scheduled(cron = "0 15 8 * * *")
    public void escalateOverdueTasks() {
        LocalDate today = LocalDate.now();
        List<Task> overdue = taskRepository.findOverdue(today);
        int nudged = 0, escalated = 0, orphaned = 0;

        for (Task task : overdue) {
            long daysOver = ChronoUnit.DAYS.between(task.getDueDate(), today);
            String url = task.getProject() != null ? "/projects/" + task.getProject().getId() : "/tasks";

            List<TaskAssignment> owners = assignmentRepository.findByTaskId(task.getId()).stream()
                    .filter(a -> a.getEmployee() != null && ACTIVE_ASSIGNMENT_STATUSES.contains(a.getStatus()))
                    .toList();

            if (owners.isEmpty()) {
                // Nobody is working it — alert admins to reassign/return to pool.
                notificationService.dispatchToAdmins("Overdue task unassigned",
                        "\"" + task.getTaskName() + "\" is " + daysOver + " day(s) overdue and unassigned.",
                        "TASK", url, null);
                orphaned++;
                continue;
            }

            for (TaskAssignment a : owners) {
                notificationService.dispatchIfAbsent("Task overdue",
                        "\"" + task.getTaskName() + "\" was due " + task.getDueDate() + ".",
                        "TASK", a.getEmployee().getId(), "/employee/tasks/" + task.getId());
                nudged++;
            }

            if (daysOver >= ESCALATION_DAYS) {
                if (task.getProject() != null && task.getProject().getProjectManager() != null) {
                    notificationService.dispatchIfAbsent("Task overdue — escalation",
                            "\"" + task.getTaskName() + "\" is " + daysOver + " day(s) overdue.",
                            "TASK", task.getProject().getProjectManager().getId(), url);
                }
                notificationService.dispatchToAdmins("Task overdue — escalation",
                        "\"" + task.getTaskName() + "\" is " + daysOver + " day(s) overdue.", "TASK", url, null);
                escalated++;
            }
        }

        log.info("Overdue escalation: {} overdue tasks — {} owner nudges, {} escalations, {} unassigned alerts",
                overdue.size(), nudged, escalated, orphaned);
    }
}

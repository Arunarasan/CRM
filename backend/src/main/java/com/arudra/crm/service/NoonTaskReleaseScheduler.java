package com.arudra.crm.service;

import com.arudra.crm.entity.ResourceType;
import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.TaskAssignment;
import com.arudra.crm.repository.TaskAssignmentRepository;
import com.arudra.crm.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Set;

/**
 * Daily 12:00 reset: every task still assigned to an employee (not started, in progress or paused)
 * is taken back and left unassigned, so the office re-assigns the afternoon's work. Employees can't
 * pick tasks themselves, so nothing is reclaimed until the office assigns it again. Finished work
 * (completed / waiting approval) and contractor assignments are untouched.
 *
 * <p>Each assignment is released in its own transaction — one failure must not stop the rest.
 */
@Component
public class NoonTaskReleaseScheduler {

    private static final Logger log = LoggerFactory.getLogger(NoonTaskReleaseScheduler.class);

    private static final Set<String> OPEN_ASSIGNMENT = Set.of(
            "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED", "WAITING_MATERIAL", "REWORK");

    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private EmployeeTaskService employeeTaskService;
    @Autowired private PlatformTransactionManager transactionManager;

    @Value("${app.tasks.noon-release-enabled:true}")
    private boolean enabled;

    @Scheduled(cron = "${app.tasks.noon-release-cron:0 0 12 * * *}", zone = "${app.tasks.noon-release-zone:Asia/Kolkata}")
    public void releaseAll() {
        if (!enabled) return;
        TransactionTemplate tx = new TransactionTemplate(transactionManager);

        // (taskId, employeeUserId) pairs — read in a short transaction so lazy task proxies resolve.
        List<long[]> open = tx.execute(s -> assignmentRepository.findByStatusIn(List.copyOf(OPEN_ASSIGNMENT)).stream()
                .filter(a -> ResourceType.EMPLOYEE.equals(a.getResourceType()))
                .filter(a -> a.getTask() != null
                        && !"COMPLETED".equals(a.getTask().getStatus()) && !"CANCELLED".equals(a.getTask().getStatus()))
                .map(a -> new long[]{a.getTask().getId(), a.getResourceId()})
                .toList());
        if (open == null || open.isEmpty()) return;

        int released = 0;
        for (long[] pair : open) {
            try {
                tx.executeWithoutResult(s -> release(pair[0], pair[1]));
                released++;
            } catch (Exception e) {
                log.error("Noon release failed for task {} / employee {}", pair[0], pair[1], e);
            }
        }
        log.info("Noon release: took {} task assignment(s) back from employees", released);
    }

    private void release(Long taskId, Long employeeId) {
        employeeTaskService.removeResourceAssignment(taskId, ResourceType.EMPLOYEE, employeeId);
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null || "COMPLETED".equals(task.getStatus()) || "CANCELLED".equals(task.getStatus())) return;
        boolean stillHeld = assignmentRepository.findByTaskId(taskId).stream()
                .anyMatch(x -> !"CANCELLED".equals(x.getStatus()) && !"REJECTED".equals(x.getStatus()));
        if (!stillHeld) {
            // Same pool states the board reads: work tasks wait PENDING, workflow tasks AVAILABLE.
            task.setStatus(isWorkTask(task) ? "PENDING" : "AVAILABLE");
            taskRepository.save(task);
        }
    }

    private boolean isWorkTask(Task t) {
        String source = t.getSource() == null ? "" : t.getSource().toUpperCase();
        return t.getLeadId() == null
                && (t.getProject() != null || t.getInvoiceId() != null
                    || "BUNDLE".equals(source) || "SERVICE_REQUEST".equals(source));
    }
}

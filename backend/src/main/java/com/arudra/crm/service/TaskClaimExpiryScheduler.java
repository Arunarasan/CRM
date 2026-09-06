package com.arudra.crm.service;

import com.arudra.crm.entity.TaskAssignment;
import com.arudra.crm.repository.TaskAssignmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Enforces the "hold window" on quick data-entry lead tasks (Collect Requirement / Contact-Follow-up /
 * Qualify / Review). A worker who picks up or is assigned one of these gets a short window (default
 * 10 min, {@code assignment_settings.data_entry_hold_minutes}) to actually START it. If they don't,
 * this sweeper releases the claim so the task returns to the shared task board (status → AVAILABLE)
 * for someone else to grab — held work never sits idle blocking the pool.
 *
 * <p>Runs once a minute. The scan here is read-only and cheap (only currently-held assignments); the
 * actual release is delegated to {@link EmployeeTaskService#releaseExpiredHold(Long)}, which row-locks
 * the task and re-verifies every guard, so a task a worker started in the meantime is never yanked.
 * Every release is best-effort — one failure must not stop the rest.
 */
@Component
public class TaskClaimExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(TaskClaimExpiryScheduler.class);

    /** Assignment statuses meaning "claimed but not started" — the only ones eligible for release. */
    private static final List<String> HELD_NOT_STARTED = List.of("ASSIGNED", "ACCEPTED");

    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private EmployeeTaskService employeeTaskService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void releaseExpiredHolds() {
        int holdMinutes = employeeTaskService.dataEntryHoldMinutes();
        if (holdMinutes <= 0) return; // feature disabled

        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(holdMinutes);
        Set<Long> candidateTaskIds = new HashSet<>();
        for (TaskAssignment a : assignmentRepository.findByStatusIn(HELD_NOT_STARTED)) {
            if (a.getTask() == null || a.getStartedAt() != null) continue;
            LocalDateTime claimed = "ACCEPTED".equals(a.getStatus()) && a.getAcceptedAt() != null
                    ? a.getAcceptedAt() : a.getAssignedDate();
            if (claimed == null || claimed.isAfter(cutoff)) continue; // still within the window
            if (!employeeTaskService.isDataEntryLeadTask(a.getTask())) continue;
            candidateTaskIds.add(a.getTask().getId());
        }

        int released = 0;
        for (Long taskId : candidateTaskIds) {
            try {
                if (employeeTaskService.releaseExpiredHold(taskId)) released++;
            } catch (Exception e) {
                log.error("Failed to auto-release held data-entry task {}", taskId, e);
            }
        }
        if (released > 0) {
            log.info("Auto-released {} data-entry task(s) back to the board after {} min hold",
                    released, holdMinutes);
        }
    }
}

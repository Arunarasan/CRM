package com.arudra.crm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

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

    @Autowired private EmployeeTaskService employeeTaskService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void releaseExpiredHolds() {
        int holdMinutes = employeeTaskService.dataEntryHoldMinutes();
        if (holdMinutes <= 0) return; // feature disabled

        // The scan runs inside its own read-only transaction (in EmployeeTaskService) so the lazy
        // Task/TaskTemplate proxies on each held assignment can initialize. The release loop below
        // stays non-transactional so releaseExpiredHold() opens its own read-write transaction.
        Set<Long> candidateTaskIds = employeeTaskService.findExpiredHoldTaskIds(HELD_NOT_STARTED, holdMinutes);

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

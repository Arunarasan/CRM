package com.arudra.crm.service;

import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Pings the field workforce the moment a task becomes pickable, so auto-generated pool work doesn't
 * sit unseen. A "new task available" notification goes to every eligible, active employee — the same
 * eligibility gate that governs {@link EmployeeTaskService#getAvailablePool}, so a worker is only
 * told about tasks they could actually pick.
 *
 * <p>Kept as its own light component (depends only on user lookup + eligibility + notifications) so
 * the task-generation and dependency services can call it without forming a dependency cycle with
 * {@link EmployeeTaskService}. Every entry point is best-effort — a notification hiccup must never
 * break task generation or workflow advancement.
 */
@Service
public class TaskPoolNotifier {

    private static final Logger log = LoggerFactory.getLogger(TaskPoolNotifier.class);

    @Autowired private UserRepository userRepository;
    @Autowired private TaskEligibilityService taskEligibilityService;
    @Autowired private NotificationService notificationService;

    /** Deep link to the mobile pool's "Available" tab. */
    private static final String POOL_LINK = "/employee/tasks?tab=AVAILABLE";

    /**
     * Notify every eligible, active, non-admin employee that {@code task} is now pickable. No-op
     * unless the task is actually in the pool (status AVAILABLE) — LOCKED/assigned/closed tasks
     * never trigger a "come pick this" ping.
     */
    public void notifyEligibleEmployees(Task task) {
        if (task == null || !"AVAILABLE".equals(task.getStatus())) return;
        try {
            String title = "New task available";
            String message = "\"" + task.getTaskName() + "\" is open to pick up"
                    + (task.getProject() != null ? " on " + task.getProject().getProjectName() : "") + ".";
            for (User user : userRepository.findAll()) {
                if (!user.isAccountNonLocked()) continue;   // skip disabled accounts
                if (isAdmin(user)) continue;                // admins bypass eligibility; don't spam them
                if (!taskEligibilityService.isEligible(user, task)) continue;
                notificationService.dispatch(title, message, "TASK", user.getId(), POOL_LINK);
            }
        } catch (Exception e) {
            // Never let a notification failure break task generation / workflow advancement.
            log.error("Failed to notify employees about available task {}", task.getId(), e);
        }
    }

    private boolean isAdmin(User user) {
        return user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> r != null && "ROLE_ADMIN".equalsIgnoreCase(r.getName()));
    }
}

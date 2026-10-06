package com.arudra.crm.service;

import com.arudra.crm.entity.PaymentSchedule;
import com.arudra.crm.entity.Project;
import com.arudra.crm.entity.ProjectActivityLog;
import com.arudra.crm.event.ProjectProgressChangedEvent;
import com.arudra.crm.repository.PaymentScheduleRepository;
import com.arudra.crm.repository.ProjectActivityLogRepository;
import com.arudra.crm.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;

import java.util.List;

/**
 * Watches work progress against the payment plan. It never raises invoices — a person raises each
 * milestone's invoice from the project's Commercial screen. Its only job is the one-shot alert when a
 * project is 100% done and every payment milestone is paid.
 *
 * Runs AFTER the progress-update transaction commits, in its own REQUIRES_NEW transaction, so a
 * notification hiccup can never roll back the progress rollup.
 */
@Service
public class ProjectBillingAutomationService {

    @Autowired private ProjectRepository projectRepository;
    @Autowired private PaymentScheduleRepository scheduleRepository;
    @Autowired private FinanceService financeService;
    @Autowired private NotificationService notificationService;
    @Autowired private ProjectActivityLogRepository activityLogRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onProgressChanged(ProjectProgressChangedEvent event) {
        Project project = projectRepository.findById(event.getProjectId()).orElse(null);
        if (project == null) return;

        int progress = project.getProgress() == null ? 0 : project.getProgress();
        List<PaymentSchedule> schedules =
                scheduleRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(project.getId());
        if (schedules.isEmpty()) return;

        maybeNotifyFullySettled(project, schedules, progress);
    }

    /** One-shot alert when the project is 100% done AND every stage is fully paid. Notify only — no auto-close. */
    private void maybeNotifyFullySettled(Project project, List<PaymentSchedule> schedules, int progress) {
        if (progress < 100 || project.isSettlementNotified()) return;
        boolean allPaid = schedules.stream().allMatch(s -> "PAID".equalsIgnoreCase(s.getStatus()));
        if (!allPaid) return;

        project.setSettlementNotified(true);
        projectRepository.save(project);

        String title = "Project fully completed & fully paid";
        String msg = project.getProjectName() + " is 100% complete and every payment milestone is settled.";
        if (project.getProjectManager() != null) {
            notificationService.dispatch(title, msg, "PROJECT", project.getProjectManager().getId(),
                    "/projects/" + project.getId());
        }
        notificationService.dispatchToAdmins(title, msg, "PROJECT", "/projects/" + project.getId(), null);
        financeService.notifyFinanceUsers(title, msg, "PROJECT", "/projects/" + project.getId());
        logActivity(project, "Project reached 100% work and 100% collection — fully settled.");
    }

    private void logActivity(Project project, String description) {
        try {
            ProjectActivityLog log = new ProjectActivityLog();
            log.setProject(project);
            log.setRole("System");
            log.setDescription(description);
            activityLogRepository.save(log);
        } catch (Exception ignored) {
            // audit log is best-effort; never let it break the automation
        }
    }
}

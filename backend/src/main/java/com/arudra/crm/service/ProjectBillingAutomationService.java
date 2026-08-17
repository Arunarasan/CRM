package com.arudra.crm.service;

import com.arudra.crm.entity.Invoice;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Links work-progress milestones to the payment plan. When a project's rolled-up work % crosses a
 * payment stage's {@code triggerPercentage}, that stage's invoice is auto-raised and marked DUE, and
 * finance + the PM are notified. A human still confirms the actual money received (Mark Paid) — the
 * automation never records a payment as collected.
 *
 * Runs AFTER the progress-update transaction commits, in its own REQUIRES_NEW transaction, so a
 * billing hiccup (e.g. a project with no customer yet) can never roll back the progress rollup.
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

        if (project.isAutoBillingEnabled()) {
            for (PaymentSchedule s : schedules) {
                if (shouldAutoBill(s, progress)) {
                    autoRaise(project, s);
                }
            }
        }

        maybeNotifyFullySettled(project, schedules, progress);
    }

    /** A stage auto-bills once when work reaches its trigger %, if it's still un-invoiced. */
    private boolean shouldAutoBill(PaymentSchedule s, int progress) {
        if (s.getTriggerPercentage() == null) return false;      // not progress-driven
        if (s.isAutoTriggered()) return false;                    // already handled
        if (!"PENDING".equalsIgnoreCase(s.getStatus())) return false; // already invoiced/paid manually
        boolean liveInvoice = s.getInvoice() != null && !"CANCELLED".equalsIgnoreCase(s.getInvoice().getStatus());
        if (liveInvoice) return false;
        return BigDecimal.valueOf(progress).compareTo(s.getTriggerPercentage()) >= 0;
    }

    private void autoRaise(Project project, PaymentSchedule s) {
        try {
            Invoice invoice = financeService.generateStageInvoice(s.getId());
            // generateStageInvoice already linked the invoice and set the stage to INVOICED;
            // flag it so the automation never revisits this stage.
            s.setAutoTriggered(true);
            s.setAutoTriggeredDate(LocalDate.now());
            scheduleRepository.save(s);

            String amount = "₹" + (s.getAmount() == null ? "0" : s.getAmount().toPlainString());
            String stage = prettyStage(s.getStage());
            financeService.notifyFinanceUsers(
                    "Auto-billed: " + stage,
                    project.getProjectName() + " reached " + project.getProgress() + "% — invoice "
                            + invoice.getInvoiceNumber() + " (" + amount + ") raised and due for " + stage + ".",
                    "INVOICE_GENERATED", "/finance/invoices/" + invoice.getId());

            if (project.getProjectManager() != null) {
                notificationService.dispatch(
                        "Payment milestone due: " + stage,
                        project.getProjectName() + " hit " + project.getProgress()
                                + "% — the " + stage + " invoice (" + amount + ") was raised automatically.",
                        "PROJECT", project.getProjectManager().getId(), "/projects/" + project.getId());
            }
            logActivity(project, "Auto-billing: work reached " + project.getProgress()
                    + "%, raised invoice " + invoice.getInvoiceNumber() + " for " + stage + " (" + amount + ").");
        } catch (Exception ex) {
            // Non-fatal: the stage stays PENDING and will be retried on the next progress change.
            // Common cause: the project has no linked customer to invoice yet.
            logActivity(project, "Auto-billing skipped for " + prettyStage(s.getStage())
                    + " at " + project.getProgress() + "%: " + ex.getMessage());
        }
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

    private String prettyStage(String stage) {
        if (stage == null) return "stage";
        return stage.replace('_', ' ').toLowerCase();
    }
}

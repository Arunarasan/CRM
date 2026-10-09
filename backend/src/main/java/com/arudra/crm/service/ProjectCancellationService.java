package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Cancel a project at any stage before completion. The customer's advance can be returned in part
 * (or in full, or not at all) — the refund goes through the normal Refund flow (PENDING → APPROVED →
 * PAID, posted to the customer ledger), linked to the project. On cancellation every open task is
 * cancelled and untouched (nothing-paid) invoices are voided so nothing keeps chasing the customer.
 */
@Service
public class ProjectCancellationService {

    private static final Set<String> FINAL_STATUSES = Set.of("COMPLETED", "CLOSED", "CANCELLED");
    /** Refunds that are committed (not rejected) — they reduce what can still be refunded. */
    private static final List<String> COMMITTED_REFUNDS = List.of("PENDING", "APPROVED", "PAID");

    @Autowired private ProjectRepository projectRepository;
    @Autowired private CustomerPaymentRepository customerPaymentRepository;
    @Autowired private RefundRepository refundRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private ProjectActivityLogRepository activityLogRepository;
    @Autowired private FinanceService financeService;
    @Autowired private NotificationService notificationService;

    public static class CancelRequest {
        public String reason;
        public BigDecimal refundAmount;
        /** true = the money has already been handed back: approve + mark the refund paid right away. */
        public boolean refundPaidNow;
        public String paymentMethod;
        public String referenceNumber;
    }

    private Project load(Long projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
    }

    /** Money position for the cancel dialog: paid so far, already refunded/requested, still refundable. */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(Long projectId) {
        Project project = load(projectId);
        BigDecimal paid = nz(customerPaymentRepository.sumConfirmedForProject(projectId));
        BigDecimal committed = nz(refundRepository.sumForProject(projectId, COMMITTED_REFUNDS));
        BigDecimal refunded = nz(refundRepository.sumForProject(projectId, List.of("PAID")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", project.getStatus());
        out.put("cancellable", project.getStatus() == null || !FINAL_STATUSES.contains(project.getStatus().toUpperCase()));
        out.put("amountPaid", paid);
        out.put("refundRequested", committed);
        out.put("refunded", refunded);
        out.put("refundable", paid.subtract(committed).max(BigDecimal.ZERO));
        out.put("cancelledAt", project.getCancelledAt());
        out.put("cancellationReason", project.getCancellationReason());
        out.put("refunds", refundRepository.findByProjectIdAndIsDeletedFalseOrderByIdDesc(projectId).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("refundNumber", r.getRefundNumber());
            m.put("amount", r.getAmount());
            m.put("status", r.getStatus());
            m.put("refundDate", r.getRefundDate());
            m.put("paymentMethod", r.getPaymentMethod());
            m.put("reason", r.getReason());
            return m;
        }).toList());
        return out;
    }

    @Transactional
    public Project cancel(Long projectId, CancelRequest req, User user) {
        Project project = load(projectId);
        String status = project.getStatus() == null ? "" : project.getStatus().toUpperCase();
        if (FINAL_STATUSES.contains(status)) {
            throw new IllegalStateException("A " + status.toLowerCase() + " project can't be cancelled.");
        }
        String reason = req == null || req.reason == null ? "" : req.reason.trim();
        if (reason.isEmpty()) throw new IllegalArgumentException("Give a reason for cancelling the project.");

        BigDecimal refund = req.refundAmount == null ? BigDecimal.ZERO : req.refundAmount;
        if (refund.signum() < 0) throw new IllegalArgumentException("Refund amount can't be negative.");
        BigDecimal paid = nz(customerPaymentRepository.sumConfirmedForProject(projectId));
        BigDecimal refundable = paid.subtract(nz(refundRepository.sumForProject(projectId, COMMITTED_REFUNDS))).max(BigDecimal.ZERO);
        if (refund.compareTo(refundable) > 0) {
            throw new IllegalArgumentException("Refund can't exceed the ₹" + refundable.toPlainString()
                    + " the customer has paid (less refunds already raised).");
        }
        if (refund.signum() > 0 && project.getCustomer() == null) {
            throw new IllegalStateException("Project has no customer to refund.");
        }

        // Stop the work: every open task on the project is cancelled.
        int tasksCancelled = 0;
        for (Task t : taskRepository.findByProjectId(projectId)) {
            String ts = t.getStatus() == null ? "" : t.getStatus().toUpperCase();
            if (ts.equals("COMPLETED") || ts.equals("CANCELLED")) continue;
            t.setStatus("CANCELLED");
            taskRepository.save(t);
            tasksCancelled++;
        }

        // Void invoices nothing has been paid against; part-paid ones stay for a credit note.
        int invoicesVoided = 0;
        for (Invoice inv : invoiceRepository.findByProjectId(projectId)) {
            if (Boolean.TRUE.equals(inv.getIsDeleted())) continue;
            if ("PAID".equals(inv.getStatus()) || "CANCELLED".equals(inv.getStatus())) continue;
            if (inv.getAmountPaid() != null && inv.getAmountPaid().signum() > 0) continue;
            financeService.cancelInvoice(inv.getId(), "Project cancelled: " + reason);
            invoicesVoided++;
        }

        project.setStatus("CANCELLED");
        project.setCancelledAt(LocalDateTime.now());
        project.setCancelledBy(user);
        project.setCancellationReason(reason);
        Project saved = projectRepository.save(project);

        Refund created = refund.signum() > 0 ? raiseRefund(saved, refund, reason, req, user) : null;

        StringBuilder desc = new StringBuilder("Project cancelled — ").append(reason);
        if (created != null) {
            desc.append(". Advance refund ₹").append(refund.toPlainString()).append(" of ₹").append(paid.toPlainString())
                .append(" paid (").append(created.getRefundNumber()).append(", ")
                .append("PAID".equals(created.getStatus()) ? "paid out" : "awaiting approval").append(")");
        } else if (paid.signum() > 0) {
            desc.append(". No refund — ₹").append(paid.toPlainString()).append(" advance retained");
        }
        if (tasksCancelled > 0) desc.append(". ").append(tasksCancelled).append(" open task").append(tasksCancelled == 1 ? "" : "s").append(" cancelled");
        if (invoicesVoided > 0) desc.append(", ").append(invoicesVoided).append(" unpaid invoice").append(invoicesVoided == 1 ? "" : "s").append(" voided");
        ProjectActivityLog log = new ProjectActivityLog();
        log.setProject(saved);
        log.setUser(user);
        log.setRole("System");
        log.setDescription(desc.toString());
        activityLogRepository.save(log);

        String name = saved.getCustomer() != null ? saved.getCustomer().getName() : saved.getProjectName();
        notificationService.dispatchToAdmins("Project cancelled",
                name + " — " + reason + (created != null ? " · refund ₹" + refund.toPlainString() + " (" + created.getStatus().toLowerCase() + ")" : ""),
                "PROJECT", "/projects/" + projectId, user != null ? user.getId() : null);
        return saved;
    }

    /**
     * Return (more of) the advance on an already-cancelled project — e.g. the balance is settled
     * later once material costs are known. Same limits: never more than paid less refunds raised.
     */
    @Transactional
    public Refund refundAdvance(Long projectId, CancelRequest req, User user) {
        Project project = load(projectId);
        if (!"CANCELLED".equalsIgnoreCase(project.getStatus())) {
            throw new IllegalStateException("Advance refunds are raised here only for cancelled projects — use Finance → Refunds otherwise.");
        }
        BigDecimal refund = req == null || req.refundAmount == null ? BigDecimal.ZERO : req.refundAmount;
        if (refund.signum() <= 0) throw new IllegalArgumentException("Enter a refund amount.");
        BigDecimal refundable = nz(customerPaymentRepository.sumConfirmedForProject(projectId))
                .subtract(nz(refundRepository.sumForProject(projectId, COMMITTED_REFUNDS))).max(BigDecimal.ZERO);
        if (refund.compareTo(refundable) > 0) {
            throw new IllegalArgumentException("Only ₹" + refundable.toPlainString() + " is left to refund.");
        }
        if (project.getCustomer() == null) throw new IllegalStateException("Project has no customer to refund.");
        String reason = req.reason == null || req.reason.isBlank() ? project.getCancellationReason() : req.reason.trim();
        Refund created = raiseRefund(project, refund, reason, req, user);

        ProjectActivityLog log = new ProjectActivityLog();
        log.setProject(project);
        log.setUser(user);
        log.setRole("System");
        log.setDescription("Advance refund ₹" + refund.toPlainString() + " raised (" + created.getRefundNumber() + ", "
                + ("PAID".equals(created.getStatus()) ? "paid out" : "awaiting approval") + ")");
        activityLogRepository.save(log);
        return created;
    }

    private Refund raiseRefund(Project project, BigDecimal amount, String reason, CancelRequest req, User user) {
        Refund r = new Refund();
        r.setCustomer(project.getCustomer());
        r.setProject(project);
        r.setAmount(amount);
        r.setReason("Advance refund — project " + (project.getProjectCode() != null ? project.getProjectCode() : "#" + project.getId())
                + " cancelled" + (reason == null || reason.isBlank() ? "" : ": " + reason));
        Refund created = financeService.requestRefund(r, user);
        if (req != null && req.refundPaidNow) {
            financeService.decideRefund(created.getId(), true, user);
            created = financeService.markRefundPaid(created.getId(), req.paymentMethod, req.referenceNumber);
        }
        return created;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}

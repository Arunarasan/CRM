package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Close-out settlement: records an agreed price reduction (customer bargaining, compensation, round-off)
 * so a project that will never be collected in full stops showing as pending, optionally completing it.
 * The reduction is never written into the quotation or invoices — open invoices are credited with
 * proper credit notes, and the rest lowers the project's contract value via {@code agreedReduction}.
 */
@Service
public class ProjectSettlementService {

    private static final Set<String> REASONS = Set.of("BARGAINING", "COMPENSATION", "ROUND_OFF", "OTHER");

    @Autowired private ProjectService projectService;
    @Autowired private FinanceService financeService;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private CustomerPaymentRepository customerPaymentRepository;
    @Autowired private ProjectAdjustmentRepository adjustmentRepository;
    @Autowired private ProjectActivityLogRepository activityLogRepository;

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    @Transactional(readOnly = true)
    public Map<String, Object> preview(Long projectId) {
        Project p = projectService.getProjectById(projectId);
        BigDecimal value = p.getQuotation() != null && p.getQuotation().getGrandTotal() != null
                && p.getQuotation().getGrandTotal().signum() > 0 ? p.getQuotation().getGrandTotal() : p.getBudget();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projectId", p.getId());
        out.put("projectName", p.getProjectName());
        out.put("status", p.getStatus());
        out.put("contractValue", nz(value));
        out.put("agreedReduction", nz(p.getAgreedReduction()));
        out.put("paid", nz(customerPaymentRepository.sumConfirmedForProject(projectId)));
        out.put("pending", projectService.pendingOf(projectId));
        List<Map<String, Object>> history = new ArrayList<>();
        for (ProjectAdjustment a : adjustmentRepository.findByProjectIdAndIsDeletedFalseOrderByIdDesc(projectId)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("amount", a.getAmount());
            m.put("reasonCode", a.getReasonCode());
            m.put("reason", a.getReason());
            m.put("at", a.getCreatedAt());
            history.add(m);
        }
        out.put("adjustments", history);
        return out;
    }

    @Transactional
    public Map<String, Object> settle(Long projectId, BigDecimal amount, String reasonCode, String reason,
                                      boolean markCompleted, boolean force, User user) {
        Project p = projectService.getProjectById(projectId);
        if ("CANCELLED".equalsIgnoreCase(p.getStatus())) throw new IllegalStateException("A cancelled project can't be settled.");
        BigDecimal cut = amount == null ? BigDecimal.ZERO : amount.setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal pending = projectService.pendingOf(projectId);

        if (cut.signum() < 0) throw new IllegalArgumentException("Reduction can't be negative.");
        if (cut.signum() == 0 && !markCompleted) throw new IllegalArgumentException("Enter the amount to reduce.");
        if (cut.compareTo(pending) > 0) {
            throw new IllegalArgumentException("Reduction (₹" + cut.toPlainString() + ") is more than the pending amount (₹"
                    + pending.toPlainString() + ").");
        }
        if (cut.signum() > 0) {
            String code = reasonCode == null ? "" : reasonCode.trim().toUpperCase();
            if (!REASONS.contains(code)) throw new IllegalArgumentException("Pick a reason for the reduction.");
            if ("OTHER".equals(code) && (reason == null || reason.isBlank())) {
                throw new IllegalArgumentException("Add a note explaining the reduction.");
            }
            String why = labelOf(code) + (reason == null || reason.isBlank() ? "" : " — " + reason.trim());

            ProjectAdjustment adj = new ProjectAdjustment();
            adj.setProject(p);
            adj.setAmount(cut);
            adj.setReasonCode(code);
            adj.setReason(reason == null || reason.isBlank() ? null : reason.trim());
            adj.setPendingBefore(pending);
            adj.setCreatedById(user != null ? user.getId() : null);
            adjustmentRepository.save(adj);

            // Credit open invoices (oldest first) so their balances really fall.
            BigDecimal left = cut;
            List<Invoice> open = invoiceRepository.findByProjectIdIn(List.of(projectId)).stream()
                    .filter(i -> !Boolean.TRUE.equals(i.getIsDeleted()))
                    .filter(i -> !List.of("PAID", "CANCELLED", "DRAFT").contains(String.valueOf(i.getStatus()).toUpperCase()))
                    .sorted(Comparator.comparing(Invoice::getId))
                    .toList();
            for (Invoice inv : open) {
                if (left.signum() <= 0) break;
                BigDecimal bal = inv.getBalanceDue() != null ? inv.getBalanceDue()
                        : nz(inv.getTotalAmount()).subtract(nz(inv.getAmountPaid()));
                if (bal.signum() <= 0) continue;
                BigDecimal credit = bal.min(left);
                CreditDebitNote note = new CreditDebitNote();
                note.setType("CREDIT");
                note.setCustomer(p.getCustomer() != null ? p.getCustomer() : inv.getCustomer());
                note.setInvoice(inv);
                note.setProject(p);
                note.setAmount(credit);
                note.setDate(LocalDate.now());
                note.setReason("Settlement: " + why);
                financeService.addNote(note);
                left = left.subtract(credit);
            }

            p.setAgreedReduction(nz(p.getAgreedReduction()).add(cut));
            projectRepository.save(p);
            log(p, user, "Settlement: reduced ₹" + cut.toPlainString() + " (" + why + "); pending was ₹" + pending.toPlainString());
        }

        if (markCompleted && !"COMPLETED".equalsIgnoreCase(p.getStatus()) && !"CLOSED".equalsIgnoreCase(p.getStatus())) {
            projectService.completeProject(projectId, null, force);
            log(p, user, "Project completed with settlement" + (force ? " (readiness checklist overridden)" : ""));
        }
        return preview(projectId);
    }

    private static String labelOf(String code) {
        return switch (code) {
            case "BARGAINING" -> "Customer bargaining";
            case "COMPENSATION" -> "Compensation";
            case "ROUND_OFF" -> "Round-off";
            default -> "Other";
        };
    }

    private void log(Project p, User user, String text) {
        ProjectActivityLog l = new ProjectActivityLog();
        l.setProject(p);
        l.setUser(user);
        l.setRole("System");
        l.setDescription(text.length() > 480 ? text.substring(0, 480) : text);
        activityLogRepository.save(l);
    }
}

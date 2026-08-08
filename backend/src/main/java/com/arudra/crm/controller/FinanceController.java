package com.arudra.crm.controller;

import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.FinanceReportService;
import com.arudra.crm.service.FinanceService;
import com.arudra.crm.service.ProjectFinanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Enterprise Billing & Finance API. Coexists with the legacy /api/billing endpoints;
 * everything financial going forward should use this surface.
 */
@RestController
@RequestMapping("/api/finance")
@CrossOrigin(origins = "*")
public class FinanceController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('FINANCE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('FINANCE_WRITE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('FINANCE_APPROVE')";
    private static final String COLLECT = "hasAuthority('ROLE_ADMIN') or hasAuthority('FINANCE_WRITE') or hasAuthority('FINANCE_COLLECT')";

    @Autowired private FinanceService financeService;
    @Autowired private ProjectFinanceService projectFinanceService;
    @Autowired private FinanceReportService reportService;
    @Autowired private CurrentUserService currentUserService;

    // =====================================================================
    // Invoices
    // =====================================================================

    @GetMapping("/invoices")
    @PreAuthorize(READ)
    public ResponseEntity<Page<Invoice>> searchInvoices(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String invoiceType,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(financeService.searchInvoices(status, invoiceType, customerId, projectId,
                from, to, search, page, size));
    }

    @GetMapping("/invoices/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Invoice> getInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.getInvoice(id));
    }

    @GetMapping("/invoices/{id}/items")
    @PreAuthorize(READ)
    public ResponseEntity<List<InvoiceItem>> getInvoiceItems(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.getInvoiceItems(id));
    }

    @GetMapping("/invoices/{id}/payments")
    @PreAuthorize(READ)
    public ResponseEntity<List<CustomerPayment>> getInvoicePayments(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.getPaymentsForInvoice(id));
    }

    public static class InvoiceRequest {
        public Invoice invoice;
        public List<InvoiceItem> items;
    }

    @PostMapping("/invoices")
    @PreAuthorize(WRITE)
    public ResponseEntity<Invoice> createInvoice(@RequestBody InvoiceRequest request) {
        return ResponseEntity.ok(financeService.createInvoice(request.invoice, request.items));
    }

    @PutMapping("/invoices/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Invoice> updateDraftInvoice(@PathVariable Long id, @RequestBody InvoiceRequest request) {
        return ResponseEntity.ok(financeService.updateDraftInvoice(id, request.invoice, request.items));
    }

    @PostMapping("/invoices/{id}/issue")
    @PreAuthorize(WRITE)
    public ResponseEntity<Invoice> issueInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.issueInvoice(id));
    }

    @PostMapping("/invoices/{id}/send")
    @PreAuthorize(WRITE)
    public ResponseEntity<Invoice> markSent(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.markSent(id));
    }

    @PostMapping("/invoices/{id}/cancel")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Invoice> cancelInvoice(@PathVariable Long id,
                                                 @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(financeService.cancelInvoice(id, reason));
    }

    @PostMapping("/invoices/{id}/recalculate")
    @PreAuthorize(WRITE)
    public ResponseEntity<Invoice> recalculate(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.recalculateInvoice(id));
    }

    @PostMapping("/invoices/generate-from-quotation/{quotationId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Invoice> generateFromQuotation(@PathVariable Long quotationId,
                                                         @RequestParam(required = false) BigDecimal advancePercent,
                                                         @RequestParam(defaultValue = "true") boolean draft) {
        return ResponseEntity.ok(financeService.generateFromQuotation(quotationId, advancePercent, draft));
    }

    @PostMapping("/schedules/{scheduleId}/generate-invoice")
    @PreAuthorize(WRITE)
    public ResponseEntity<Invoice> generateStageInvoice(@PathVariable Long scheduleId) {
        return ResponseEntity.ok(financeService.generateStageInvoice(scheduleId));
    }

    // =====================================================================
    // Payments
    // =====================================================================

    @GetMapping("/payments")
    @PreAuthorize(READ)
    public ResponseEntity<Page<CustomerPayment>> searchPayments(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String method,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(financeService.searchPayments(status, customerId, projectId, method,
                from, to, search, page, size));
    }

    @GetMapping("/payments/pending-approval")
    @PreAuthorize(READ)
    public ResponseEntity<List<CustomerPayment>> pendingApprovalPayments() {
        return ResponseEntity.ok(financeService.getPendingApprovalPayments());
    }

    @PostMapping("/payments")
    @PreAuthorize(COLLECT)
    public ResponseEntity<CustomerPayment> recordPayment(@RequestBody CustomerPayment payment) {
        return ResponseEntity.ok(financeService.recordPayment(payment, currentUserService.getCurrentUser()));
    }

    @PostMapping("/payments/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<CustomerPayment> approvePayment(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.approvePayment(id));
    }

    @PostMapping("/payments/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<CustomerPayment> rejectPayment(@PathVariable Long id,
                                                         @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(financeService.rejectPayment(id, reason));
    }

    // =====================================================================
    // Credit / Debit notes
    // =====================================================================

    @GetMapping("/notes")
    @PreAuthorize(READ)
    public ResponseEntity<Page<CreditDebitNote>> getNotes(@RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(financeService.getNotes(page, size));
    }

    @PostMapping("/notes")
    @PreAuthorize(WRITE)
    public ResponseEntity<CreditDebitNote> addNote(@RequestBody CreditDebitNote note) {
        return ResponseEntity.ok(financeService.addNote(note));
    }

    @PostMapping("/notes/{id}/cancel")
    @PreAuthorize(APPROVE)
    public ResponseEntity<CreditDebitNote> cancelNote(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.cancelNote(id));
    }

    // =====================================================================
    // Refunds
    // =====================================================================

    @GetMapping("/refunds")
    @PreAuthorize(READ)
    public ResponseEntity<Page<Refund>> getRefunds(@RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(financeService.getRefunds(page, size));
    }

    @PostMapping("/refunds")
    @PreAuthorize(WRITE)
    public ResponseEntity<Refund> requestRefund(@RequestBody Refund refund) {
        return ResponseEntity.ok(financeService.requestRefund(refund, currentUserService.getCurrentUser()));
    }

    @PostMapping("/refunds/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Refund> approveRefund(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.decideRefund(id, true, currentUserService.getCurrentUser()));
    }

    @PostMapping("/refunds/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Refund> rejectRefund(@PathVariable Long id) {
        return ResponseEntity.ok(financeService.decideRefund(id, false, currentUserService.getCurrentUser()));
    }

    public static class RefundPayoutRequest {
        public String paymentMethod;
        public String referenceNumber;
    }

    @PostMapping("/refunds/{id}/mark-paid")
    @PreAuthorize(APPROVE)
    public ResponseEntity<Refund> markRefundPaid(@PathVariable Long id, @RequestBody RefundPayoutRequest request) {
        return ResponseEntity.ok(financeService.markRefundPaid(id, request.paymentMethod, request.referenceNumber));
    }

    // =====================================================================
    // Payment schedules
    // =====================================================================

    @GetMapping("/projects/{projectId}/schedules")
    @PreAuthorize(READ)
    public ResponseEntity<List<PaymentSchedule>> getSchedules(@PathVariable Long projectId) {
        return ResponseEntity.ok(financeService.getSchedulesForProject(projectId));
    }

    @PostMapping("/schedules")
    @PreAuthorize(WRITE)
    public ResponseEntity<PaymentSchedule> saveSchedule(@RequestBody PaymentSchedule schedule) {
        return ResponseEntity.ok(financeService.saveSchedule(schedule));
    }

    @DeleteMapping("/schedules/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteSchedule(@PathVariable Long id) {
        financeService.deleteSchedule(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/projects/{projectId}/schedules/generate-default")
    @PreAuthorize(WRITE)
    public ResponseEntity<List<PaymentSchedule>> generateDefaultSchedule(@PathVariable Long projectId) {
        return ResponseEntity.ok(financeService.generateDefaultSchedule(projectId));
    }

    // =====================================================================
    // Ledger & outstanding
    // =====================================================================

    @GetMapping("/customers/{customerId}/ledger")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getCustomerLedger(
            @PathVariable Long customerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(financeService.getCustomerLedger(customerId, from, to));
    }

    @GetMapping("/customers/{customerId}/outstanding")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getCustomerOutstanding(@PathVariable Long customerId) {
        return ResponseEntity.ok(financeService.getCustomerOutstanding(customerId));
    }

    @GetMapping("/outstanding")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> getAllOutstanding() {
        return ResponseEntity.ok(financeService.getAllOutstanding());
    }

    // =====================================================================
    // Project expenses & profitability
    // =====================================================================

    @GetMapping("/expenses")
    @PreAuthorize(READ)
    public ResponseEntity<Page<ProjectExpense>> getExpenses(@RequestParam(required = false) Long projectId,
                                                            @RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(projectFinanceService.getExpenses(projectId, page, size));
    }

    @PostMapping("/expenses")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProjectExpense> addExpense(@RequestBody ProjectExpense expense) {
        return ResponseEntity.ok(projectFinanceService.addManualExpense(expense, currentUserService.getCurrentUser()));
    }

    @DeleteMapping("/expenses/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> deleteExpense(@PathVariable Long id) {
        projectFinanceService.deleteExpense(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/projects/{projectId}/sync-expenses")
    @PreAuthorize(WRITE)
    public ResponseEntity<Map<String, Object>> syncProjectExpenses(@PathVariable Long projectId) {
        return ResponseEntity.ok(projectFinanceService.syncProjectExpenses(projectId));
    }

    @GetMapping("/projects/{projectId}/profitability")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getProjectProfitability(@PathVariable Long projectId) {
        return ResponseEntity.ok(projectFinanceService.getProjectProfitability(projectId));
    }

    @GetMapping("/profitability")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> getAllProfitability() {
        return ResponseEntity.ok(projectFinanceService.getAllProjectProfitability());
    }

    // =====================================================================
    // Dashboard & reports
    // =====================================================================

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getDashboard() {
        return ResponseEntity.ok(reportService.getDashboard());
    }

    @GetMapping("/reports/revenue")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> revenueReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.getRevenueReport(from, to));
    }

    @GetMapping("/reports/expenses")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> expenseReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.getExpenseReport(from, to));
    }

    @GetMapping("/reports/profit-loss")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> profitLoss(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.getProfitAndLoss(from, to));
    }

    @GetMapping("/reports/gst")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> gstReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.getGstReport(from, to));
    }

    @GetMapping("/reports/cash-flow")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> cashFlow(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.getCashFlow(from, to));
    }

    @GetMapping("/reports/purchase-vs-sales")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> purchaseVsSales(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.getPurchaseVsSales(from, to));
    }
}

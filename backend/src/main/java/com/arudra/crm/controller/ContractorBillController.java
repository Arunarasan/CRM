package com.arudra.crm.controller;

import com.arudra.crm.entity.ContractorBill;
import com.arudra.crm.entity.ContractorBillItem;
import com.arudra.crm.entity.ContractorPayment;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ContractorBillingService;
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
 * Contractor bills and payments.
 *
 * <p>The approval ladder (Site Engineer → Project Manager → Finance) is enforced in the service;
 * the permissions here mirror it so the wrong desk can't skip a rung from the API either.
 */
@RestController
@RequestMapping("/api/contractor-bills")
@CrossOrigin(origins = "*")
public class ContractorBillController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_BILL_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_BILL_WRITE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_BILL_APPROVE')";
    private static final String PAY = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_PAYMENT')";

    @Autowired private ContractorBillingService billingService;
    @Autowired private CurrentUserService currentUserService;

    public static class BillRequest {
        public ContractorBill bill;
        public Long contractorId;
        public Long workPackageId;
        public List<ContractorBillItem> items;
    }

    public static class PaymentRequest {
        public Long contractorId;
        public Long billId;
        public ContractorPayment payment;
    }

    // =====================================================================
    // Bills
    // =====================================================================

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<Page<ContractorBill>> search(
            @RequestParam(required = false) Long contractorId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long workPackageId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String billType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(billingService.searchBills(contractorId, projectId, workPackageId,
                status, billType, from, to, page, size));
    }

    @GetMapping("/pending-approval")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorBill>> pendingApproval() {
        return ResponseEntity.ok(billingService.getPendingApproval());
    }

    @GetMapping("/payable")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorBill>> payable() {
        return ResponseEntity.ok(billingService.getPayable());
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(billingService.getBillDetail(id));
    }

    /**
     * Pre-fills a bill from measured work minus what earlier bills covered, plus material
     * recovery and outstanding advances. Nothing is saved — this is the draft the engineer reviews.
     */
    @GetMapping("/prepare")
    @PreAuthorize(WRITE)
    public ResponseEntity<Map<String, Object>> prepare(@RequestParam Long workPackageId,
                                                        @RequestParam Long contractorId,
                                                        @RequestParam(required = false) String billType) {
        return ResponseEntity.ok(billingService.prepareBill(workPackageId, contractorId, billType));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorBill> create(@RequestBody BillRequest request) {
        return ResponseEntity.ok(billingService.createBill(request.bill, request.contractorId,
                request.workPackageId, request.items, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorBill> update(@PathVariable Long id, @RequestBody BillRequest request) {
        return ResponseEntity.ok(billingService.updateBill(id, request.bill, request.items));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorBill> submit(@PathVariable Long id) {
        return ResponseEntity.ok(billingService.submitBill(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorBill> approve(@PathVariable Long id,
                                                   @RequestParam(required = false) String comments,
                                                   @RequestParam(required = false) BigDecimal approvedAmount) {
        return ResponseEntity.ok(billingService.approveBill(id, comments, approvedAmount,
                currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorBill> reject(@PathVariable Long id,
                                                  @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(billingService.rejectBill(id, reason, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize(APPROVE)
    public ResponseEntity<ContractorBill> cancel(@PathVariable Long id,
                                                  @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(billingService.cancelBill(id, reason));
    }

    // =====================================================================
    // Payments
    // =====================================================================

    @GetMapping("/payments/by-contractor/{contractorId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorPayment>> paymentsForContractor(@PathVariable Long contractorId) {
        return ResponseEntity.ok(billingService.getPaymentsForContractor(contractorId));
    }

    @GetMapping("/payments")
    @PreAuthorize(READ)
    public ResponseEntity<List<ContractorPayment>> paymentsByStatus(
            @RequestParam(defaultValue = "PAID") String status) {
        return ResponseEntity.ok(billingService.getPaymentsByStatus(status));
    }

    @PostMapping("/payments")
    @PreAuthorize(PAY)
    public ResponseEntity<ContractorPayment> recordPayment(@RequestBody PaymentRequest request) {
        return ResponseEntity.ok(billingService.recordPayment(request.contractorId, request.billId,
                request.payment, currentUserService.getCurrentUser()));
    }

    @PostMapping("/payments/release-retention")
    @PreAuthorize(PAY)
    public ResponseEntity<ContractorPayment> releaseRetention(@RequestParam Long contractorId,
                                                               @RequestParam Long workPackageId,
                                                               @RequestParam(required = false) BigDecimal amount,
                                                               @RequestParam(required = false) String remarks) {
        return ResponseEntity.ok(billingService.releaseRetention(contractorId, workPackageId, amount, remarks,
                currentUserService.getCurrentUser()));
    }

    @GetMapping("/outstanding/{contractorId}")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> outstanding(@PathVariable Long contractorId) {
        return ResponseEntity.ok(billingService.getOutstanding(contractorId));
    }
}

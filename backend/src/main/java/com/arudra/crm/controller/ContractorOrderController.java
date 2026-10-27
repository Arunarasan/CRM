package com.arudra.crm.controller;

import com.arudra.crm.entity.ContractorOrder;
import com.arudra.crm.service.ContractorOrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/** Orders given to a contractor (job + project + agreed amount) and the final who-owes-whom position. */
@RestController
@RequestMapping("/api/contractor-orders")
public class ContractorOrderController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CONTRACTOR_PAYMENT') or hasAuthority('CONTRACTOR_WRITE')";

    @Autowired private ContractorOrderService orderService;
    @Autowired private com.arudra.crm.service.ContractorBillingService billingService;
    @Autowired private com.arudra.crm.security.CurrentUserService currentUserService;

    public static class OrderRequest {
        public Long projectId;
        public String title;
        public BigDecimal amount;
        public LocalDate orderDate;
        public String notes;
    }

    @GetMapping("/by-contractor/{contractorId}")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> byContractor(@PathVariable Long contractorId) {
        return ResponseEntity.ok(orderService.getOrders(contractorId));
    }

    @PostMapping("/by-contractor/{contractorId}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorOrder> create(@PathVariable Long contractorId, @RequestBody OrderRequest r) {
        return ResponseEntity.ok(orderService.create(contractorId, r.projectId, r.title, r.amount, r.orderDate, r.notes));
    }

    public static class ProjectEntryRequest extends OrderRequest {
        public BigDecimal paidNow;
        public String paymentMode;
        public String referenceNumber;
    }

    /** Entered from the project page: the job, plus whatever part of it was paid now (0 = fully due). */
    @PostMapping("/by-contractor/{contractorId}/with-payment")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorOrder> createWithPayment(@PathVariable Long contractorId, @RequestBody ProjectEntryRequest r) {
        return ResponseEntity.ok(billingService.createOrderWithPayment(contractorId, r.projectId, r.title, r.amount,
                r.orderDate, r.notes, r.paidNow, r.paymentMode, r.referenceNumber, currentUserService.getCurrentUser()));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorOrder> update(@PathVariable Long id, @RequestBody OrderRequest r) {
        return ResponseEntity.ok(orderService.update(id, r.projectId, r.title, r.amount, r.orderDate, r.notes));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize(WRITE)
    public ResponseEntity<ContractorOrder> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.cancel(id));
    }
}

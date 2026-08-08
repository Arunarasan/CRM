package com.arudra.crm.controller;

import com.arudra.crm.entity.*;
import com.arudra.crm.service.BillingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/billing")
@CrossOrigin(origins = "*")
public class BillingController {

    @Autowired
    private BillingService billingService;

    // --- Invoices ---
    @GetMapping("/invoices")
    public ResponseEntity<Page<Invoice>> getInvoices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(billingService.getInvoices(page, size));
    }
    
    @GetMapping("/invoices/{id}")
    public ResponseEntity<Invoice> getInvoice(@PathVariable Long id) {
        return billingService.getInvoice(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/invoices/{id}/items")
    public ResponseEntity<List<InvoiceItem>> getInvoiceItems(@PathVariable Long id) {
        return ResponseEntity.ok(billingService.getInvoiceItems(id));
    }

    public static class CreateInvoiceRequest {
        public Invoice invoice;
        public List<InvoiceItem> items;
    }

    @PostMapping("/invoices")
    public ResponseEntity<Invoice> createInvoice(@RequestBody CreateInvoiceRequest request) {
        return ResponseEntity.ok(billingService.createInvoice(request.invoice, request.items));
    }

    @PostMapping("/invoices/{id}/status")
    public ResponseEntity<Invoice> updateInvoiceStatus(@PathVariable Long id, @RequestParam String status) {
        return ResponseEntity.ok(billingService.updateInvoiceStatus(id, status));
    }

    // --- Payments ---
    @GetMapping("/payments")
    public ResponseEntity<Page<CustomerPayment>> getPayments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(billingService.getPayments(page, size));
    }
    
    @GetMapping("/invoices/{id}/payments")
    public ResponseEntity<List<CustomerPayment>> getPaymentsForInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(billingService.getPaymentsForInvoice(id));
    }

    @PostMapping("/payments")
    public ResponseEntity<CustomerPayment> addPayment(@RequestBody CustomerPayment payment) {
        return ResponseEntity.ok(billingService.addPayment(payment));
    }

    // --- Notes ---
    @GetMapping("/notes")
    public ResponseEntity<Page<CreditDebitNote>> getNotes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(billingService.getNotes(page, size));
    }
    
    @GetMapping("/invoices/{id}/notes")
    public ResponseEntity<List<CreditDebitNote>> getNotesForInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(billingService.getNotesForInvoice(id));
    }

    @PostMapping("/notes")
    public ResponseEntity<CreditDebitNote> addNote(@RequestBody CreditDebitNote note) {
        return ResponseEntity.ok(billingService.addNote(note));
    }
}

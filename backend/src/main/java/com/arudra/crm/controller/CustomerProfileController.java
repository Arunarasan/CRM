package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.customer360.*;
import com.arudra.crm.entity.*;
import com.arudra.crm.service.Customer360Service;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Customer 360 aggregate API. New sub-paths only under /api/customers/{id}/... — the existing
 * CustomerController endpoints (list, CRUD, contacts/documents/activities/notes) are untouched.
 */
@RestController
@RequestMapping("/api/customers/{id}")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class CustomerProfileController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_WRITE')";
    private static final String FINANCIAL = "hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_FINANCIAL_READ')";

    private final Customer360Service customer360Service;

    @PreAuthorize(READ)
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<CustomerOverviewDTO>> getOverview(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getOverview(id)));
    }

    @PreAuthorize(READ)
    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<CustomerDashboardStatsDTO>> getDashboard(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getDashboardStats(id)));
    }

    @PreAuthorize(READ)
    @GetMapping("/timeline")
    public ResponseEntity<ApiResponse<Page<CustomerActivity>>> getTimeline(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getTimeline(id, page, size)));
    }

    @PreAuthorize(READ)
    @GetMapping("/activity-log")
    public ResponseEntity<ApiResponse<Page<CustomerActivityLogEntryDTO>>> getActivityLog(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getActivityLog(id, page, size)));
    }

    @PreAuthorize(READ)
    @GetMapping("/documents")
    public ResponseEntity<ApiResponse<Page<CustomerDocumentUnifiedDTO>>> getDocuments(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getDocumentsUnified(id, page, size)));
    }

    // --- Follow-ups (Tab 4) ---

    @PreAuthorize(READ)
    @GetMapping("/follow-ups")
    public ResponseEntity<ApiResponse<Page<CustomerFollowUpDTO>>> getFollowUps(@PathVariable Long id,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getFollowUps(id, status, page, size)));
    }

    @PreAuthorize(WRITE)
    @PostMapping("/follow-ups")
    public ResponseEntity<ApiResponse<CustomerFollowUpDTO>> addFollowUp(@PathVariable Long id,
            @RequestBody CustomerFollowUp followUp, Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.success(
                customer360Service.addFollowUp(id, followUp, authentication.getName())));
    }

    @PreAuthorize(WRITE)
    @PostMapping("/follow-ups/{followUpId}/complete")
    public ResponseEntity<ApiResponse<CustomerFollowUpDTO>> completeFollowUp(@PathVariable Long id,
            @PathVariable Long followUpId, @RequestBody(required = false) Map<String, String> payload,
            Authentication authentication) {
        String notes = payload != null ? payload.get("completionNotes") : null;
        return ResponseEntity.ok(ApiResponse.success(
                customer360Service.completeFollowUp(id, followUpId, notes, authentication.getName())));
    }

    @PreAuthorize(WRITE)
    @PostMapping("/follow-ups/{followUpId}/reschedule")
    public ResponseEntity<ApiResponse<CustomerFollowUpDTO>> rescheduleFollowUp(@PathVariable Long id,
            @PathVariable Long followUpId, @RequestBody Map<String, String> payload, Authentication authentication) {
        LocalDate newDate = LocalDate.parse(payload.get("newDate"));
        return ResponseEntity.ok(ApiResponse.success(
                customer360Service.rescheduleFollowUp(id, followUpId, newDate, payload.get("reason"), authentication.getName())));
    }

    @PreAuthorize(WRITE)
    @PostMapping("/follow-ups/{followUpId}/cancel")
    public ResponseEntity<ApiResponse<CustomerFollowUpDTO>> cancelFollowUp(@PathVariable Long id,
            @PathVariable Long followUpId, @RequestBody(required = false) Map<String, String> payload,
            Authentication authentication) {
        String reason = payload != null ? payload.get("reason") : null;
        return ResponseEntity.ok(ApiResponse.success(
                customer360Service.cancelFollowUp(id, followUpId, reason, authentication.getName())));
    }

    // --- Related module tabs (thin, paginated pass-throughs) ---

    @PreAuthorize(READ)
    @GetMapping("/leads")
    public ResponseEntity<ApiResponse<Page<Lead>>> getLeads(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getLeads(id, page, size)));
    }

    @PreAuthorize(READ)
    @GetMapping("/site-visits")
    public ResponseEntity<ApiResponse<Page<SiteVisit>>> getSiteVisits(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getSiteVisits(id, page, size)));
    }

    @PreAuthorize(READ)
    @GetMapping("/measurements")
    public ResponseEntity<ApiResponse<Page<Measurement>>> getMeasurements(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getMeasurements(id, page, size)));
    }

    @PreAuthorize(READ)
    @GetMapping("/quotations")
    public ResponseEntity<ApiResponse<Page<Quotation>>> getQuotations(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getQuotations(id, page, size)));
    }

    @PreAuthorize(READ)
    @GetMapping("/boqs")
    public ResponseEntity<ApiResponse<Page<Boq>>> getBoqs(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getBoqs(id, page, size)));
    }

    @PreAuthorize(READ)
    @GetMapping("/projects")
    public ResponseEntity<ApiResponse<Page<Project>>> getProjects(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getProjects(id, page, size)));
    }

    @PreAuthorize(READ)
    @GetMapping("/tasks")
    public ResponseEntity<ApiResponse<Page<Task>>> getTasks(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getTasks(id, page, size)));
    }

    // --- Financial (restricted to CUSTOMER_FINANCIAL_READ) ---

    @PreAuthorize(FINANCIAL)
    @GetMapping("/invoices")
    public ResponseEntity<ApiResponse<Page<Invoice>>> getInvoices(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getInvoices(id, page, size)));
    }

    @PreAuthorize(FINANCIAL)
    @GetMapping("/payments")
    public ResponseEntity<ApiResponse<Page<CustomerPayment>>> getPayments(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getPayments(id, page, size)));
    }

    @PreAuthorize(FINANCIAL)
    @GetMapping("/financial-summary")
    public ResponseEntity<ApiResponse<CustomerFinancialSummaryDTO>> getFinancialSummary(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getFinancialSummary(id)));
    }

    @PreAuthorize(READ)
    @GetMapping("/project-summary")
    public ResponseEntity<ApiResponse<CustomerProjectSummaryDTO>> getProjectSummary(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getProjectSummary(id)));
    }

    @PreAuthorize(READ)
    @GetMapping("/communication-summary")
    public ResponseEntity<ApiResponse<CustomerCommunicationSummaryDTO>> getCommunicationSummary(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(customer360Service.getCommunicationSummary(id)));
    }

    // --- Assignment ---

    @PreAuthorize(WRITE)
    @PutMapping("/assigned-employee")
    public ResponseEntity<ApiResponse<CustomerOverviewDTO>> assignEmployee(@PathVariable Long id,
            @RequestBody Map<String, Long> payload, Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.success(
                customer360Service.assignEmployee(id, payload.get("employeeId"), authentication.getName())));
    }
}

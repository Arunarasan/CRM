package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * "Customer Agreed" by a field employee → admin approval → project.
 *
 * The employee sends the customer-agreed quote with the advance the customer paid (optional: amount,
 * method, reference, receipt photo). The quote is locked as customer-approved but NO project is created.
 * An admin / project manager then approves it (project created, advance recorded as a confirmed payment
 * collected by the employee) or rejects it with a reason (the quote opens again for the employee).
 * Admins and project managers still create projects directly — this only gates field employees.
 */
@Service
public class ProjectConversionRequestService {

    /** Quotation.internalApprovalStatus while a project request waits for an admin. */
    public static final String CREATE_REQUESTED = "PROJECT_CREATE_REQUESTED";

    @Autowired private ProjectConversionRequestRepository requestRepository;
    @Autowired private QuotationRepository quotationRepository;
    @Autowired private BoqRepository boqRepository;
    @Autowired private LeadRepository leadRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CustomerPaymentRepository paymentRepository;
    @Autowired private NotificationService notificationService;
    @Autowired @Lazy private EmployeeTaskService employeeTaskService;
    @Autowired @Lazy private QuoteWorkspaceService quoteWorkspaceService;
    @Autowired @Lazy private ProjectQuoteChangeService projectQuoteChangeService;
    @Autowired @Lazy private FinanceService financeService;
    @Autowired @Lazy private LeadService leadService;

    /** Admins and project managers decide requests (and may still create projects directly). */
    public static boolean canDecide(User user) {
        return user != null && user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "ROLE_ADMIN".equals(r.getName()) || "ROLE_PROJECT_MANAGER".equals(r.getName()));
    }

    /** The employee sends the customer-agreed quote (and any advance) to an admin. */
    @Transactional
    public Map<String, Object> request(Long leadId, User employee, BigDecimal advance, String method,
                                       String reference, String proofUrl, String note) {
        Lead lead = leadRepository.findById(leadId)
                .orElseThrow(() -> new IllegalArgumentException("Lead not found"));
        if (requestRepository.existsByLeadIdAndStatusAndIsDeletedFalse(leadId, ProjectConversionRequest.PENDING)) {
            throw new IllegalStateException("This lead is already waiting for admin approval.");
        }
        if (advance != null && advance.signum() < 0) throw new IllegalArgumentException("Advance can't be negative.");

        // What the customer agreed to is the lead's LATEST quote sheet (after a rejection the old quote is
        // REVISED and a fresh revision is open) and that sheet's own quotation, if it has one yet.
        Long sheetId = boqRepository.findByLeadIdAndIsDeletedFalseOrderByIdDesc(leadId).stream()
                .filter(b -> !Boolean.FALSE.equals(b.getIsLatestVersion()))
                .map(Boq::getId).findFirst().orElse(null);
        List<Quotation> quotes = quotationRepository.findByLeadIdOrderByCreatedAtDesc(leadId);
        final Long sheet = sheetId;
        Quotation quote = quotes.stream()
                .filter(q -> !"REVISED".equals(q.getStatus()))
                .filter(q -> sheet == null || (q.getBoq() != null && sheet.equals(q.getBoq().getId())))
                .findFirst().orElse(null);
        if (quote != null && "CONVERTED".equals(quote.getStatus())) {
            throw new IllegalStateException("A project was already created from this quote.");
        }
        if (sheetId != null && !projectQuoteChangeService.leadProject(sheetId).isEmpty()) {
            throw new IllegalStateException("This lead already has a project — use Update Project instead.");
        }
        // Lock what the customer agreed to, so the admin approves exactly this quote.
        if (sheetId != null && (quote == null || QuotationService.isLive(quote))) {
            quote = quoteWorkspaceService.customerApproval(sheetId, employee);
        }
        if (quote == null || quote.getId() == null) {
            throw new IllegalStateException("No quotation found for this lead. Create the quotation first.");
        }
        if (!"APPROVED".equals(quote.getStatus())) quote.setStatus("APPROVED");
        quote.setInternalApprovalStatus(CREATE_REQUESTED);
        quotationRepository.save(quote);

        ProjectConversionRequest r = new ProjectConversionRequest();
        r.setLeadId(leadId);
        r.setBoqId(sheetId);
        r.setQuotationId(quote.getId());
        r.setQuoteTotal(quote.getGrandTotal());
        r.setAdvanceAmount(advance != null && advance.signum() > 0 ? advance : null);
        r.setPaymentMethod(r.getAdvanceAmount() != null ? (blank(method) ? "Cash" : method.trim()) : null);
        r.setReferenceNumber(r.getAdvanceAmount() != null && !blank(reference) ? reference.trim() : null);
        r.setProofUrl(!blank(proofUrl) ? proofUrl.trim() : null);
        r.setNote(!blank(note) ? note.trim() : null);
        r.setRequestedById(employee.getId());
        r = requestRepository.save(r);

        String who = employee.getName() != null ? employee.getName() : "An employee";
        String money = r.getAdvanceAmount() != null
                ? " Advance ₹" + r.getAdvanceAmount().toPlainString() + " (" + r.getPaymentMethod() + ")."
                : " No advance yet.";
        leadService.addNote(leadId, "Customer agreed to quote " + quote.getQuotationNumber()
                + " — sent to admin to create the project." + money, employee);
        notificationService.dispatchToAdmins("Project approval needed",
                who + " says " + lead.getName() + " agreed to quote " + quote.getQuotationNumber() + "." + money
                        + " Approve to create the project.",
                "PROJECT", "/leads/" + leadId + "?tab=journey", employee.getId());
        return toMap(r);
    }

    /** The latest request on a lead (any status), or empty. */
    @Transactional
    public Map<String, Object> latestForLead(Long leadId) {
        return requestRepository.findFirstByLeadIdAndIsDeletedFalseOrderByIdDesc(leadId)
                .map(this::settleIfConverted).map(this::toMap).orElse(Map.of());
    }

    @Transactional
    public List<Map<String, Object>> pending() {
        return requestRepository.findByStatusAndIsDeletedFalseOrderByIdDesc(ProjectConversionRequest.PENDING)
                .stream().map(this::settleIfConverted)
                .filter(r -> ProjectConversionRequest.PENDING.equals(r.getStatus()))
                .map(this::toMap).toList();
    }

    /**
     * Safety net: a pending request whose quote was turned into a project some other way (e.g. from the
     * Quotations module) is closed as approved, so it never waits forever.
     */
    private ProjectConversionRequest settleIfConverted(ProjectConversionRequest r) {
        if (!ProjectConversionRequest.PENDING.equals(r.getStatus()) || r.getQuotationId() == null) return r;
        Quotation q = quotationRepository.findById(r.getQuotationId()).orElse(null);
        if (q == null || !"CONVERTED".equals(q.getStatus())) return r;
        r.setStatus(ProjectConversionRequest.APPROVED);
        r.setDecidedAt(LocalDateTime.now());
        r.setDecisionNote("Project created directly");
        if (q.getProject() != null) r.setProjectId(q.getProject().getId());
        return requestRepository.save(r);
    }

    /**
     * Admin approves: the project is created from the agreed quote and the advance (the admin may correct
     * the amount/method after checking it) is recorded as a confirmed payment collected by the employee.
     */
    @Transactional
    public Map<String, Object> approve(Long requestId, User admin, BigDecimal amount, String method) {
        ProjectConversionRequest r = pendingRequest(requestId);
        List<Project> projects = employeeTaskService.convertLeadToProject(r.getLeadId(), admin, null, null);
        if (projects.isEmpty()) throw new IllegalStateException("The project could not be created.");
        Project project = projects.get(0);

        BigDecimal advance = amount != null ? amount : r.getAdvanceAmount();
        String payMethod = !blank(method) ? method.trim() : r.getPaymentMethod();
        User collector = r.getRequestedById() != null ? userRepository.findById(r.getRequestedById()).orElse(null) : null;
        if (advance != null && advance.signum() > 0) {
            Long quotationId = project.getQuotation() != null ? project.getQuotation().getId() : r.getQuotationId();
            for (CustomerPayment p : financeService.recordConversionAdvance(quotationId, project, advance, payMethod, admin)) {
                if (collector != null) p.setCollectedBy(collector);
                if (r.getReferenceNumber() != null) p.setReferenceNumber(r.getReferenceNumber());
                if (r.getProofUrl() != null) p.setProofUrl(r.getProofUrl());
                p.setRemarks("Advance collected by " + (collector != null ? collector.getName() : "employee")
                        + ", approved by " + admin.getName());
                paymentRepository.save(p);
            }
        }
        if (r.getQuotationId() != null) {
            quotationRepository.findById(r.getQuotationId()).ifPresent(q -> {
                q.setInternalApprovalStatus("PROJECT_CREATE_APPROVED");
                quotationRepository.save(q);
            });
        }

        r.setStatus(ProjectConversionRequest.APPROVED);
        r.setDecidedById(admin.getId());
        r.setDecidedAt(LocalDateTime.now());
        r.setProjectId(project.getId());
        if (amount != null) r.setAdvanceAmount(amount);
        if (!blank(method)) r.setPaymentMethod(method.trim());
        requestRepository.save(r);

        if (collector != null && !collector.getId().equals(admin.getId())) {
            notificationService.dispatch("Project approved",
                    "Project " + project.getProjectCode() + " was created for " + leadName(r.getLeadId())
                            + " — approved by " + admin.getName() + ".",
                    "PROJECT", collector.getId(), "/employee/tasks?tab=PROJECTS");
        }
        return toMap(r);
    }

    /** Admin rejects: no project; the quote opens again so the employee can fix it and send it again. */
    @Transactional
    public Map<String, Object> reject(Long requestId, User admin, String reason) {
        ProjectConversionRequest r = pendingRequest(requestId);
        String why = blank(reason) ? null : reason.trim();
        if (r.getQuotationId() != null) {
            quotationRepository.findById(r.getQuotationId()).ifPresent(q -> {
                q.setInternalApprovalStatus("PROJECT_CREATE_REJECTED");
                quotationRepository.save(q);
            });
        }
        if (r.getBoqId() != null) {
            try { quoteWorkspaceService.reopen(r.getBoqId(), admin); }
            catch (Exception ignored) { /* already open — nothing to unlock */ }
        }
        r.setStatus(ProjectConversionRequest.REJECTED);
        r.setDecidedById(admin.getId());
        r.setDecidedAt(LocalDateTime.now());
        r.setDecisionNote(why);
        requestRepository.save(r);

        leadService.addNote(r.getLeadId(), "Project request rejected by " + admin.getName()
                + (why != null ? ": " + why : "") + ". The quote is open again.", admin);
        if (r.getRequestedById() != null && !r.getRequestedById().equals(admin.getId())) {
            notificationService.dispatch("Project request rejected",
                    "Your project request for " + leadName(r.getLeadId()) + " was rejected"
                            + (why != null ? ": " + why : "") + ". The quote is open again — fix it and send it again.",
                    "PROJECT", r.getRequestedById(), "/employee/quote/new?leadId=" + r.getLeadId());
        }
        return toMap(r);
    }

    private ProjectConversionRequest pendingRequest(Long id) {
        ProjectConversionRequest r = requestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (!ProjectConversionRequest.PENDING.equals(r.getStatus())) {
            throw new IllegalStateException("This request was already " + r.getStatus().toLowerCase() + ".");
        }
        return r;
    }

    private String leadName(Long leadId) {
        return leadRepository.findById(leadId).map(Lead::getName).orElse("the lead");
    }

    private String userName(Long id) {
        return id == null ? null : userRepository.findById(id).map(User::getName).orElse(null);
    }

    private Map<String, Object> toMap(ProjectConversionRequest r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("leadId", r.getLeadId());
        m.put("leadName", leadName(r.getLeadId()));
        m.put("boqId", r.getBoqId());
        m.put("quotationId", r.getQuotationId());
        m.put("quotationNumber", r.getQuotationId() == null ? null
                : quotationRepository.findById(r.getQuotationId()).map(Quotation::getQuotationNumber).orElse(null));
        m.put("quoteTotal", r.getQuoteTotal());
        m.put("advanceAmount", r.getAdvanceAmount());
        m.put("paymentMethod", r.getPaymentMethod());
        m.put("referenceNumber", r.getReferenceNumber());
        m.put("proofUrl", r.getProofUrl());
        m.put("note", r.getNote());
        m.put("status", r.getStatus());
        m.put("requestedById", r.getRequestedById());
        m.put("requestedByName", userName(r.getRequestedById()));
        m.put("requestedAt", r.getCreatedAt());
        m.put("decidedByName", userName(r.getDecidedById()));
        m.put("decidedAt", r.getDecidedAt());
        m.put("decisionNote", r.getDecisionNote());
        m.put("projectId", r.getProjectId());
        return m;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}

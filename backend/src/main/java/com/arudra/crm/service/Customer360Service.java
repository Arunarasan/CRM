package com.arudra.crm.service;

import com.arudra.crm.dto.customer360.*;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Aggregation service backing the Customer 360 page. Deliberately separate from
 * {@link CustomerService} so none of this touches the existing, already-working
 * getCustomerProfile()/CustomerProfileDTO path used by the current customer detail API.
 */
@Service
@RequiredArgsConstructor
public class Customer360Service {

    private final CustomerRepository customerRepository;
    private final LeadRepository leadRepository;
    private final SiteVisitRepository siteVisitRepository;
    private final MeasurementRepository measurementRepository;
    private final QuotationRepository quotationRepository;
    private final BoqRepository boqRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final InvoiceRepository invoiceRepository;
    private final CustomerPaymentRepository customerPaymentRepository;
    private final CustomerDocumentRepository customerDocumentRepository;
    private final ProjectDocumentRepository projectDocumentRepository;
    private final QuotationAttachmentRepository quotationAttachmentRepository;
    private final LeadDocumentRepository leadDocumentRepository;
    private final CustomerActivityRepository customerActivityRepository;
    private final CustomerFollowUpRepository customerFollowUpRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;
    private final UserRepository userRepository;

    private static final String ENTITY_NAME = "CUSTOMER";

    // ------------------------------------------------------------------
    // Header / Overview / Dashboard
    // ------------------------------------------------------------------

    @Cacheable(value = "customer360", key = "'overview:' + #customerId")
    public CustomerOverviewDTO getOverview(Long customerId) {
        Customer customer = getCustomerOrThrow(customerId);

        CustomerOverviewDTO dto = new CustomerOverviewDTO();
        dto.setId(customer.getId());
        dto.setPhotoUrl(customer.getPhotoUrl());
        dto.setName(customer.getName());
        dto.setCustomerCode(customer.getCustomerCode());
        dto.setCustomerType(customer.getCustomerType());
        dto.setStatus(customer.getStatus());
        dto.setCompanyName(customer.getCompanyName());
        dto.setPhone(customer.getPhone());
        dto.setWhatsappNumber(customer.getWhatsappNumber());
        dto.setEmail(customer.getEmail());
        dto.setCreatedAt(customer.getCreatedAt());
        dto.setCustomerSince(customer.getCustomerSince());
        dto.setUpdatedAt(customer.getUpdatedAt());

        if (customer.getAssignedEmployee() != null) {
            dto.setAssignedEmployeeId(customer.getAssignedEmployee().getId());
            dto.setAssignedEmployeeName(customer.getAssignedEmployee().getName());
            dto.setAssignedSalesPersonName(customer.getAssignedEmployee().getName());
            dto.setAssignedProjectManagerName(customer.getAssignedEmployee().getName());
        }

        CustomerFinancialSummaryDTO financial = getFinancialSummary(customerId);
        dto.setOutstandingBalance(financial.getOutstandingBalance());
        dto.setCustomerLifetimeValue(financial.getTotalPaid() != null ? financial.getTotalPaid() : BigDecimal.ZERO);

        CustomerActivity lastActivity = customerActivityRepository
                .findByCustomerIdOrderByCreatedAtDesc(customerId, PageRequest.of(0, 1))
                .stream().findFirst().orElse(null);
        if (lastActivity != null) {
            dto.setLastCommunicationDate(lastActivity.getCreatedAt());
            dto.setLastCommunicationChannel(lastActivity.getChannel());
        }

        CustomerFollowUp nextFollowUp = customerFollowUpRepository
                .findByCustomerIdAndStatusOrderByFollowupDateAsc(customerId, "PENDING", PageRequest.of(0, 1))
                .stream().findFirst().orElse(null);
        if (nextFollowUp != null) {
            dto.setNextFollowUpDate(nextFollowUp.getFollowupDate());
            dto.setNextFollowUpPurpose(nextFollowUp.getPurpose());
        }

        int healthScore = computeHealthScore(customer, financial, lastActivity, nextFollowUp);
        dto.setHealthScore(healthScore);
        dto.setRating(Math.max(1, Math.min(5, (int) Math.round(healthScore / 20.0))));

        return dto;
    }

    /**
     * Deterministic v1 heuristic (documented, not persisted): payment timeliness 30%,
     * engagement recency 25%, project delivery 20%, follow-up responsiveness 15%, tenure 10%.
     * Flagged in the final review as a candidate for a real scoring model later.
     */
    int computeHealthScore(Customer customer, CustomerFinancialSummaryDTO financial,
            CustomerActivity lastActivity, CustomerFollowUp nextFollowUp) {
        double score = 0;

        // Payment timeliness (30): 30 if no invoicing yet or fully paid, scaled down by outstanding ratio.
        BigDecimal invoiced = financial.getTotalInvoiced();
        BigDecimal outstanding = financial.getOutstandingBalance();
        if (invoiced == null || invoiced.compareTo(BigDecimal.ZERO) <= 0) {
            score += 30;
        } else {
            double ratio = outstanding == null ? 0 : outstanding.doubleValue() / invoiced.doubleValue();
            score += Math.max(0, 30 * (1 - Math.min(1, ratio)));
        }

        // Engagement recency (25): full marks within 14 days, tapering to 0 by 90 days.
        if (lastActivity != null && lastActivity.getCreatedAt() != null) {
            long days = java.time.Duration.between(lastActivity.getCreatedAt(), LocalDateTime.now()).toDays();
            score += Math.max(0, 25 * (1 - Math.min(1, days / 90.0)));
        }

        // Project delivery (20): share of completed vs. cancelled among the customer's projects.
        List<Project> projects = projectRepository.findByCustomerId(customer.getId());
        if (!projects.isEmpty()) {
            long completed = projects.stream().filter(p -> "COMPLETED".equalsIgnoreCase(p.getStatus())).count();
            long cancelled = projects.stream().filter(p -> "CANCELLED".equalsIgnoreCase(p.getStatus())).count();
            double denom = completed + cancelled;
            score += denom == 0 ? 15 : 20 * (completed / denom);
        } else {
            score += 15; // neutral, not yet penalized for having no projects
        }

        // Follow-up responsiveness (15): penalize overdue pending follow-ups.
        long overdue = customerFollowUpRepository.findByCustomerIdAndStatusAndFollowupDateBefore(
                customer.getId(), "PENDING", LocalDate.now()).size();
        score += Math.max(0, 15 - overdue * 5);

        // Tenure (10): full marks after 2 years.
        if (customer.getCustomerSince() != null) {
            long years = java.time.temporal.ChronoUnit.DAYS.between(customer.getCustomerSince(), LocalDate.now()) / 365;
            score += Math.min(10, years * 5);
        }

        return (int) Math.max(0, Math.min(100, Math.round(score)));
    }

    @Cacheable(value = "customer360", key = "'dashboard:' + #customerId")
    public CustomerDashboardStatsDTO getDashboardStats(Long customerId) {
        getCustomerOrThrow(customerId);
        CustomerDashboardStatsDTO dto = new CustomerDashboardStatsDTO();

        List<Lead> leads = leadRepository.findByConvertedToCustomerId(customerId);
        dto.setTotalLeads(leads.size());
        dto.setWonLeads(leads.stream().filter(l -> isStatus(l.getStatus(), "WON", "CONVERTED")).count());
        dto.setLostLeads(leads.stream().filter(l -> isStatus(l.getStatus(), "LOST")).count());
        dto.setOpenLeads(dto.getTotalLeads() - dto.getWonLeads() - dto.getLostLeads());

        dto.setSiteVisits(siteVisitRepository.findByCustomerIdAndIsDeletedFalseOrderByScheduledTimeDesc(customerId).size());
        dto.setMeasurements(measurementRepository.findByCustomerId(customerId).size());

        List<Quotation> quotations = quotationRepository.findByCustomerId(customerId);
        dto.setQuotations(quotations.size());
        dto.setApprovedQuotations(quotations.stream().filter(q -> isStatus(q.getStatus(), "APPROVED")).count());
        dto.setRejectedQuotations(quotations.stream().filter(q -> isStatus(q.getStatus(), "REJECTED")).count());

        List<Project> projects = projectRepository.findByCustomerId(customerId);
        dto.setProjects(projects.size());
        dto.setCompletedProjects(projects.stream().filter(p -> isStatus(p.getStatus(), "COMPLETED")).count());
        dto.setRunningProjects(projects.stream().filter(p -> isStatus(p.getStatus(), "RUNNING")).count());

        List<Task> tasks = taskRepository.findByProjectCustomerIdOrderByDueDateAsc(customerId);
        dto.setTasks(tasks.size());
        dto.setCompletedTasks(tasks.stream().filter(t -> isStatus(t.getStatus(), "COMPLETED")).count());
        dto.setPendingTasks(tasks.stream().filter(t -> !isStatus(t.getStatus(), "COMPLETED")).count());

        List<Invoice> invoices = invoiceRepository.findByCustomerId(customerId);
        dto.setInvoices(invoices.size());

        CustomerFinancialSummaryDTO financial = getFinancialSummary(customerId);
        dto.setPaidAmount(financial.getTotalPaid());
        dto.setOutstandingBalance(financial.getOutstandingBalance());
        dto.setPendingAmount(financial.getOutstandingBalance());
        dto.setCustomerLifetimeValue(financial.getTotalPaid());

        dto.setDocuments(getDocumentsUnified(customerId, 0, Integer.MAX_VALUE).getTotalElements());
        dto.setFollowUps(customerFollowUpRepository.findByCustomerIdOrderByFollowupDateAsc(customerId, PageRequest.of(0, Integer.MAX_VALUE)).getTotalElements());

        CustomerActivity lastActivity = customerActivityRepository
                .findByCustomerIdOrderByCreatedAtDesc(customerId, PageRequest.of(0, 1)).stream().findFirst().orElse(null);
        if (lastActivity != null) {
            dto.setLastCommunication(lastActivity.getCreatedAt());
        }
        CustomerFollowUp nextFollowUp = customerFollowUpRepository
                .findByCustomerIdAndStatusOrderByFollowupDateAsc(customerId, "PENDING", PageRequest.of(0, 1))
                .stream().findFirst().orElse(null);
        if (nextFollowUp != null) {
            dto.setNextFollowUp(nextFollowUp.getFollowupDate());
        }

        return dto;
    }

    private boolean isStatus(String actual, String... expected) {
        if (actual == null) return false;
        for (String e : expected) {
            if (actual.equalsIgnoreCase(e)) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------
    // Tab list data (thin, paginated pass-throughs)
    // ------------------------------------------------------------------

    public Page<Lead> getLeads(Long customerId, int page, int size) {
        return leadRepository.findByConvertedToCustomerId(customerId, PageRequest.of(page, size));
    }

    public Page<SiteVisit> getSiteVisits(Long customerId, int page, int size) {
        return siteVisitRepository.findByCustomerIdAndIsDeletedFalseOrderByScheduledTimeDesc(customerId, PageRequest.of(page, size));
    }

    public Page<Measurement> getMeasurements(Long customerId, int page, int size) {
        return measurementRepository.findByCustomerId(customerId, PageRequest.of(page, size));
    }

    public Page<Quotation> getQuotations(Long customerId, int page, int size) {
        return quotationRepository.findByCustomerId(customerId, PageRequest.of(page, size));
    }

    public Page<Boq> getBoqs(Long customerId, int page, int size) {
        return boqRepository.findByCustomerIdAndIsDeletedFalse(customerId, PageRequest.of(page, size));
    }

    public Page<Project> getProjects(Long customerId, int page, int size) {
        return projectRepository.findByCustomerId(customerId, PageRequest.of(page, size));
    }

    public Page<Task> getTasks(Long customerId, int page, int size) {
        return taskRepository.findByProjectCustomerIdOrderByDueDateAsc(customerId, PageRequest.of(page, size));
    }

    public Page<Invoice> getInvoices(Long customerId, int page, int size) {
        return invoiceRepository.findByCustomerIdOrderByDateDesc(customerId, PageRequest.of(page, size));
    }

    public Page<CustomerPayment> getPayments(Long customerId, int page, int size) {
        return customerPaymentRepository.findByCustomerIdOrderByPaymentDateDesc(customerId, PageRequest.of(page, size));
    }

    // ------------------------------------------------------------------
    // Communication timeline
    // ------------------------------------------------------------------

    public Page<CustomerActivity> getTimeline(Long customerId, int page, int size) {
        return customerActivityRepository.findByCustomerIdOrderByCreatedAtDesc(customerId, PageRequest.of(page, size));
    }

    // ------------------------------------------------------------------
    // Documents (unified across CustomerDocument/ProjectDocument/QuotationAttachment/LeadDocument)
    // ------------------------------------------------------------------

    @Cacheable(value = "customer360", key = "'documents:' + #customerId + ':' + #page + ':' + #size")
    public Page<CustomerDocumentUnifiedDTO> getDocumentsUnified(Long customerId, int page, int size) {
        List<CustomerDocumentUnifiedDTO> all = new ArrayList<>();

        for (CustomerDocument d : customerDocumentRepository.findByCustomerIdOrderByCreatedAtDesc(customerId)) {
            CustomerDocumentUnifiedDTO dto = new CustomerDocumentUnifiedDTO();
            dto.setId(d.getId());
            dto.setSourceType("CUSTOMER");
            dto.setSourceId(customerId);
            dto.setSourceLabel("Customer Profile");
            dto.setFileName(d.getFileName());
            dto.setFileUrl(d.getFileUrl());
            dto.setDocumentType(d.getFileType());
            dto.setUploadedByName(d.getUploadedBy() != null ? d.getUploadedBy().getName() : null);
            dto.setUploadedAt(d.getCreatedAt());
            all.add(dto);
        }

        for (Project project : projectRepository.findByCustomerId(customerId)) {
            for (ProjectDocument d : projectDocumentRepository.findByProjectId(project.getId())) {
                CustomerDocumentUnifiedDTO dto = new CustomerDocumentUnifiedDTO();
                dto.setId(d.getId());
                dto.setSourceType("PROJECT");
                dto.setSourceId(project.getId());
                dto.setSourceLabel(project.getProjectName());
                dto.setFileName(d.getFileName());
                dto.setFileUrl(d.getFileUrl());
                dto.setDocumentType(d.getDocumentType());
                dto.setDocumentVersion(d.getDocumentVersion());
                dto.setUploadedByName(d.getUploadedBy() != null ? d.getUploadedBy().getName() : null);
                dto.setUploadedAt(d.getUploadDate() != null ? d.getUploadDate() : d.getCreatedAt());
                all.add(dto);
            }
        }

        for (Quotation quotation : quotationRepository.findByCustomerId(customerId)) {
            for (QuotationAttachment d : quotationAttachmentRepository.findByQuotationId(quotation.getId())) {
                CustomerDocumentUnifiedDTO dto = new CustomerDocumentUnifiedDTO();
                dto.setId(d.getId());
                dto.setSourceType("QUOTATION");
                dto.setSourceId(quotation.getId());
                dto.setSourceLabel(quotation.getQuotationNumber());
                dto.setFileName(d.getFileName());
                dto.setFileUrl(d.getFileUrl());
                dto.setDocumentType(d.getDocumentType());
                dto.setDocumentVersion(d.getDocumentVersion());
                dto.setUploadedByName(d.getUploadedBy() != null ? d.getUploadedBy().getName() : null);
                dto.setUploadedAt(d.getCreatedAt());
                all.add(dto);
            }
        }

        for (Lead lead : leadRepository.findByConvertedToCustomerId(customerId)) {
            for (LeadDocument d : leadDocumentRepository.findByLeadId(lead.getId())) {
                CustomerDocumentUnifiedDTO dto = new CustomerDocumentUnifiedDTO();
                dto.setId(d.getId());
                dto.setSourceType("LEAD");
                dto.setSourceId(lead.getId());
                dto.setSourceLabel(lead.getName());
                dto.setFileName(d.getFileName());
                dto.setFileUrl(d.getFileUrl());
                dto.setDocumentType(d.getDocumentType());
                dto.setUploadedByName(d.getUploadedBy() != null ? d.getUploadedBy().getName() : null);
                dto.setUploadedAt(d.getCreatedAt());
                all.add(dto);
            }
        }

        all.sort(Comparator.comparing(CustomerDocumentUnifiedDTO::getUploadedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        return paginate(all, page, size);
    }

    private <T> Page<T> paginate(List<T> all, int page, int size) {
        int from = Math.min(page * size, all.size());
        int to = Math.min(from + size, all.size());
        return new PageImpl<>(all.subList(from, to), PageRequest.of(page, Math.max(size, 1)), all.size());
    }

    // ------------------------------------------------------------------
    // Follow-ups (Tab 4)
    // ------------------------------------------------------------------

    public Page<CustomerFollowUpDTO> getFollowUps(Long customerId, String statusFilter, int page, int size) {
        Page<CustomerFollowUp> source = (statusFilter == null || statusFilter.isBlank())
                ? customerFollowUpRepository.findByCustomerIdOrderByFollowupDateAsc(customerId, PageRequest.of(page, size))
                : customerFollowUpRepository.findByCustomerIdAndStatusOrderByFollowupDateAsc(customerId, statusFilter, PageRequest.of(page, size));
        return source.map(this::toFollowUpDto);
    }

    private CustomerFollowUpDTO toFollowUpDto(CustomerFollowUp f) {
        CustomerFollowUpDTO dto = new CustomerFollowUpDTO();
        dto.setId(f.getId());
        if (f.getAssignedEmployee() != null) {
            dto.setAssignedEmployeeId(f.getAssignedEmployee().getId());
            dto.setAssignedEmployeeName(f.getAssignedEmployee().getName());
        }
        dto.setPurpose(f.getPurpose());
        dto.setPriority(f.getPriority());
        dto.setFollowupDate(f.getFollowupDate());
        dto.setFollowupTime(f.getFollowupTime());
        dto.setMethod(f.getMethod());
        dto.setStatus(f.getStatus());
        dto.setNotes(f.getNotes());
        dto.setCompletionNotes(f.getCompletionNotes());
        dto.setNextFollowupDate(f.getNextFollowupDate());
        dto.setBucket(bucketFor(f));
        return dto;
    }

    private String bucketFor(CustomerFollowUp f) {
        if ("COMPLETED".equalsIgnoreCase(f.getStatus())) return "COMPLETED";
        if ("CANCELLED".equalsIgnoreCase(f.getStatus())) return "CANCELLED";
        if (f.getFollowupDate() == null) return "UPCOMING";
        if (f.getFollowupDate().isBefore(LocalDate.now())) return "OVERDUE";
        if (f.getFollowupDate().isEqual(LocalDate.now())) return "TODAY";
        return "UPCOMING";
    }

    @CacheEvict(value = "customer360", key = "'overview:' + #customerId")
    public CustomerFollowUpDTO addFollowUp(Long customerId, CustomerFollowUp followUp, String performedByEmail) {
        Customer customer = getCustomerOrThrow(customerId);
        followUp.setCustomer(customer);
        if (followUp.getStatus() == null) {
            followUp.setStatus("PENDING");
        }
        User actingUser = resolveUser(performedByEmail);
        followUp.setCreatedByUser(actingUser);
        CustomerFollowUp saved = customerFollowUpRepository.save(followUp);
        logCustomerActivity(customerId, "FOLLOWUP_ADDED",
                "Follow-up scheduled for " + saved.getFollowupDate(), actingUser);
        return toFollowUpDto(saved);
    }

    @CacheEvict(value = "customer360", key = "'overview:' + #customerId")
    public CustomerFollowUpDTO completeFollowUp(Long customerId, Long followUpId, String completionNotes, String performedByEmail) {
        CustomerFollowUp followUp = getFollowUpOrThrow(customerId, followUpId);
        followUp.setStatus("COMPLETED");
        followUp.setCompletionNotes(completionNotes);
        CustomerFollowUp saved = customerFollowUpRepository.save(followUp);
        logCustomerActivity(customerId, "FOLLOWUP_COMPLETED", completionNotes, resolveUser(performedByEmail));
        return toFollowUpDto(saved);
    }

    @CacheEvict(value = "customer360", key = "'overview:' + #customerId")
    public CustomerFollowUpDTO rescheduleFollowUp(Long customerId, Long followUpId, LocalDate newDate, String reason, String performedByEmail) {
        CustomerFollowUp followUp = getFollowUpOrThrow(customerId, followUpId);
        followUp.setFollowupDate(newDate);
        CustomerFollowUp saved = customerFollowUpRepository.save(followUp);
        logCustomerActivity(customerId, "FOLLOWUP_RESCHEDULED",
                "Rescheduled to " + newDate + (reason != null ? " - " + reason : ""), resolveUser(performedByEmail));
        return toFollowUpDto(saved);
    }

    @CacheEvict(value = "customer360", key = "'overview:' + #customerId")
    public CustomerFollowUpDTO cancelFollowUp(Long customerId, Long followUpId, String reason, String performedByEmail) {
        CustomerFollowUp followUp = getFollowUpOrThrow(customerId, followUpId);
        followUp.setStatus("CANCELLED");
        followUp.setCompletionNotes(reason);
        CustomerFollowUp saved = customerFollowUpRepository.save(followUp);
        logCustomerActivity(customerId, "FOLLOWUP_CANCELLED", reason, resolveUser(performedByEmail));
        return toFollowUpDto(saved);
    }

    private CustomerFollowUp getFollowUpOrThrow(Long customerId, Long followUpId) {
        CustomerFollowUp followUp = customerFollowUpRepository.findById(followUpId)
                .orElseThrow(() -> new RuntimeException("Follow-up not found"));
        if (!followUp.getCustomer().getId().equals(customerId)) {
            throw new RuntimeException("Follow-up does not belong to this customer");
        }
        return followUp;
    }

    // ------------------------------------------------------------------
    // Activity log (Tab 12) — reuses the existing shared ActivityLog infrastructure
    // ------------------------------------------------------------------

    public Page<CustomerActivityLogEntryDTO> getActivityLog(Long customerId, int page, int size) {
        return activityLogRepository
                .findByEntityNameAndEntityIdOrderByPerformedAtDesc(ENTITY_NAME, customerId, PageRequest.of(page, size))
                .map(log -> {
                    CustomerActivityLogEntryDTO dto = new CustomerActivityLogEntryDTO();
                    dto.setId(log.getId());
                    dto.setAction(log.getAction());
                    dto.setDescription(log.getDescription());
                    dto.setPerformedBy(log.getPerformedBy());
                    dto.setPerformedRole(log.getPerformedRole());
                    dto.setPerformedAt(log.getPerformedAt());
                    dto.setIpAddress(log.getIpAddress());
                    return dto;
                });
    }

    /**
     * Logs directly via ActivityLogService (rather than the @LogActivity annotation) so the
     * logged entityId is always the *customer's* id, not the id of whatever sub-resource the
     * write action returns — the AOP aspect infers entityId by reflecting getId() off the
     * return value, which would be wrong for these sub-resource writes.
     */
    private void logCustomerActivity(Long customerId, String action, String description, User performedBy) {
        ActivityLog log = new ActivityLog();
        log.setModule(ENTITY_NAME);
        log.setEntityName(ENTITY_NAME);
        log.setEntityId(customerId);
        log.setAction(action);
        log.setDescription(description);
        log.setPerformedBy(performedBy != null ? performedBy.getName() : "system");
        log.setPerformedRole(performedBy != null && !performedBy.getRoles().isEmpty()
                ? performedBy.getRoles().iterator().next().getName() : "UNKNOWN");
        log.setPerformedAt(LocalDateTime.now());
        activityLogService.saveLog(log);
    }

    // ------------------------------------------------------------------
    // Financial / Project / Communication summaries
    // ------------------------------------------------------------------

    @Cacheable(value = "customer360", key = "'financial:' + #customerId")
    public CustomerFinancialSummaryDTO getFinancialSummary(Long customerId) {
        Customer customer = getCustomerOrThrow(customerId);
        List<Invoice> invoices = invoiceRepository.findByCustomerId(customerId);
        List<CustomerPayment> payments = customerPaymentRepository.findByCustomerId(customerId);

        BigDecimal totalInvoiced = invoices.stream().map(Invoice::getTotalAmount)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPaid = payments.stream().map(CustomerPayment::getAmount)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal advancePaid = payments.stream().filter(p -> p.getInvoice() == null)
                .map(CustomerPayment::getAmount).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstanding = totalInvoiced.subtract(totalPaid).max(BigDecimal.ZERO);

        CustomerFinancialSummaryDTO dto = new CustomerFinancialSummaryDTO();
        dto.setTotalInvoiced(totalInvoiced);
        dto.setTotalPaid(totalPaid);
        dto.setAdvancePaid(advancePaid);
        dto.setOutstandingBalance(outstanding);
        dto.setCreditLimit(customer.getCreditLimit());
        dto.setPaymentTerms(customer.getPaymentTerms());
        dto.setInvoiceCount(invoices.size());
        dto.setPaymentCount(payments.size());
        payments.stream().map(CustomerPayment::getPaymentDate).filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder()).ifPresent(dto::setLastPaymentDate);
        return dto;
    }

    public CustomerProjectSummaryDTO getProjectSummary(Long customerId) {
        List<Project> projects = projectRepository.findByCustomerId(customerId);
        CustomerProjectSummaryDTO dto = new CustomerProjectSummaryDTO();
        dto.setTotalProjects(projects.size());
        dto.setRunningProjects(projects.stream().filter(p -> isStatus(p.getStatus(), "RUNNING")).count());
        dto.setCompletedProjects(projects.stream().filter(p -> isStatus(p.getStatus(), "COMPLETED")).count());
        dto.setCancelledProjects(projects.stream().filter(p -> isStatus(p.getStatus(), "CANCELLED")).count());
        dto.setTotalBudget(projects.stream().map(Project::getBudget).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        dto.setTotalSpent(projects.stream().map(Project::getSpentAmount).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        projects.stream().map(Project::getStartDate).filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder()).ifPresent(dto::setLastProjectDate);
        return dto;
    }

    public CustomerCommunicationSummaryDTO getCommunicationSummary(Long customerId) {
        List<CustomerActivity> activities = customerActivityRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);
        CustomerCommunicationSummaryDTO dto = new CustomerCommunicationSummaryDTO();
        dto.setTotalInteractions(activities.size());
        dto.setCalls(activities.stream().filter(a -> "CALL".equalsIgnoreCase(a.getChannel())).count());
        dto.setWhatsappMessages(activities.stream().filter(a -> "WHATSAPP".equalsIgnoreCase(a.getChannel())).count());
        dto.setEmails(activities.stream().filter(a -> "EMAIL".equalsIgnoreCase(a.getChannel())).count());
        dto.setMeetings(activities.stream().filter(a -> "MEETING".equalsIgnoreCase(a.getChannel())
                || "OFFICE_VISIT".equalsIgnoreCase(a.getChannel()) || "VIDEO_CALL".equalsIgnoreCase(a.getChannel())).count());
        dto.setSiteVisitDiscussions(activities.stream().filter(a -> "SITE_VISIT".equalsIgnoreCase(a.getChannel())).count());
        activities.stream().findFirst().ifPresent(a -> {
            dto.setLastCommunicationDate(a.getCreatedAt());
            dto.setLastCommunicationChannel(a.getChannel());
            dto.setLastCommunicationOutcome(a.getOutcome());
        });
        return dto;
    }

    // ------------------------------------------------------------------
    // Assigned employee (small, additive write — the base CustomerDTO/PUT endpoint is
    // untouched, this is a dedicated action rather than widening that contract)
    // ------------------------------------------------------------------

    @CacheEvict(value = "customer360", key = "'overview:' + #customerId")
    public CustomerOverviewDTO assignEmployee(Long customerId, Long employeeId, String performedByEmail) {
        Customer customer = getCustomerOrThrow(customerId);
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Employee not found"));
        customer.setAssignedEmployee(employee);
        customerRepository.save(customer);
        logCustomerActivity(customerId, "ASSIGNED_EMPLOYEE", "Assigned to " + employee.getName(), resolveUser(performedByEmail));
        return getOverview(customerId);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Customer getCustomerOrThrow(Long customerId) {
        return customerRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Customer not found"));
    }

    private User resolveUser(String email) {
        if (email == null) return null;
        return userRepository.findByEmail(email).orElse(null);
    }
}

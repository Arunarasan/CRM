package com.arudra.crm.service;

import com.arudra.crm.entity.Customer;
import com.arudra.crm.entity.Invoice;
import com.arudra.crm.entity.Project;
import com.arudra.crm.entity.ServiceRequest;
import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.ProjectRepository;
import com.arudra.crm.repository.ServiceRequestRepository;
import com.arudra.crm.repository.SiteSettingRepository;
import com.arudra.crm.repository.TaskRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Post-completion Service & Warranty for a COMPLETED project. Staff activate warranty cover (a
 * service/workmanship period and a product/material period, each with its own end date), then log
 * later customer issues as "service works" — reusing the {@link ServiceRequest} + {@link Task} bridge
 * so they enter the normal task board for assignment. Each work is marked FREE (in-warranty goodwill)
 * or PAID; a PAID one can raise a real Billing invoice via {@link FinanceService#createServiceInvoice}.
 */
@Service
public class ProjectServiceWarrantyService {

    private static final Set<String> WARRANTY_TYPES = Set.of("SERVICE", "PRODUCT", "NONE");
    private static final Set<String> CHARGE_TYPES = Set.of("FREE", "PAID");
    private static final Set<String> WORK_STATUSES = Set.of("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED");

    private static final String KEY_SERVICE_MONTHS = "warranty.service_months";
    private static final String KEY_PRODUCT_MONTHS = "warranty.product_months";
    private static final int DEFAULT_SERVICE_MONTHS = 6;
    private static final int DEFAULT_PRODUCT_MONTHS = 12;

    private final ProjectRepository projectRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final TaskRepository taskRepository;
    private final SiteSettingRepository siteSettingRepository;
    private final FinanceService financeService;
    private final CustomerNotificationService customerNotificationService;

    public ProjectServiceWarrantyService(ProjectRepository projectRepository,
                                         ServiceRequestRepository serviceRequestRepository,
                                         TaskRepository taskRepository,
                                         SiteSettingRepository siteSettingRepository,
                                         FinanceService financeService,
                                         CustomerNotificationService customerNotificationService) {
        this.projectRepository = projectRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.taskRepository = taskRepository;
        this.siteSettingRepository = siteSettingRepository;
        this.financeService = financeService;
        this.customerNotificationService = customerNotificationService;
    }

    // =====================================================================
    // Overview
    // =====================================================================

    @Transactional(readOnly = true)
    public Map<String, Object> getOverview(Long projectId) {
        Project project = load(projectId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projectStatus", project.getStatus());
        out.put("completed", isCompleted(project));
        out.put("warranty", warrantyView(project));
        out.put("defaults", Map.of(
                "serviceMonths", defaultServiceMonths(),
                "productMonths", defaultProductMonths()));

        List<Map<String, Object>> works = new ArrayList<>();
        for (ServiceRequest sr : serviceRequestRepository.findByProject_IdAndIsDeletedFalseOrderByCreatedAtDesc(projectId)) {
            works.add(workView(sr));
        }
        out.put("serviceWorks", works);
        return out;
    }

    // =====================================================================
    // Warranty activation
    // =====================================================================

    @Transactional
    public Map<String, Object> activateWarranty(Long projectId, Map<String, Object> body) {
        Project project = load(projectId);
        requireCompleted(project);

        LocalDate start = parseDate(body.get("startDate"));
        if (start == null) {
            start = project.getActualCompletionDate() != null ? project.getActualCompletionDate() : LocalDate.now();
        }
        int serviceMonths = intOrDefault(body.get("serviceMonths"), defaultServiceMonths());
        int productMonths = intOrDefault(body.get("productMonths"), defaultProductMonths());

        project.setWarrantyActivated(true);
        project.setWarrantyStartDate(start);
        project.setServiceWarrantyMonths(serviceMonths);
        project.setProductWarrantyMonths(productMonths);
        project.setServiceWarrantyEndDate(serviceMonths > 0 ? start.plusMonths(serviceMonths) : null);
        project.setProductWarrantyEndDate(productMonths > 0 ? start.plusMonths(productMonths) : null);
        project.setWarrantyNotes(str(body.get("notes")));
        // Keep the legacy single warranty_end_date pointing at the longer cover, for anything that reads it.
        project.setWarrantyEndDate(laterOf(project.getServiceWarrantyEndDate(), project.getProductWarrantyEndDate()));

        Project saved = projectRepository.save(project);
        return warrantyView(saved);
    }

    // =====================================================================
    // Service works
    // =====================================================================

    @Transactional
    public Map<String, Object> createServiceWork(Long projectId, Map<String, Object> body) {
        Project project = load(projectId);
        requireCompleted(project);
        Customer customer = project.getCustomer();
        if (customer == null) {
            throw new IllegalStateException("This project has no customer to raise a service work against.");
        }

        String subject = str(body.get("subject"));
        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("A subject is required.");
        }

        ServiceRequest sr = new ServiceRequest();
        sr.setCustomer(customer);
        sr.setProject(project);
        sr.setOrigin("STAFF");
        sr.setSubject(subject.trim());
        sr.setIssueType(str(body.get("issueType")));
        sr.setDescription(str(body.get("description")));
        sr.setStatus("OPEN");
        String priority = str(body.get("priority"));
        if (priority != null && !priority.isBlank()) sr.setPriority(priority.trim().toUpperCase());
        sr.setPreferredDate(parseDate(body.get("preferredDate")));
        applyClassification(sr, body);

        ServiceRequest savedSr = serviceRequestRepository.save(sr);

        // Bridge into the CRM task board so the work can be assigned like any other job.
        Task task = new Task();
        task.setTaskName("Service Work: " + savedSr.getSubject());
        task.setDescription(savedSr.getDescription());
        task.setStatus("PENDING");
        task.setPriority(mapPriority(savedSr.getPriority()));
        task.setSource("SERVICE_REQUEST");
        task.setProject(project);
        task.setCustomerId(customer.getId());
        if (savedSr.getPreferredDate() != null) task.setDueDate(savedSr.getPreferredDate());
        Task savedTask = taskRepository.save(task);
        savedSr.setTask(savedTask);
        serviceRequestRepository.save(savedSr);

        return workView(savedSr);
    }

    @Transactional
    public Map<String, Object> updateServiceWork(Long id, Map<String, Object> body) {
        ServiceRequest sr = loadWork(id);

        if (body.containsKey("subject")) {
            String subject = str(body.get("subject"));
            if (subject != null && !subject.isBlank()) sr.setSubject(subject.trim());
        }
        if (body.containsKey("issueType")) sr.setIssueType(str(body.get("issueType")));
        if (body.containsKey("description")) sr.setDescription(str(body.get("description")));
        if (body.containsKey("priority")) {
            String priority = str(body.get("priority"));
            if (priority != null && !priority.isBlank()) sr.setPriority(priority.trim().toUpperCase());
        }
        if (body.containsKey("preferredDate")) sr.setPreferredDate(parseDate(body.get("preferredDate")));
        if (body.containsKey("resolutionNotes")) sr.setResolutionNotes(str(body.get("resolutionNotes")));
        applyClassification(sr, body);

        if (body.containsKey("status")) {
            String next = str(body.get("status"));
            if (next != null && WORK_STATUSES.contains(next.trim().toUpperCase())) {
                next = next.trim().toUpperCase();
                sr.setStatus(next);
                // Keep the linked task in step with the work's lifecycle.
                Task task = sr.getTask();
                if (task != null) {
                    if (next.equals("RESOLVED") || next.equals("CLOSED")) task.setStatus("COMPLETED");
                    else if (next.equals("IN_PROGRESS")) task.setStatus("IN_PROGRESS");
                    taskRepository.save(task);
                }
            }
        }

        ServiceRequest saved = serviceRequestRepository.save(sr);
        return workView(saved);
    }

    @Transactional
    public Map<String, Object> raiseInvoice(Long id, Map<String, Object> body, User user) {
        ServiceRequest sr = loadWork(id);
        if (!"PAID".equalsIgnoreCase(sr.getChargeType())) {
            throw new IllegalStateException("Only a PAID service work can be invoiced. Set it to Paid first.");
        }
        if (sr.getInvoice() != null) {
            throw new IllegalStateException("An invoice has already been raised for this service work.");
        }

        BigDecimal amount = decimal(body.get("chargeAmount"));
        if (amount == null) amount = sr.getChargeAmount();
        BigDecimal gstRate = decimal(body.get("gstRate"));
        String gstType = str(body.get("gstType"));
        boolean collectNow = Boolean.parseBoolean(String.valueOf(body.get("collectNow")));
        String paymentMethod = str(body.get("paymentMethod"));

        Invoice invoice = financeService.createServiceInvoice(sr, amount, gstRate, gstType, collectNow, paymentMethod, user);
        sr.setInvoice(invoice);
        sr.setChargeAmount(amount);
        ServiceRequest saved = serviceRequestRepository.save(sr);

        if (saved.getCustomer() != null) {
            customerNotificationService.notify(saved.getCustomer(), "SERVICE_REQUEST",
                    "Invoice for \"" + saved.getSubject() + "\"",
                    "An invoice (" + invoice.getInvoiceNumber() + ") has been raised for your service request.",
                    "/portal/invoices");
        }
        return workView(saved);
    }

    // =====================================================================
    // Views
    // =====================================================================

    private Map<String, Object> warrantyView(Project p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("activated", p.isWarrantyActivated());
        m.put("startDate", p.getWarrantyStartDate());
        m.put("notes", p.getWarrantyNotes());
        m.put("service", coverView(p.getServiceWarrantyMonths(), p.getServiceWarrantyEndDate()));
        m.put("product", coverView(p.getProductWarrantyMonths(), p.getProductWarrantyEndDate()));
        return m;
    }

    private Map<String, Object> coverView(Integer months, LocalDate endDate) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("months", months);
        m.put("endDate", endDate);
        boolean inWarranty = endDate != null && !endDate.isBefore(LocalDate.now());
        m.put("inWarranty", inWarranty);
        m.put("daysLeft", endDate == null ? null : ChronoUnit.DAYS.between(LocalDate.now(), endDate));
        return m;
    }

    private Map<String, Object> workView(ServiceRequest sr) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", sr.getId());
        m.put("subject", sr.getSubject());
        m.put("issueType", sr.getIssueType());
        m.put("description", sr.getDescription());
        m.put("priority", sr.getPriority());
        m.put("status", sr.getStatus());
        m.put("origin", sr.getOrigin());
        m.put("warrantyType", sr.getWarrantyType());
        m.put("chargeType", sr.getChargeType());
        m.put("chargeAmount", sr.getChargeAmount());
        m.put("resolutionNotes", sr.getResolutionNotes());
        m.put("preferredDate", sr.getPreferredDate());
        m.put("createdAt", sr.getCreatedAt());
        m.put("taskId", sr.getTask() != null ? sr.getTask().getId() : null);
        Invoice inv = sr.getInvoice();
        m.put("invoiceId", inv != null ? inv.getId() : null);
        m.put("invoiceNumber", inv != null ? inv.getInvoiceNumber() : null);
        m.put("invoiceStatus", inv != null ? inv.getStatus() : null);
        return m;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /** Apply warrantyType / chargeType / chargeAmount from a create-or-update body, if present + valid. */
    private void applyClassification(ServiceRequest sr, Map<String, Object> body) {
        if (body.containsKey("warrantyType")) {
            String wt = str(body.get("warrantyType"));
            sr.setWarrantyType(wt == null || wt.isBlank() ? null
                    : requireIn(wt.trim().toUpperCase(), WARRANTY_TYPES, "warranty type"));
        }
        if (body.containsKey("chargeType")) {
            String ct = str(body.get("chargeType"));
            sr.setChargeType(ct == null || ct.isBlank() ? null
                    : requireIn(ct.trim().toUpperCase(), CHARGE_TYPES, "charge type"));
        }
        if (body.containsKey("chargeAmount")) sr.setChargeAmount(decimal(body.get("chargeAmount")));
    }

    private Project load(Long projectId) {
        return projectRepository.findById(projectId)
                .filter(p -> !Boolean.TRUE.equals(p.getIsDeleted()))
                .orElseThrow(() -> new EntityNotFoundException("Project not found: " + projectId));
    }

    private ServiceRequest loadWork(Long id) {
        return serviceRequestRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Service work not found: " + id));
    }

    private void requireCompleted(Project project) {
        if (!isCompleted(project)) {
            throw new IllegalStateException("Service & warranty is available only after the project is completed.");
        }
    }

    private boolean isCompleted(Project project) {
        return "COMPLETED".equalsIgnoreCase(project.getStatus());
    }

    private int defaultServiceMonths() {
        return settingInt(KEY_SERVICE_MONTHS, DEFAULT_SERVICE_MONTHS);
    }

    private int defaultProductMonths() {
        return settingInt(KEY_PRODUCT_MONTHS, DEFAULT_PRODUCT_MONTHS);
    }

    private int settingInt(String key, int fallback) {
        return siteSettingRepository.findBySettingKeyAndIsDeletedFalse(key)
                .map(s -> {
                    try { return Integer.parseInt(s.getSettingValue().trim()); }
                    catch (Exception e) { return fallback; }
                })
                .orElse(fallback);
    }

    /** Service-request priorities include URGENT; the Task board uses LOW/MEDIUM/HIGH. */
    private String mapPriority(String p) {
        if (p == null) return "MEDIUM";
        String up = p.toUpperCase();
        return up.equals("URGENT") ? "HIGH" : (up.equals("LOW") || up.equals("HIGH") ? up : "MEDIUM");
    }

    private static String requireIn(String value, Set<String> allowed, String label) {
        if (!allowed.contains(value)) throw new IllegalArgumentException("Unknown " + label + ": " + value);
        return value;
    }

    private static LocalDate laterOf(LocalDate a, LocalDate b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private static LocalDate parseDate(Object o) {
        if (o == null || o.toString().isBlank()) return null;
        try { return LocalDate.parse(o.toString().trim()); } catch (Exception e) { return null; }
    }

    private static int intOrDefault(Object o, int fallback) {
        if (o == null || o.toString().isBlank()) return fallback;
        try { return (int) Math.round(Double.parseDouble(o.toString().trim())); } catch (Exception e) { return fallback; }
    }

    private static BigDecimal decimal(Object o) {
        if (o == null || o.toString().isBlank()) return null;
        try { return new BigDecimal(o.toString().trim()); } catch (Exception e) { return null; }
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import com.arudra.crm.security.CustomerAccessService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Read/write side of the customer portal. Every method is scoped to the customer id(s) the acting
 * user may access ({@link CustomerAccessService}); nothing takes a customer id from the client. All
 * responses are curated maps of customer-appropriate fields only — never the raw entities, so no
 * internal cost/margin/supplier/employee data can leak.
 */
@Service
public class CustomerPortalService {

    private final CustomerAccessService access;
    private final CustomerRepository customerRepository;
    private final ProjectRepository projectRepository;
    private final QuotationRepository quotationRepository;
    private final InvoiceRepository invoiceRepository;
    private final CustomerPaymentRepository paymentRepository;
    private final CustomerDocumentRepository documentRepository;
    private final OrderRepository orderRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final CustomerNotificationRepository notificationRepository;
    private final TaskRepository taskRepository;
    private final CustomerNotificationService notificationService;
    private final ServiceRepository serviceRepository;
    private final ServiceReviewRepository serviceReviewRepository;

    public CustomerPortalService(CustomerAccessService access, CustomerRepository customerRepository,
                                 ProjectRepository projectRepository, QuotationRepository quotationRepository,
                                 InvoiceRepository invoiceRepository, CustomerPaymentRepository paymentRepository,
                                 CustomerDocumentRepository documentRepository, OrderRepository orderRepository,
                                 ServiceRequestRepository serviceRequestRepository,
                                 CustomerNotificationRepository notificationRepository,
                                 TaskRepository taskRepository,
                                 CustomerNotificationService notificationService,
                                 ServiceRepository serviceRepository,
                                 ServiceReviewRepository serviceReviewRepository) {
        this.access = access;
        this.customerRepository = customerRepository;
        this.projectRepository = projectRepository;
        this.quotationRepository = quotationRepository;
        this.invoiceRepository = invoiceRepository;
        this.paymentRepository = paymentRepository;
        this.documentRepository = documentRepository;
        this.orderRepository = orderRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.notificationRepository = notificationRepository;
        this.taskRepository = taskRepository;
        this.notificationService = notificationService;
        this.serviceRepository = serviceRepository;
        this.serviceReviewRepository = serviceReviewRepository;
    }

    private List<Long> ids(User user) {
        List<Long> ids = access.accessibleCustomerIds(user);
        if (ids.isEmpty()) throw new AccessDeniedException("No customer account is linked to this login.");
        return ids;
    }

    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    // ---- Profile ----
    public Map<String, Object> profile(User user) {
        Customer c = access.primaryCustomer(user);
        return map(
                "id", c.getId(), "name", c.getName(), "email", c.getEmail(), "phone", c.getPhone(),
                "whatsappNumber", c.getWhatsappNumber(), "city", c.getCity(), "state", c.getState(),
                "companyName", c.getCompanyName(), "customerCode", c.getCustomerCode(),
                "billingAddress", c.getBillingAddress(), "siteAddress", c.getSiteAddress());
    }

    @Transactional
    public Map<String, Object> updateProfile(User user, Map<String, String> updates) {
        Customer c = access.primaryCustomer(user);
        if (updates.containsKey("name") && updates.get("name") != null && !updates.get("name").isBlank())
            c.setName(updates.get("name").trim());
        if (updates.containsKey("phone")) c.setPhone(updates.get("phone"));
        if (updates.containsKey("whatsappNumber")) c.setWhatsappNumber(updates.get("whatsappNumber"));
        if (updates.containsKey("email")) c.setEmail(updates.get("email"));
        customerRepository.save(c);
        return profile(user);
    }

    // ---- Projects ----
    public List<Map<String, Object>> projects(User user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids(user)) {
            for (Project p : projectRepository.findByCustomerId(id)) {
                if (Boolean.TRUE.equals(p.getIsDeleted())) continue;
                out.add(projectSummary(p));
            }
        }
        return out;
    }

    public Map<String, Object> project(User user, Long projectId) {
        Project p = projectRepository.findById(projectId)
                .orElseThrow(() -> new AccessDeniedException("Project not found"));
        Long ownerId = p.getCustomer() != null ? p.getCustomer().getId() : null;
        access.assertAccess(user, ownerId);
        Map<String, Object> m = projectSummary(p);
        m.put("propertyAddress", p.getPropertyAddress());
        m.put("startDate", p.getStartDate());
        m.put("endDate", p.getEndDate());
        m.put("actualCompletionDate", p.getActualCompletionDate());
        m.put("customerNotes", p.getCustomerNotes());
        return m;
    }

    private Map<String, Object> projectSummary(Project p) {
        return map(
                "id", p.getId(), "name", p.getProjectName(), "code", p.getProjectCode(),
                "status", p.getStatus(), "progress", p.getProgress() == null ? 0 : p.getProgress(),
                "projectType", p.getProjectType());
    }

    // ---- Quotations ----
    public List<Map<String, Object>> quotations(User user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids(user)) {
            for (Quotation q : quotationRepository.findByCustomerId(id)) {
                if (Boolean.TRUE.equals(q.getIsDeleted())) continue;
                out.add(map(
                        "id", q.getId(), "quotationNumber", q.getQuotationNumber(),
                        "date", q.getQuotationDate(), "status", q.getStatus(),
                        "grandTotal", q.getGrandTotal()));
            }
        }
        return out;
    }

    // ---- Invoices ----
    public List<Map<String, Object>> invoices(User user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids(user)) {
            for (Invoice inv : invoiceRepository.findByCustomerId(id)) {
                if (Boolean.TRUE.equals(inv.getIsDeleted())) continue;
                out.add(map(
                        "id", inv.getId(), "invoiceNumber", inv.getInvoiceNumber(),
                        "date", inv.getDate(), "dueDate", inv.getDueDate(), "status", inv.getStatus(),
                        "totalAmount", inv.getTotalAmount(), "amountPaid", inv.getAmountPaid(),
                        "balanceDue", inv.getBalanceDue()));
            }
        }
        return out;
    }

    // ---- Payments ----
    public List<Map<String, Object>> payments(User user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids(user)) {
            for (CustomerPayment pay : paymentRepository.findByCustomerId(id)) {
                if (Boolean.TRUE.equals(pay.getIsDeleted())) continue;
                out.add(map(
                        "id", pay.getId(), "paymentNumber", pay.getPaymentNumber(),
                        "date", pay.getPaymentDate(), "amount", pay.getAmount(),
                        "method", pay.getPaymentMethod(), "status", pay.getStatus()));
            }
        }
        return out;
    }

    // ---- Documents ----
    public List<Map<String, Object>> documents(User user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids(user)) {
            for (CustomerDocument d : documentRepository.findByCustomerIdOrderByCreatedAtDesc(id)) {
                if (Boolean.TRUE.equals(d.getIsDeleted())) continue;
                out.add(map(
                        "id", d.getId(), "fileName", d.getFileName(),
                        "fileUrl", d.getFileUrl(), "fileType", d.getFileType(),
                        "uploadedAt", d.getCreatedAt()));
            }
        }
        return out;
    }

    // ---- Orders ----
    public List<Map<String, Object>> orders(User user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids(user)) {
            for (Order o : orderRepository.findByCustomer_IdAndIsDeletedFalseOrderByCreatedAtDesc(id)) {
                out.add(map(
                        "id", o.getId(), "orderNumber", o.getOrderNumber(), "status", o.getStatus(),
                        "total", o.getTotal(), "paymentStatus", o.getPaymentStatus(),
                        "placedAt", o.getPlacedAt(), "itemCount", o.getItems() == null ? 0 : o.getItems().size()));
            }
        }
        return out;
    }

    // ---- Service requests ----
    public List<Map<String, Object>> serviceRequests(User user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids(user)) {
            for (ServiceRequest sr : serviceRequestRepository.findByCustomer_IdAndIsDeletedFalseOrderByCreatedAtDesc(id)) {
                out.add(map(
                        "id", sr.getId(), "subject", sr.getSubject(), "issueType", sr.getIssueType(),
                        "priority", sr.getPriority(), "status", sr.getStatus(),
                        "createdAt", sr.getCreatedAt()));
            }
        }
        return out;
    }

    @Transactional
    public Map<String, Object> createServiceRequest(User user, Map<String, Object> body) {
        Customer customer = access.primaryCustomer(user);
        ServiceRequest sr = new ServiceRequest();
        sr.setCustomer(customer);
        sr.setSubject(str(body.get("subject")));
        sr.setIssueType(str(body.get("issueType")));
        sr.setDescription(str(body.get("description")));
        String priority = str(body.get("priority"));
        if (priority != null && !priority.isBlank()) sr.setPriority(priority);
        Object pd = body.get("preferredDate");
        if (pd != null && !pd.toString().isBlank()) {
            try { sr.setPreferredDate(LocalDate.parse(pd.toString())); } catch (Exception ignored) {}
        }
        // Optional project link — only if the customer owns it.
        Object projectId = body.get("projectId");
        if (projectId != null && !projectId.toString().isBlank()) {
            Long pid = Long.valueOf(projectId.toString());
            Project project = projectRepository.findById(pid).orElse(null);
            if (project != null && project.getCustomer() != null) {
                access.assertAccess(user, project.getCustomer().getId());
                sr.setProject(project);
            }
        }
        if (sr.getSubject() == null || sr.getSubject().isBlank()) {
            throw new IllegalArgumentException("A subject is required.");
        }
        ServiceRequest saved = serviceRequestRepository.save(sr);

        // Bridge into the CRM: spawn a Task so the request enters the internal work queue for
        // assignment. Task requires only task_name / priority / status / source; project is optional.
        Task task = new Task();
        task.setTaskName("Service Request: " + saved.getSubject());
        task.setDescription(saved.getDescription());
        task.setStatus("PENDING");
        task.setPriority(mapPriority(saved.getPriority()));
        task.setSource("SERVICE_REQUEST");
        if (saved.getProject() != null) task.setProject(saved.getProject());
        Task savedTask = taskRepository.save(task);
        saved.setTask(savedTask);
        serviceRequestRepository.save(saved);

        // Let the customer know it's been received.
        notificationService.notify(customer, "SERVICE_REQUEST",
                "Service request received",
                "We've received \"" + saved.getSubject() + "\" and our team will be in touch.",
                "/portal/service-requests");

        return map("id", saved.getId(), "subject", saved.getSubject(), "status", saved.getStatus());
    }

    /** Service-request priorities include URGENT; the Task board uses LOW/MEDIUM/HIGH. */
    private String mapPriority(String p) {
        if (p == null) return "MEDIUM";
        String up = p.toUpperCase();
        return up.equals("URGENT") ? "HIGH" : (up.equals("LOW") || up.equals("HIGH") ? up : "MEDIUM");
    }

    // ---- Services & reviews ----
    /** Active services the client can review, each with its rating summary + this client's own review. */
    public List<Map<String, Object>> services(User user) {
        Long customerId = access.primaryCustomer(user).getId();
        List<Map<String, Object>> out = new ArrayList<>();
        for (com.arudra.crm.entity.Service s : serviceRepository.findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc()) {
            List<ServiceReview> approved = serviceReviewRepository
                    .findByService_IdAndStatusAndIsDeletedFalseOrderByCreatedAtDesc(s.getId(), "APPROVED");
            double avg = approved.isEmpty() ? 0
                    : approved.stream().mapToInt(ServiceReview::getRating).average().orElse(0);
            ServiceReview mine = serviceReviewRepository
                    .findByService_IdAndCustomer_IdAndIsDeletedFalse(s.getId(), customerId).orElse(null);
            out.add(map(
                    "id", s.getId(), "title", s.getTitle(), "slug", s.getSlug(),
                    "shortDescription", s.getShortDescription(), "imageUrl", s.getImageUrl(),
                    "avgRating", Math.round(avg * 10) / 10.0, "reviewCount", approved.size(),
                    "myRating", mine != null ? mine.getRating() : null,
                    "myComment", mine != null ? mine.getComment() : null));
        }
        return out;
    }

    /** Create or update this client's review of a service (one per customer per service). */
    @Transactional
    public Map<String, Object> reviewService(User user, Long serviceId, Integer rating, String comment) {
        Customer customer = access.primaryCustomer(user);
        if (rating == null || rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Please give a rating from 1 to 5.");
        }
        final com.arudra.crm.entity.Service service = serviceRepository.findByIdAndIsDeletedFalse(serviceId)
                .orElseThrow(() -> new AccessDeniedException("Service not found"));
        if (Boolean.FALSE.equals(service.getActive())) {
            throw new IllegalArgumentException("This service is not available for review.");
        }
        ServiceReview review = serviceReviewRepository
                .findByService_IdAndCustomer_IdAndIsDeletedFalse(serviceId, customer.getId())
                .orElseGet(() -> {
                    ServiceReview r = new ServiceReview();
                    r.setService(service);
                    r.setCustomer(customer);
                    return r;
                });
        review.setRating(rating);
        review.setComment(comment == null ? null : comment.trim());
        review.setStatus("APPROVED");
        serviceReviewRepository.save(review);
        return map("serviceId", service.getId(), "myRating", rating, "myComment", review.getComment());
    }

    // ---- Notifications ----
    public List<Map<String, Object>> notifications(User user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids(user)) {
            for (CustomerNotification n : notificationRepository.findByCustomer_IdAndIsDeletedFalseOrderByCreatedAtDesc(id)) {
                out.add(map(
                        "id", n.getId(), "type", n.getType(), "title", n.getTitle(), "body", n.getBody(),
                        "link", n.getLink(), "read", n.getReadAt() != null, "createdAt", n.getCreatedAt()));
            }
        }
        return out;
    }

    @Transactional
    public void markNotificationRead(User user, Long notificationId) {
        CustomerNotification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new AccessDeniedException("Notification not found"));
        access.assertAccess(user, n.getCustomer().getId());
        if (n.getReadAt() == null) {
            n.setReadAt(LocalDateTime.now());
            notificationRepository.save(n);
        }
    }

    // ---- Dashboard ----
    public Map<String, Object> dashboard(User user) {
        List<Long> ids = ids(user);
        long activeProjects = 0;
        BigDecimal pending = BigDecimal.ZERO;
        int openRequests = 0;
        long unread = 0;
        for (Long id : ids) {
            for (Project p : projectRepository.findByCustomerId(id)) {
                if (Boolean.TRUE.equals(p.getIsDeleted())) continue;
                String s = p.getStatus() == null ? "" : p.getStatus().toUpperCase();
                if (!s.equals("COMPLETED") && !s.equals("CANCELLED") && !s.equals("CLOSED")) activeProjects++;
            }
            for (Invoice inv : invoiceRepository.findByCustomerId(id)) {
                if (Boolean.TRUE.equals(inv.getIsDeleted())) continue;
                if (inv.getBalanceDue() != null) pending = pending.add(inv.getBalanceDue());
            }
            for (ServiceRequest sr : serviceRequestRepository.findByCustomer_IdAndIsDeletedFalseOrderByCreatedAtDesc(id)) {
                String st = sr.getStatus() == null ? "" : sr.getStatus().toUpperCase();
                if (st.equals("OPEN") || st.equals("IN_PROGRESS")) openRequests++;
            }
            unread += notificationRepository.countByCustomer_IdAndReadAtIsNullAndIsDeletedFalse(id);
        }
        Customer c = access.primaryCustomer(user);
        return map(
                "customerName", c.getName(),
                "activeProjects", activeProjects,
                "pendingPayment", pending,
                "openServiceRequests", openRequests,
                "unreadNotifications", unread,
                "recentDocuments", documents(user).stream().limit(5).toList());
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}

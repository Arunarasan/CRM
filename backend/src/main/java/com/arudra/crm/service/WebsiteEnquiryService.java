package com.arudra.crm.service;

import com.arudra.crm.dto.website.WebsiteEnquiryDto.Detail;
import com.arudra.crm.dto.website.WebsiteEnquiryDto.ProductQuoteRequest;
import com.arudra.crm.dto.website.WebsiteEnquiryDto.Summary;
import com.arudra.crm.dto.website.WebsiteLeadRequest;
import com.arudra.crm.entity.Lead;
import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.WebsiteEnquiry;
import com.arudra.crm.repository.TaskRepository;
import com.arudra.crm.repository.WebsiteEnquiryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * The Website Enquiry inbox. Public site submissions (contact / consultation / product quote) land
 * here as first-class {@link WebsiteEnquiry} records rather than going straight to a lead. Each new
 * enquiry raises an ENQUIRY {@link Task} so it shows on the board, and the admin converts a qualified
 * enquiry into a CRM {@link Lead} — reusing {@link WebsiteLeadService} so the full lead workflow fires.
 */
@Service
public class WebsiteEnquiryService {

    private static final List<String> STATUSES = List.of("NEW", "IN_PROGRESS", "CONVERTED", "CLOSED");

    private final WebsiteEnquiryRepository repo;
    private final TaskRepository taskRepository;
    private final WebsiteLeadService websiteLeadService;
    private final NotificationService notificationService;

    public WebsiteEnquiryService(WebsiteEnquiryRepository repo, TaskRepository taskRepository,
                                 WebsiteLeadService websiteLeadService, NotificationService notificationService) {
        this.repo = repo;
        this.taskRepository = taskRepository;
        this.websiteLeadService = websiteLeadService;
        this.notificationService = notificationService;
    }

    // ------------------------------------------------------------------ public intake

    @Transactional
    public WebsiteEnquiry createFromForm(WebsiteLeadRequest req, String channel, String sourceLabel) {
        if (req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("Name is required.");
        }
        WebsiteEnquiry e = new WebsiteEnquiry();
        e.setChannel(channel);
        e.setSourceLabel(sourceLabel);
        e.setName(req.name().trim());
        if (notBlank(req.phone())) e.setPhone(req.phone().trim());
        if (notBlank(req.email())) e.setEmail(req.email().trim());
        if (notBlank(req.location())) e.setCity(req.location().trim());
        if (notBlank(req.projectType())) e.setInterest(req.projectType().trim());
        if (notBlank(req.propertyType())) e.setPropertyType(req.propertyType().trim());
        if (notBlank(req.area())) e.setArea(req.area().trim());
        if (notBlank(req.budget())) e.setBudget(req.budget().trim());
        if (notBlank(req.preferredDate())) e.setPreferredDate(req.preferredDate().trim());
        e.setMessage(buildMessage(req));
        return persistWithTask(e);
    }

    @Transactional
    public WebsiteEnquiry createProductQuote(ProductQuoteRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("Name is required.");
        }
        WebsiteEnquiry e = new WebsiteEnquiry();
        e.setChannel("PRODUCT_QUOTE");
        e.setSourceLabel("Website Product Quote");
        e.setName(req.name().trim());
        if (notBlank(req.phone())) e.setPhone(req.phone().trim());
        if (notBlank(req.email())) e.setEmail(req.email().trim());
        if (notBlank(req.productName())) e.setInterest(req.productName().trim());
        if (notBlank(req.productSlug())) e.setProductSlug(req.productSlug().trim());
        if (notBlank(req.message())) e.setMessage(req.message().trim());
        return persistWithTask(e);
    }

    /** Save the enquiry, raise its ENQUIRY task, and alert the admins. */
    private WebsiteEnquiry persistWithTask(WebsiteEnquiry e) {
        WebsiteEnquiry saved = repo.save(e);

        Task task = new Task();
        task.setTaskName("Enquiry: " + (notBlank(saved.getInterest()) ? saved.getInterest() : saved.getName()));
        task.setStatus("PENDING");
        task.setPriority("MEDIUM");
        task.setSource("ENQUIRY");
        task.setDescription(taskDescription(saved));
        Task savedTask = taskRepository.save(task);

        saved.setTaskId(savedTask.getId());
        repo.save(saved);

        notificationService.dispatchToAdmins(
                "New website enquiry",
                saved.getName() + (notBlank(saved.getInterest()) ? " · " + saved.getInterest() : "")
                        + " · " + friendlyChannel(saved.getChannel()),
                "ENQUIRY", "/website/enquiries", null);

        return saved;
    }

    // ------------------------------------------------------------------ admin

    @Transactional(readOnly = true)
    public List<Summary> list(String status) {
        List<WebsiteEnquiry> rows = (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status))
                ? repo.findByIsDeletedFalseOrderByCreatedAtDesc()
                : repo.findByStatusAndIsDeletedFalseOrderByCreatedAtDesc(status.toUpperCase());
        return rows.stream().map(Summary::of).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Detail get(Long id) {
        return Detail.of(find(id));
    }

    @Transactional
    public Detail updateStatus(Long id, String status) {
        if (status == null || !STATUSES.contains(status.toUpperCase())) {
            throw new IllegalArgumentException("Unknown status: " + status);
        }
        WebsiteEnquiry e = find(id);
        e.setStatus(status.toUpperCase());
        return Detail.of(repo.save(e));
    }

    /** Convert a qualified enquiry into a CRM lead (idempotent — returns the existing lead if already done). */
    @Transactional
    public Detail convertToLead(Long id) {
        WebsiteEnquiry e = find(id);
        if (e.getLeadId() != null) return Detail.of(e);

        WebsiteLeadRequest req = new WebsiteLeadRequest(
                e.getName(), e.getPhone(), e.getEmail(), e.getCity(), e.getInterest(),
                e.getPropertyType(), e.getArea(), e.getBudget(), e.getPreferredDate(),
                e.getMessage(), null);
        Lead lead = websiteLeadService.createFromWebsite(req,
                e.getSourceLabel() != null ? e.getSourceLabel() : "Website Enquiry");

        e.setLeadId(lead.getId());
        e.setStatus("CONVERTED");
        return Detail.of(repo.save(e));
    }

    // ------------------------------------------------------------------ helpers

    private WebsiteEnquiry find(Long id) {
        return repo.findById(id)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Enquiry not found: " + id));
    }

    private String buildMessage(WebsiteLeadRequest req) {
        StringBuilder sb = new StringBuilder();
        if (notBlank(req.message())) sb.append(req.message().trim());
        if (notBlank(req.concept())) sb.append(sb.length() > 0 ? "\n" : "").append("Design Studio concept: ").append(req.concept().trim());
        return sb.length() == 0 ? null : sb.toString();
    }

    private String taskDescription(WebsiteEnquiry e) {
        StringBuilder sb = new StringBuilder(friendlyChannel(e.getChannel())).append(" from the website.\n");
        sb.append("Name: ").append(e.getName());
        if (notBlank(e.getPhone())) sb.append("\nPhone: ").append(e.getPhone());
        if (notBlank(e.getEmail())) sb.append("\nEmail: ").append(e.getEmail());
        if (notBlank(e.getCity())) sb.append("\nCity: ").append(e.getCity());
        if (notBlank(e.getInterest())) sb.append("\nInterested in: ").append(e.getInterest());
        if (notBlank(e.getMessage())) sb.append("\n\n").append(e.getMessage());
        return sb.toString();
    }

    private String friendlyChannel(String channel) {
        if (channel == null) return "Enquiry";
        return switch (channel) {
            case "CONSULTATION" -> "Consultation request";
            case "PRODUCT_QUOTE" -> "Product quote";
            default -> "Contact enquiry";
        };
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}

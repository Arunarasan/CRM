package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.*;

/**
 * Powers the public, no-login project tracking page ({@code /track/{token}}) — an Amazon/Flipkart
 * style order-tracking view. The share token is the only credential: it resolves exactly one project
 * and the response is a curated, customer-safe whitelist (timeline, progress, current activity).
 * Nothing financial or internal (budget, costs, internal notes, team) is ever exposed here.
 */
@Service
public class PublicProjectTrackingService {

    private final ProjectRepository projectRepository;
    private final ProjectPhaseRepository phaseRepository;
    private final ProjectActivityLogRepository activityLogRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final TaskRepository taskRepository;
    private final ProjectReviewRepository reviewRepository;
    private final NotificationService notificationService;

    public PublicProjectTrackingService(ProjectRepository projectRepository,
                                        ProjectPhaseRepository phaseRepository,
                                        ProjectActivityLogRepository activityLogRepository,
                                        ServiceRequestRepository serviceRequestRepository,
                                        TaskRepository taskRepository,
                                        ProjectReviewRepository reviewRepository,
                                        NotificationService notificationService) {
        this.projectRepository = projectRepository;
        this.phaseRepository = phaseRepository;
        this.activityLogRepository = activityLogRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.taskRepository = taskRepository;
        this.reviewRepository = reviewRepository;
        this.notificationService = notificationService;
    }

    /** Resolve the project behind a token, or 404 if the token is unknown, deleted, or tracking is off. */
    private Project resolve(String token) {
        Project p = projectRepository.findByShareToken(token)
                .filter(pr -> !Boolean.TRUE.equals(pr.getIsDeleted()) && pr.isTrackingEnabled())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracking link not found."));
        return p;
    }

    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    // ---- Read: the tracking view ----
    @Transactional(readOnly = true)
    public Map<String, Object> track(String token) {
        Project p = resolve(token);

        // Timeline: real project phases in sequence. Falls back to a canonical journey if none exist yet.
        List<ProjectPhase> phases = phaseRepository.findByProjectIdOrderBySequenceAsc(p.getId());
        List<Map<String, Object>> steps = new ArrayList<>();
        String currentActivity = null;
        if (!phases.isEmpty()) {
            for (ProjectPhase ph : phases) {
                boolean done = "COMPLETED".equalsIgnoreCase(ph.getStatus());
                boolean active = "IN_PROGRESS".equalsIgnoreCase(ph.getStatus());
                if (active && currentActivity == null) currentActivity = ph.getName();
                steps.add(map(
                        "name", ph.getName(),
                        "status", done ? "DONE" : active ? "CURRENT" : "PENDING",
                        "percent", ph.getCompletionPercentage() == null ? 0 : ph.getCompletionPercentage(),
                        "startDate", ph.getStartDate(),
                        "endDate", ph.getEndDate()));
            }
        } else {
            String[] canonical = {"Consultation", "Design", "Quotation", "Material Selection",
                    "Production", "Installation", "Completion"};
            int prog = p.getProgress() == null ? 0 : p.getProgress();
            int done = Math.round((prog / 100f) * canonical.length);
            for (int i = 0; i < canonical.length; i++) {
                steps.add(map("name", canonical[i],
                        "status", i < done ? "DONE" : i == done ? "CURRENT" : "PENDING",
                        "percent", i < done ? 100 : 0));
            }
        }

        // "What's being done now" — most recent activity log entries (operational, customer-safe).
        List<Map<String, Object>> updates = new ArrayList<>();
        List<ProjectActivityLog> logs = activityLogRepository.findByProjectIdOrderByTimeDesc(p.getId());
        for (ProjectActivityLog l : logs.stream().limit(8).toList()) {
            updates.add(map("time", l.getTime(), "description", l.getDescription()));
        }
        if (currentActivity == null && !updates.isEmpty()) {
            currentActivity = (String) updates.get(0).get("description");
        }

        // Approved reviews (so the customer sees their own once posted).
        List<Map<String, Object>> reviews = new ArrayList<>();
        for (ProjectReview r : reviewRepository
                .findByProjectIdAndStatusAndIsDeletedFalseOrderByCreatedAtDesc(p.getId(), "APPROVED")) {
            reviews.add(map("reviewerName", r.getReviewerName(), "rating", r.getRating(),
                    "comment", r.getComment(), "date", r.getCreatedAt()));
        }

        return map(
                "projectName", p.getProjectName(),
                "projectCode", p.getProjectCode(),
                "status", p.getStatus(),
                "progress", p.getProgress() == null ? 0 : p.getProgress(),
                "projectType", p.getProjectType(),
                "propertyAddress", p.getPropertyAddress(),
                "startDate", p.getStartDate(),
                "expectedCompletionDate", p.getEndDate(),
                "actualCompletionDate", p.getActualCompletionDate(),
                "customerNotes", p.getCustomerNotes(),
                "currentActivity", currentActivity,
                "timeline", steps,
                "updates", updates,
                "reviews", reviews);
    }

    // ---- Write: a request from the public page ----
    @Transactional
    public Map<String, Object> submitRequest(String token, Map<String, Object> body) {
        Project p = resolve(token);
        String subject = str(body.get("subject"));
        String message = str(body.get("description"));
        if (subject == null || subject.isBlank()) subject = "Request from tracking page";
        if ((message == null || message.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please describe your request.");
        }

        String name = str(body.get("name"));
        String contact = str(body.get("contact"));
        StringBuilder desc = new StringBuilder(message);
        if (name != null && !name.isBlank()) desc.append("\n\n— ").append(name.trim());
        if (contact != null && !contact.isBlank()) desc.append(" (").append(contact.trim()).append(")");

        ServiceRequest sr = new ServiceRequest();
        sr.setCustomer(p.getCustomer());
        sr.setProject(p);
        sr.setSubject(subject.trim());
        sr.setDescription(desc.toString());
        sr.setIssueType("TRACKING_PAGE");
        sr.setPriority("MEDIUM");
        ServiceRequest saved = serviceRequestRepository.save(sr);

        // Bridge into the internal work queue as a Task, same as the portal path.
        Task task = new Task();
        task.setTaskName("Tracking Request: " + saved.getSubject());
        task.setDescription(saved.getDescription());
        task.setStatus("PENDING");
        task.setPriority("MEDIUM");
        task.setSource("SERVICE_REQUEST");
        task.setProject(p);
        Task savedTask = taskRepository.save(task);
        saved.setTask(savedTask);
        serviceRequestRepository.save(saved);

        // Alert staff — the request otherwise only sits silently in the task queue.
        String who = (name != null && !name.isBlank()) ? name.trim()
                : (p.getCustomer() != null ? p.getCustomer().getName() : "A customer");
        notifyStaff(p, "New request from tracking page",
                who + " · " + p.getProjectName() + " · " + saved.getSubject(),
                "SERVICE_REQUEST", "/website/service-requests");

        return map("id", saved.getId(), "status", saved.getStatus());
    }

    // ---- Write: a review from the public page ----
    @Transactional
    public Map<String, Object> submitReview(String token, Map<String, Object> body) {
        Project p = resolve(token);
        Integer rating = body.get("rating") == null ? null : Integer.valueOf(body.get("rating").toString());
        if (rating == null || rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please give a rating between 1 and 5 stars.");
        }
        ProjectReview r = new ProjectReview();
        r.setProject(p);
        r.setRating(rating);
        r.setReviewerName(str(body.get("name")));
        r.setComment(str(body.get("comment")));
        r.setStatus("APPROVED");
        ProjectReview saved = reviewRepository.save(r);

        // Let staff know feedback arrived (a low rating is worth seeing promptly).
        String who = (r.getReviewerName() != null && !r.getReviewerName().isBlank()) ? r.getReviewerName().trim()
                : (p.getCustomer() != null ? p.getCustomer().getName() : "A customer");
        notifyStaff(p, rating + "★ review on " + p.getProjectName(),
                who + (saved.getComment() != null && !saved.getComment().isBlank() ? " · " + saved.getComment() : ""),
                "REVIEW", "/projects/" + p.getId());

        return map("id", saved.getId(), "rating", saved.getRating());
    }

    /**
     * Alert staff about a tracking-page event: the project's assigned manager directly, plus all
     * admins. The manager is excluded from the admin fan-out so a manager who is also an admin gets
     * exactly one notification, not two.
     */
    private void notifyStaff(Project p, String title, String message, String type, String url) {
        Long pmId = p.getProjectManager() != null ? p.getProjectManager().getId() : null;
        notificationService.dispatchToAdmins(title, message, type, url, pmId);
        if (pmId != null) {
            notificationService.dispatch(title, message, type, pmId, url);
        }
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}

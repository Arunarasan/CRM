package com.arudra.crm.service;

import com.arudra.crm.dto.website.ServiceRequestAdminDto.*;
import com.arudra.crm.entity.ServiceRequest;
import com.arudra.crm.entity.ServiceRequestMedia;
import com.arudra.crm.entity.Task;
import com.arudra.crm.repository.ServiceRequestRepository;
import com.arudra.crm.repository.TaskRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * CRM-side management of customer service requests ({@code /api/website/service-requests}). The
 * customer raises these from the portal ({@link CustomerPortalService#createServiceRequest}); this is
 * where staff read them, drive the status, and reply. Status changes flow back to the customer as a
 * portal notification and, where a linked {@link Task} exists, keep the internal task in step.
 */
@Service
public class ServiceRequestAdminService {

    private static final Set<String> STATUSES = Set.of("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED");

    private final ServiceRequestRepository requestRepository;
    private final TaskRepository taskRepository;
    private final CustomerNotificationService customerNotificationService;

    public ServiceRequestAdminService(ServiceRequestRepository requestRepository, TaskRepository taskRepository,
                                      CustomerNotificationService customerNotificationService) {
        this.requestRepository = requestRepository;
        this.taskRepository = taskRepository;
        this.customerNotificationService = customerNotificationService;
    }

    @Transactional(readOnly = true)
    public List<Summary> list(String status) {
        List<ServiceRequest> requests = isBlank(status)
                ? requestRepository.findByIsDeletedFalseOrderByCreatedAtDesc()
                : requestRepository.findByStatusAndIsDeletedFalseOrderByCreatedAtDesc(status.trim().toUpperCase());
        List<Summary> out = new ArrayList<>();
        for (ServiceRequest r : requests) out.add(toSummary(r));
        return out;
    }

    @Transactional(readOnly = true)
    public Detail get(Long id) {
        return toDetail(load(id));
    }

    @Transactional
    public Detail updateStatus(Long id, String status) {
        if (isBlank(status) || !STATUSES.contains(status.trim().toUpperCase())) {
            throw new IllegalArgumentException("Unknown status: " + status);
        }
        ServiceRequest r = load(id);
        String next = status.trim().toUpperCase();
        r.setStatus(next);

        // Keep the linked internal task in step with the request's lifecycle.
        if (r.getTask() != null) {
            Task task = r.getTask();
            if (next.equals("RESOLVED") || next.equals("CLOSED")) task.setStatus("COMPLETED");
            else if (next.equals("IN_PROGRESS")) task.setStatus("IN_PROGRESS");
            taskRepository.save(task);
        }

        ServiceRequest saved = requestRepository.save(r);
        customerNotificationService.notify(saved.getCustomer(), "SERVICE_REQUEST",
                "Update on \"" + saved.getSubject() + "\"",
                "Your request is now " + humanize(next) + ".",
                "/portal/service-requests");
        return toDetail(saved);
    }

    @Transactional
    public Detail reply(Long id, String message) {
        if (isBlank(message)) throw new IllegalArgumentException("A reply message is required.");
        ServiceRequest r = load(id);
        customerNotificationService.notify(r.getCustomer(), "SERVICE_REQUEST",
                "Reply to \"" + r.getSubject() + "\"",
                message.trim(),
                "/portal/service-requests");
        return toDetail(r);
    }

    private ServiceRequest load(Long id) {
        return requestRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Service request not found: " + id));
    }

    private Summary toSummary(ServiceRequest r) {
        return new Summary(
                r.getId(), r.getSubject(),
                r.getCustomer() != null ? r.getCustomer().getName() : null,
                r.getIssueType(), r.getPriority(), r.getStatus(),
                r.getMedia() != null && !r.getMedia().isEmpty(), r.getCreatedAt());
    }

    private Detail toDetail(ServiceRequest r) {
        List<MediaView> media = new ArrayList<>();
        if (r.getMedia() != null) {
            for (ServiceRequestMedia m : r.getMedia()) {
                media.add(new MediaView(m.getId(), m.getUrl(), m.getMediaType()));
            }
        }
        return new Detail(
                r.getId(), r.getSubject(), r.getDescription(),
                r.getCustomer() != null ? r.getCustomer().getId() : null,
                r.getCustomer() != null ? r.getCustomer().getName() : null,
                r.getCustomer() != null ? r.getCustomer().getPhone() : null,
                r.getCustomer() != null ? r.getCustomer().getEmail() : null,
                r.getIssueType(), r.getPriority(), r.getStatus(), r.getPreferredDate(),
                r.getProject() != null ? r.getProject().getId() : null,
                r.getProject() != null ? r.getProject().getProjectName() : null,
                r.getTask() != null ? r.getTask().getId() : null,
                r.getCreatedAt(), media);
    }

    private static String humanize(String status) {
        String s = status.toLowerCase().replace('_', ' ');
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}

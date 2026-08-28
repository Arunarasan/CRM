package com.arudra.crm.dto.website;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * CRM-side views of customer service requests ({@code /api/website/service-requests}). The inbox
 * where enquiries raised from the customer portal are read, answered, and worked. A reply reaches the
 * customer as a portal notification; the linked {@link com.arudra.crm.entity.Task} carries the work
 * into the internal queue.
 */
public class ServiceRequestAdminDto {

    public record Summary(
            Long id,
            String subject,
            String customerName,
            String issueType,
            String priority,
            String status,
            boolean hasMedia,
            LocalDateTime createdAt) {}

    public record MediaView(Long id, String url, String mediaType) {}

    public record Detail(
            Long id,
            String subject,
            String description,
            Long customerId,
            String customerName,
            String customerPhone,
            String customerEmail,
            String issueType,
            String priority,
            String status,
            LocalDate preferredDate,
            Long projectId,
            String projectName,
            Long taskId,
            LocalDateTime createdAt,
            List<MediaView> media) {}

    public record StatusUpdate(String status) {}

    public record Reply(String message) {}
}

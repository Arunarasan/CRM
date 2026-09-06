package com.arudra.crm.dto.website;

import com.arudra.crm.entity.WebsiteEnquiry;

/**
 * Admin-side views of a {@link WebsiteEnquiry} for the Website → Enquiries inbox.
 */
public class WebsiteEnquiryDto {

    /** Compact row for the list. */
    public record Summary(
            Long id,
            String name,
            String channel,
            String interest,
            String status,
            boolean converted,
            String createdAt
    ) {
        public static Summary of(WebsiteEnquiry e) {
            return new Summary(
                    e.getId(), e.getName(), e.getChannel(), e.getInterest(),
                    e.getStatus(), e.getLeadId() != null,
                    e.getCreatedAt() == null ? null : e.getCreatedAt().toString());
        }
    }

    /** Full record for the detail panel. */
    public record Detail(
            Long id,
            String channel,
            String sourceLabel,
            String name,
            String phone,
            String email,
            String city,
            String interest,
            String productSlug,
            String propertyType,
            String area,
            String budget,
            String preferredDate,
            String message,
            String status,
            Long leadId,
            Long taskId,
            String createdAt
    ) {
        public static Detail of(WebsiteEnquiry e) {
            return new Detail(
                    e.getId(), e.getChannel(), e.getSourceLabel(), e.getName(), e.getPhone(),
                    e.getEmail(), e.getCity(), e.getInterest(), e.getProductSlug(),
                    e.getPropertyType(), e.getArea(), e.getBudget(), e.getPreferredDate(),
                    e.getMessage(), e.getStatus(), e.getLeadId(), e.getTaskId(),
                    e.getCreatedAt() == null ? null : e.getCreatedAt().toString());
        }
    }

    /** Request body for public product-quote enquiries (adds product context to the loose form). */
    public record ProductQuoteRequest(
            String name, String phone, String email, String message,
            String productSlug, String productName
    ) {}
}

package com.arudra.crm.dto.website;

/**
 * Payload for a website contact or consultation submission. Deliberately loose (all strings) so the
 * public form can post freely; the service maps it onto a CRM {@link com.arudra.crm.entity.Lead}.
 */
public record WebsiteLeadRequest(
        String name,
        String phone,
        String email,
        String location,
        String projectType,
        String propertyType,
        String area,
        String budget,
        String preferredDate,
        String message,
        String concept
) {}

package com.arudra.crm.dto.website;

import java.util.List;

/**
 * DTOs for CMS-managed site settings + page content ({@code /api/website/settings},
 * {@code /api/website/content}) and their public read counterparts.
 */
public class SiteContentDto {

    // ---- Settings ----
    public record SettingDto(
            Long id,
            String key,
            String value,
            String group,
            String label,
            String inputType,
            Integer displayOrder) {}

    /** Bulk save payload: a list of key/value pairs the CRM settings form submits. */
    public record SettingSave(String key, String value) {}
    public record SettingsSaveRequest(List<SettingSave> settings) {}

    // ---- Content blocks ----
    public record ContentBlockDto(
            Long id,
            String page,
            String sectionKey,
            String title,
            String subtitle,
            String body,
            Integer displayOrder,
            Boolean active) {}
}

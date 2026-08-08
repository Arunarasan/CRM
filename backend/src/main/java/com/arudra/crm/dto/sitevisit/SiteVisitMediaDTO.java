package com.arudra.crm.dto.sitevisit;

import com.arudra.crm.entity.SiteVisitMedia;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SiteVisitMediaDTO {
    private Long id;
    private Long siteVisitId;
    private String mediaType;
    private String category;
    private String fileUrl;
    private String description;
    private LocalDateTime uploadTime;
    private Long uploadedById;
    private String uploadedByName;
    private String fileVersion;

    public static SiteVisitMediaDTO from(SiteVisitMedia m) {
        SiteVisitMediaDTO dto = new SiteVisitMediaDTO();
        dto.setId(m.getId());
        if (m.getSiteVisit() != null) dto.setSiteVisitId(m.getSiteVisit().getId());
        dto.setMediaType(m.getMediaType());
        dto.setCategory(m.getCategory());
        dto.setFileUrl(m.getFileUrl());
        dto.setDescription(m.getDescription());
        dto.setUploadTime(m.getUploadTime());
        if (m.getUploadedBy() != null) {
            dto.setUploadedById(m.getUploadedBy().getId());
            dto.setUploadedByName(m.getUploadedBy().getName());
        }
        dto.setFileVersion(m.getFileVersion());
        return dto;
    }
}

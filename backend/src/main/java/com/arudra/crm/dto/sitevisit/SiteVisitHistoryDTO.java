package com.arudra.crm.dto.sitevisit;

import com.arudra.crm.entity.SiteVisitHistory;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SiteVisitHistoryDTO {
    private Long id;
    private Long siteVisitId;
    private String action;
    private LocalDateTime actionTimestamp;
    private Long performedById;
    private String performedByName;
    private String remarks;

    public static SiteVisitHistoryDTO from(SiteVisitHistory h) {
        SiteVisitHistoryDTO dto = new SiteVisitHistoryDTO();
        dto.setId(h.getId());
        if (h.getSiteVisit() != null) dto.setSiteVisitId(h.getSiteVisit().getId());
        dto.setAction(h.getAction());
        dto.setActionTimestamp(h.getActionTimestamp());
        if (h.getPerformedBy() != null) {
            dto.setPerformedById(h.getPerformedBy().getId());
            dto.setPerformedByName(h.getPerformedBy().getName());
        }
        dto.setRemarks(h.getRemarks());
        return dto;
    }
}

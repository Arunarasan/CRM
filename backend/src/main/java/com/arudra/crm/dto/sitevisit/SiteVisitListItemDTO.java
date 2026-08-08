package com.arudra.crm.dto.sitevisit;

import com.arudra.crm.entity.SiteVisit;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Lightweight row shape for list/calendar/search views. */
@Data
public class SiteVisitListItemDTO {
    private Long id;
    private String visitNumber;
    private Long customerId;
    private String customerName;
    private Long projectId;
    private String projectName;
    private Long leadId;
    private String leadNumber;
    private String visitType;
    private String status;
    private String priority;
    private String outcome;
    private LocalDate scheduledDate;
    private LocalDateTime scheduledTime;
    private String locationAddress;
    private List<String> assignedEmployeeNames;

    public static SiteVisitListItemDTO from(SiteVisit v) {
        SiteVisitListItemDTO dto = new SiteVisitListItemDTO();
        dto.setId(v.getId());
        dto.setVisitNumber(v.getVisitNumber());
        if (v.getCustomer() != null) {
            dto.setCustomerId(v.getCustomer().getId());
            dto.setCustomerName(v.getCustomer().getName());
        }
        if (v.getProject() != null) {
            dto.setProjectId(v.getProject().getId());
            dto.setProjectName(v.getProject().getProjectName());
        }
        if (v.getLead() != null) {
            dto.setLeadId(v.getLead().getId());
            dto.setLeadNumber(v.getLead().getLeadNumber());
        }
        dto.setVisitType(v.getVisitType());
        dto.setStatus(v.getStatus());
        dto.setPriority(v.getPriority());
        dto.setOutcome(v.getOutcome());
        dto.setScheduledDate(v.getScheduledDate());
        dto.setScheduledTime(v.getScheduledTime());
        dto.setLocationAddress(v.getLocationAddress());
        return dto;
    }
}

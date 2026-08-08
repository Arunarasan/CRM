package com.arudra.crm.dto.sitevisit;

import com.arudra.crm.entity.SiteVisitAssignment;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SiteVisitAssignmentDTO {
    private Long id;
    private Long siteVisitId;
    private Long employeeId;
    private String employeeName;
    private Long assignedById;
    private String assignedByName;
    private String role;
    private String status;
    private LocalDateTime assignedDate;
    private LocalDateTime acceptedTime;
    private LocalDateTime arrivalTime;
    private LocalDateTime completedTime;
    private String remarks;

    public static SiteVisitAssignmentDTO from(SiteVisitAssignment a) {
        SiteVisitAssignmentDTO dto = new SiteVisitAssignmentDTO();
        dto.setId(a.getId());
        if (a.getSiteVisit() != null) dto.setSiteVisitId(a.getSiteVisit().getId());
        if (a.getAssignedUser() != null) {
            dto.setEmployeeId(a.getAssignedUser().getId());
            dto.setEmployeeName(a.getAssignedUser().getName());
        }
        if (a.getAssignedBy() != null) {
            dto.setAssignedById(a.getAssignedBy().getId());
            dto.setAssignedByName(a.getAssignedBy().getName());
        }
        dto.setRole(a.getRole());
        dto.setStatus(a.getStatus());
        dto.setAssignedDate(a.getAssignedDate());
        dto.setAcceptedTime(a.getAcceptedTime());
        dto.setArrivalTime(a.getArrivalTime());
        dto.setCompletedTime(a.getCompletedTime());
        dto.setRemarks(a.getRemarks());
        return dto;
    }
}

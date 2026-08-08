package com.arudra.crm.dto.lead;

import com.arudra.crm.entity.Lead;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Lightweight lead representation for the Kanban board and list widgets. */
@Data
public class LeadCardDTO {
    private Long id;
    private String leadNumber;
    private String name;
    private String companyName;
    private String mobileNumber;
    private String city;
    private String leadSource;
    private String leadType;
    private String status;
    private String stage;
    private String priority;
    private String leadTemperature;
    private BigDecimal estimatedBudget;
    private LocalDate nextFollowUpDate;
    private LocalDateTime lastContactAt;
    private LocalDateTime createdAt;
    private Long assignedToId;
    private String assignedToName;
    private Boolean isConverted;

    public static LeadCardDTO from(Lead lead) {
        LeadCardDTO dto = new LeadCardDTO();
        dto.setId(lead.getId());
        dto.setLeadNumber(lead.getLeadNumber());
        dto.setName(lead.getName());
        dto.setCompanyName(lead.getCompanyName());
        dto.setMobileNumber(lead.getMobileNumber());
        dto.setCity(lead.getCity());
        dto.setLeadSource(lead.getLeadSource());
        dto.setLeadType(lead.getLeadType());
        dto.setStatus(lead.getStatus());
        dto.setStage(lead.getStage());
        dto.setPriority(lead.getPriority());
        dto.setLeadTemperature(lead.getLeadTemperature());
        dto.setEstimatedBudget(lead.getEstimatedBudget());
        dto.setNextFollowUpDate(lead.getNextFollowUpDate());
        dto.setLastContactAt(lead.getLastContactAt());
        dto.setCreatedAt(lead.getCreatedAt());
        dto.setIsConverted(lead.getIsConverted());
        if (lead.getAssignedSalesExecutive() != null) {
            dto.setAssignedToId(lead.getAssignedSalesExecutive().getId());
            dto.setAssignedToName(lead.getAssignedSalesExecutive().getName());
        }
        return dto;
    }
}

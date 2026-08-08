package com.arudra.crm.dto.sitevisit;

import com.arudra.crm.entity.SiteVisit;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Full site visit detail, flattened to avoid Jackson lazy-load/cycle issues on nested entities. */
@Data
public class SiteVisitDTO {
    private Long id;
    private String visitNumber;

    private Long leadId;
    private String leadNumber;
    private Long customerId;
    private String customerName;
    private Long projectId;
    private String projectCode;
    private String projectName;

    private String visitType;
    private String status;
    private String priority;

    private LocalDate scheduledDate;
    private LocalDateTime scheduledTime;
    private String expectedDuration;
    private LocalDateTime actualStartTime;
    private LocalDateTime actualEndTime;

    private String locationAddress;
    private String mapLocation;
    private String googleMapsLink;
    private Double latitude;
    private Double longitude;

    private String customerContactPerson;
    private String customerMobile;

    private String visitNotes;
    private String internalNotes;
    private String customerNotes;

    private String propertyType;
    private Integer totalFloors;
    private Double areaSqft;
    private String constructionStage;
    private String siteCondition;
    private String accessibility;
    private Boolean parkingAvailability;
    private Boolean powerAvailability;
    private Boolean waterAvailability;

    private String preferredStyle;
    private Double budget;
    private String preferredMaterials;
    private String preferredColors;
    private String completionTimeline;
    private String specialInstructions;

    private String structuralIssues;
    private String electricalIssues;
    private String plumbingIssues;
    private String paintingCondition;
    private String floorCondition;
    private String furnitureCondition;
    private String safetyConcerns;
    private String recommendations;

    private String signedByCustomer;
    private LocalDateTime signatureDate;
    private String signatureBase64;
    private String signatureRemarks;

    private String outcome;
    private String nextActionNotes;
    private Boolean nextVisitRequired;
    private LocalDate nextVisitDate;
    private LocalDateTime nextVisitTime;
    private String nextVisitPurpose;
    private Long nextVisitAssignedToId;
    private String nextVisitAssignedToName;
    private Boolean reminderEnabled;

    private Long followUpFromId;
    private String followUpFromVisitNumber;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static SiteVisitDTO from(SiteVisit v) {
        SiteVisitDTO dto = new SiteVisitDTO();
        dto.setId(v.getId());
        dto.setVisitNumber(v.getVisitNumber());
        if (v.getLead() != null) {
            dto.setLeadId(v.getLead().getId());
            dto.setLeadNumber(v.getLead().getLeadNumber());
        }
        if (v.getCustomer() != null) {
            dto.setCustomerId(v.getCustomer().getId());
            dto.setCustomerName(v.getCustomer().getName());
        }
        if (v.getProject() != null) {
            dto.setProjectId(v.getProject().getId());
            dto.setProjectCode(v.getProject().getProjectCode());
            dto.setProjectName(v.getProject().getProjectName());
        }
        dto.setVisitType(v.getVisitType());
        dto.setStatus(v.getStatus());
        dto.setPriority(v.getPriority());
        dto.setScheduledDate(v.getScheduledDate());
        dto.setScheduledTime(v.getScheduledTime());
        dto.setExpectedDuration(v.getExpectedDuration());
        dto.setActualStartTime(v.getActualStartTime());
        dto.setActualEndTime(v.getActualEndTime());
        dto.setLocationAddress(v.getLocationAddress());
        dto.setMapLocation(v.getMapLocation());
        dto.setGoogleMapsLink(v.getGoogleMapsLink());
        dto.setLatitude(v.getLatitude());
        dto.setLongitude(v.getLongitude());
        dto.setCustomerContactPerson(v.getCustomerContactPerson());
        dto.setCustomerMobile(v.getCustomerMobile());
        dto.setVisitNotes(v.getVisitNotes());
        dto.setInternalNotes(v.getInternalNotes());
        dto.setCustomerNotes(v.getCustomerNotes());
        dto.setPropertyType(v.getPropertyType());
        dto.setTotalFloors(v.getTotalFloors());
        dto.setAreaSqft(v.getAreaSqft());
        dto.setConstructionStage(v.getConstructionStage());
        dto.setSiteCondition(v.getSiteCondition());
        dto.setAccessibility(v.getAccessibility());
        dto.setParkingAvailability(v.getParkingAvailability());
        dto.setPowerAvailability(v.getPowerAvailability());
        dto.setWaterAvailability(v.getWaterAvailability());
        dto.setPreferredStyle(v.getPreferredStyle());
        dto.setBudget(v.getBudget());
        dto.setPreferredMaterials(v.getPreferredMaterials());
        dto.setPreferredColors(v.getPreferredColors());
        dto.setCompletionTimeline(v.getCompletionTimeline());
        dto.setSpecialInstructions(v.getSpecialInstructions());
        dto.setStructuralIssues(v.getStructuralIssues());
        dto.setElectricalIssues(v.getElectricalIssues());
        dto.setPlumbingIssues(v.getPlumbingIssues());
        dto.setPaintingCondition(v.getPaintingCondition());
        dto.setFloorCondition(v.getFloorCondition());
        dto.setFurnitureCondition(v.getFurnitureCondition());
        dto.setSafetyConcerns(v.getSafetyConcerns());
        dto.setRecommendations(v.getRecommendations());
        dto.setSignedByCustomer(v.getSignedByCustomer());
        dto.setSignatureDate(v.getSignatureDate());
        dto.setSignatureBase64(v.getSignatureBase64());
        dto.setSignatureRemarks(v.getSignatureRemarks());
        dto.setOutcome(v.getOutcome());
        dto.setNextActionNotes(v.getNextActionNotes());
        dto.setNextVisitRequired(v.getNextVisitRequired());
        dto.setNextVisitDate(v.getNextVisitDate());
        dto.setNextVisitTime(v.getNextVisitTime());
        dto.setNextVisitPurpose(v.getNextVisitPurpose());
        if (v.getNextVisitAssignedTo() != null) {
            dto.setNextVisitAssignedToId(v.getNextVisitAssignedTo().getId());
            dto.setNextVisitAssignedToName(v.getNextVisitAssignedTo().getName());
        }
        dto.setReminderEnabled(v.getReminderEnabled());
        if (v.getFollowUpFrom() != null) {
            dto.setFollowUpFromId(v.getFollowUpFrom().getId());
            dto.setFollowUpFromVisitNumber(v.getFollowUpFrom().getVisitNumber());
        }
        dto.setCreatedAt(v.getCreatedAt());
        dto.setUpdatedAt(v.getUpdatedAt());
        return dto;
    }
}

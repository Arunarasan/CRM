package com.arudra.crm.dto.customer360;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class CustomerFollowUpDTO {
    private Long id;
    private Long assignedEmployeeId;
    private String assignedEmployeeName;
    private String purpose;
    private String priority;
    private LocalDate followupDate;
    private LocalTime followupTime;
    private String method;
    private String status;
    private String notes;
    private String completionNotes;
    private LocalDate nextFollowupDate;
    /** Convenience bucket for the frontend: TODAY, UPCOMING, OVERDUE, COMPLETED, CANCELLED. */
    private String bucket;
}

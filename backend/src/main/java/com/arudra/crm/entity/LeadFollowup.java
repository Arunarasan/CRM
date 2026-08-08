package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "lead_followups")
public class LeadFollowup extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id", nullable = false)
    private Lead lead;

    @Column(name = "followup_date", nullable = false)
    private LocalDate followupDate;

    @Column(name = "followup_time")
    private LocalTime followupTime;

    @Column(length = 50)
    private String method; // Call, Email, WhatsApp, Meeting

    @Column(columnDefinition = "TEXT")
    private String notes; // discussion summary

    @Column(name = "customer_response", columnDefinition = "TEXT")
    private String customerResponse;

    @Column(length = 20)
    private String priority; // Low, Medium, High, Urgent

    @Column(length = 50)
    private String status; // Planned, Completed, Missed, Cancelled

    @Column(name = "reminder_enabled")
    private Boolean reminderEnabled = false;

    @Column(length = 100)
    private String outcome;

    @Column(name = "next_followup_date")
    private LocalDate nextFollowupDate;

    @Column(name = "next_followup_time")
    private LocalTime nextFollowupTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by_id")
    private User performedBy;
}

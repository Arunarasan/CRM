package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "customer_followups", indexes = {
        @Index(name = "idx_cfu_customer", columnList = "customer_id"),
        @Index(name = "idx_cfu_status", columnList = "status"),
        @Index(name = "idx_cfu_followup_date", columnList = "followup_date")
})
public class CustomerFollowUp extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_employee_id")
    private User assignedEmployee;

    @Column(length = 255)
    private String purpose;

    @Column(length = 20)
    private String priority = "MEDIUM"; // LOW, MEDIUM, HIGH

    @Column(name = "followup_date", nullable = false)
    private LocalDate followupDate;

    @Column(name = "followup_time")
    private LocalTime followupTime;

    @Column(length = 50)
    private String method; // Call, Email, WhatsApp, Meeting, Site Visit

    @Column(length = 20, nullable = false)
    private String status = "PENDING"; // PENDING, COMPLETED, CANCELLED

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "completion_notes", columnDefinition = "TEXT")
    private String completionNotes;

    @Column(name = "next_followup_date")
    private LocalDate nextFollowupDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdByUser;
}

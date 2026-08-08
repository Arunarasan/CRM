package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "lead_reminders")
public class LeadReminder extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id", nullable = false)
    private Lead lead;

    @Column(nullable = false)
    private LocalDateTime reminderTime;

    @Column(length = 200)
    private String title;

    @Column(name = "task_type", length = 50)
    private String taskType; // Call Customer, Site Visit, Measurement, Design, Quotation, Reminder, Meeting

    @Column(length = 20)
    private String priority; // Low, Medium, High, Urgent

    @Column(length = 50)
    private String status = "Pending"; // Pending, In Progress, Completed, Cancelled

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(length = 200)
    private String description;

    @Column(nullable = false)
    private Boolean isCompleted = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private User assignedTo;
}

package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A private work reminder an employee creates for themselves ("Task Management"). NOT a company
 * task — it is never assigned, scheduled or seen by anyone else. Keyed by the owning user.
 */
@Getter
@Setter
@Entity
@Table(name = "personal_reminders", indexes = {
    @Index(name = "idx_pr_owner", columnList = "owner_id"),
    @Index(name = "idx_pr_status", columnList = "status")
})
public class PersonalReminder extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User owner;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(length = 20)
    private String priority; // LOW, MEDIUM, HIGH

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, DONE

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}

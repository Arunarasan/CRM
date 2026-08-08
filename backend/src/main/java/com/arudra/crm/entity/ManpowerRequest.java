package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Field request for additional workers: PENDING -> APPROVED/REJECTED -> ASSIGNED. */
@Getter
@Setter
@Entity
@Table(name = "manpower_requests", indexes = {
    @Index(name = "idx_mpr_status", columnList = "status"),
    @Index(name = "idx_mpr_requested_by", columnList = "requested_by_id")
})
public class ManpowerRequest extends BaseEntity {

    @Column(name = "request_number", nullable = false, unique = true, length = 30)
    private String requestNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "assignedEmployee", "contractor", "phase", "room", "parentTask", "dependencies"})
    private Task task;

    @Column(name = "current_workers")
    private Integer currentWorkers;

    @Column(name = "required_workers", nullable = false)
    private Integer requiredWorkers;

    @Column(name = "skill_required", length = 150)
    private String skillRequired;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(length = 20)
    private String priority; // LOW, MEDIUM, HIGH, URGENT

    @Column(name = "required_date")
    private LocalDate requiredDate;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED, ASSIGNED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User approvedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "site_visit_assignments")
public class SiteVisitAssignment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id", nullable = false)
    private SiteVisit siteVisit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_user_id", nullable = false)
    private User assignedUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_user_id")
    private User assignedBy;

    @Column(name = "assigned_date", nullable = false)
    private LocalDateTime assignedDate;

    @Column(length = 100)
    private String role; // Sales Executive, Interior Designer, Site Engineer, Measurement Engineer, Project Manager, Supervisor, Technician, Contractor

    @Column(length = 50)
    private String status = "Assigned"; // Assigned, Accepted, Declined

    @Column(name = "accepted_time")
    private LocalDateTime acceptedTime;

    @Column(name = "arrival_time")
    private LocalDateTime arrivalTime;

    @Column(name = "completed_time")
    private LocalDateTime completedTime;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

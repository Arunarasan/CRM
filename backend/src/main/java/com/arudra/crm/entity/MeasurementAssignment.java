package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** A team member working on a measurement, with an assignment lifecycle of their own. */
@Getter
@Setter
@Entity
@Table(name = "measurement_assignments")
public class MeasurementAssignment extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id", nullable = false)
    private Measurement measurement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User employee;

    @Column(length = 50)
    private String role; // Measurement Engineer, Interior Designer, Project Manager, Supervisor

    @Column(length = 50)
    private String status; // Assigned, Accepted, Declined, Completed

    @Column(name = "assigned_date")
    private LocalDateTime assignedDate;

    @Column(name = "accepted_time")
    private LocalDateTime acceptedTime;

    @Column(name = "completed_time")
    private LocalDateTime completedTime;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User assignedBy;
}

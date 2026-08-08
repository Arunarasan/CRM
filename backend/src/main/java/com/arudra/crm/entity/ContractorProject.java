package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "contractor_projects")
public class ContractorProject extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "assigned_date")
    private LocalDate assignedDate;

    @Column(length = 50)
    private String status = "ACTIVE"; // ACTIVE, COMPLETED

    /** Primary trade this contractor covers on the project; work itself hangs off work packages. */
    @Column(length = 50)
    private String trade;
}

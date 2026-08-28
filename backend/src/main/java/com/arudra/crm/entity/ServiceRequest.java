package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A service/support request raised by a customer from the portal. Phase 7 turns this into a CRM
 * {@link Task}; {@code task} links back once created so status flows to the customer.
 */
@Entity
@Table(name = "service_requests")
@Getter
@Setter
public class ServiceRequest extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private Task task;

    @Column(name = "issue_type", length = 80)
    private String issueType;

    /** LOW | MEDIUM | HIGH | URGENT */
    @Column(nullable = false, length = 20)
    private String priority = "MEDIUM";

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** OPEN | IN_PROGRESS | RESOLVED | CLOSED */
    @Column(nullable = false, length = 30)
    private String status = "OPEN";

    @Column(name = "preferred_date")
    private LocalDate preferredDate;

    @OneToMany(mappedBy = "serviceRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ServiceRequestMedia> media = new ArrayList<>();
}

package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * A customer's review of a service (the service catalog — {@link Service}), submitted from the
 * portal. One review per customer per service; admins moderate via {@link #status}.
 */
@Entity
@Table(name = "service_reviews")
@Getter
@Setter
public class ServiceReview extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id")
    private Service service;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(nullable = false)
    private Integer rating = 5;

    @Column(columnDefinition = "TEXT")
    private String comment;

    /** APPROVED (visible) | HIDDEN (moderated out). */
    @Column(nullable = false, length = 20)
    private String status = "APPROVED";
}

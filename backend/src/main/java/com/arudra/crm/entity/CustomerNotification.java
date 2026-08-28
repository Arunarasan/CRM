package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** A customer-facing notification (quotation ready, payment received, request update…). */
@Entity
@Table(name = "customer_notifications")
@Getter
@Setter
public class CustomerNotification extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(length = 50)
    private String type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    @Column(length = 300)
    private String link;

    @Column(name = "read_at")
    private LocalDateTime readAt;
}

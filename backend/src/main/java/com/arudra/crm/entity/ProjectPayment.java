package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "project_payments", indexes = {
    @Index(name = "idx_pp_project", columnList = "project_id")
})
public class ProjectPayment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod; // Cash, Bank Transfer, Cheque, Credit Card

    @Column(nullable = false, length = 50)
    private String status = "COMPLETED"; // PENDING, COMPLETED, FAILED, REFUNDED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "received_by_id")
    private User receivedBy;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

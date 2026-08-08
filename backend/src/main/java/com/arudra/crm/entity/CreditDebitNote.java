package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "credit_debit_notes")
public class CreditDebitNote extends BaseEntity {

    @Column(name = "note_number", nullable = false, unique = true, length = 50)
    private String noteNumber;

    @Column(nullable = false, length = 20)
    private String type; // CREDIT, DEBIT

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id")
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private LocalDate date = LocalDate.now();

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE, CANCELLED

    @Column(columnDefinition = "TEXT")
    private String reason;
}

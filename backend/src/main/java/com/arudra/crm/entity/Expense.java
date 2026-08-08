package com.arudra.crm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "expenses")
public class Expense extends BaseEntity {

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 100)
    private String category; // e.g., Office Supplies, Rent, Marketing, Utilities

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod; // Cash, Bank, UPI

    @Column(name = "reference_number", length = 100)
    private String referenceNumber; // Transaction ID or Receipt No

    @Column(columnDefinition = "TEXT")
    private String description;
}

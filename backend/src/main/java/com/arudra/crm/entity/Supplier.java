package com.arudra.crm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "suppliers")
public class Supplier extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "contact_person", length = 100)
    private String contactPerson;

    @Column(length = 100)
    private String email;

    @Column(length = 50)
    private String phone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String state;

    @Column(length = 10)
    private String pincode;

    @Column(name = "tax_id", length = 100)
    private String taxId;

    @Column(length = 20)
    private String gstin;

    @Column(length = 20)
    private String pan;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;

    @Column(name = "bank_ifsc", length = 20)
    private String bankIfsc;

    @Column(name = "credit_limit", precision = 15, scale = 2)
    private BigDecimal creditLimit;

    @Column(name = "payment_terms", length = 100)
    private String paymentTerms;

    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @Column(name = "performance_rating")
    private Integer performanceRating = 3;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE, INACTIVE
}

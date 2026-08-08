package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "quotation_additional_charges")
public class QuotationAdditionalCharge extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    private Quotation quotation;

    @Column(name = "charge_type", nullable = false, length = 100)
    private String chargeType; // Transportation, Installation, Delivery, etc.

    @Column(name = "amount", precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(columnDefinition = "TEXT")
    private String description;
}

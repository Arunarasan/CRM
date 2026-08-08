package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "quotation_taxes")
public class QuotationTax extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    private Quotation quotation;

    @Column(name = "tax_type", nullable = false, length = 50)
    private String taxType; // GST, CGST, SGST, IGST

    @Column(name = "percentage", precision = 5, scale = 2)
    private BigDecimal percentage;

    @Column(name = "amount", precision = 15, scale = 2)
    private BigDecimal amount;
    
    @Column(name = "is_inclusive")
    private Boolean isInclusive = false;
}

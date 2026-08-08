package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "quotation_labour")
public class QuotationLabour extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    private Quotation quotation;

    @Column(name = "work_type", nullable = false, length = 100)
    private String workType; 

    @Column(name = "labour_category", length = 100)
    private String labourCategory; 

    @Column(name = "hours", precision = 10, scale = 2)
    private BigDecimal hours;

    @Column(name = "rate", precision = 15, scale = 2)
    private BigDecimal rate;

    @Column(name = "amount", precision = 15, scale = 2)
    private BigDecimal amount;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_contractor_id")
    private Contractor assignedContractor;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

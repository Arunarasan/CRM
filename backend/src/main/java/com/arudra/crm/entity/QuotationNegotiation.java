package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "quotation_negotiations")
public class QuotationNegotiation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    private Quotation quotation;

    @Column(name = "revision_number", nullable = false)
    private Integer revisionNumber;

    @Column(name = "old_price", precision = 15, scale = 2)
    private BigDecimal oldPrice;

    @Column(name = "new_price", precision = 15, scale = 2)
    private BigDecimal newPrice;
    
    @Column(name = "changed_items", columnDefinition = "TEXT")
    private String changedItems; // JSON or text summary of changed items

    @Column(name = "customer_remarks", columnDefinition = "TEXT")
    private String customerRemarks;
    
    @Column(name = "sales_remarks", columnDefinition = "TEXT")
    private String salesRemarks;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_approval_id")
    private User managerApproval;
}

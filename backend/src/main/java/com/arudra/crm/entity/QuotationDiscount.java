package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "quotation_discounts")
public class QuotationDiscount extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    private Quotation quotation;

    @Column(name = "discount_type", nullable = false, length = 50)
    private String discountType; // OVERALL, ITEM_LEVEL, COUPON, MANUAL

    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "percentage", precision = 5, scale = 2)
    private BigDecimal percentage;

    @Column(name = "amount", precision = 15, scale = 2)
    private BigDecimal amount;
    
    @Column(name = "coupon_code", length = 50)
    private String couponCode;

    @Column(name = "approved_by")
    private String approvedBy; // Name or ID of approver if high discount
}

package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "purchase_request_items")
public class PurchaseRequestItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_request_id", nullable = false)
    private PurchaseRequest purchaseRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "category", "subCategory", "supplier", "defaultWarehouse"})
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "estimated_unit_price", precision = 15, scale = 2)
    private BigDecimal estimatedUnitPrice;

    @Column(length = 255)
    private String notes;
}

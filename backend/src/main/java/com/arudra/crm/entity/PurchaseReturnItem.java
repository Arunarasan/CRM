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
@Table(name = "purchase_return_items")
public class PurchaseReturnItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_return_id", nullable = false)
    private PurchaseReturn purchaseReturn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "category", "subCategory", "supplier", "defaultWarehouse"})
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 15, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_price", precision = 15, scale = 2)
    private BigDecimal totalPrice;
}

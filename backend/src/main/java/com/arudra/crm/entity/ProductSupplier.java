package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One supplier option for a material — a product can have many, one marked preferred. */
@Getter
@Setter
@Entity
@Table(name = "product_suppliers")
public class ProductSupplier extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Supplier supplier;

    @Column(name = "purchase_price", precision = 15, scale = 2)
    private BigDecimal purchasePrice;

    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @Column(name = "is_preferred", nullable = false)
    private Boolean isPreferred = false;

    @Column(name = "last_purchase_date")
    private LocalDate lastPurchaseDate;
}

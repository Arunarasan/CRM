package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * A single material line within a BoqItem, sourced from the Inventory {@link Product}
 * catalog (or a free-text custom material when {@link #product} is null).
 */
@Getter
@Setter
@Entity
@Table(name = "boq_item_materials")
public class BoqItemMaterial extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private BoqItem item;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Product product;

    @Column(name = "material_name", nullable = false, length = 255)
    private String materialName;

    @Column(precision = 15, scale = 2)
    private BigDecimal quantity;

    @Column(length = 20)
    private String unit;

    @Column(name = "waste_percent", precision = 5, scale = 2)
    private BigDecimal wastePercent = BigDecimal.ZERO;

    @Column(name = "final_quantity", precision = 15, scale = 2)
    private BigDecimal finalQuantity; // computed = quantity * (1 + wastePercent/100)

    @Column(name = "cost_price", precision = 15, scale = 2)
    private BigDecimal costPrice;

    @Column(name = "selling_rate", precision = 15, scale = 2)
    private BigDecimal sellingRate;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO; // computed = finalQuantity * sellingRate

    @Column(length = 255)
    private String vendor;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    /** Computed at read/write time from current Inventory stock; not persisted. */
    @Transient
    private String stockWarning;

    @Transient
    private Integer availableStock;
}

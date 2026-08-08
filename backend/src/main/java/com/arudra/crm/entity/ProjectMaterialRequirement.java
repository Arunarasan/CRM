package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Tracks a required material for a Project (optionally scoped to a Phase), from planning through Inventory/Purchase consumption. */
@Getter
@Setter
@Entity
@Table(name = "project_material_requirements", indexes = {
    @Index(name = "idx_pmr_project", columnList = "project_id")
})
public class ProjectMaterialRequirement extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project"})
    private ProjectPhase phase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Product product;

    @Column(name = "required_qty", precision = 15, scale = 2, nullable = false)
    private BigDecimal requiredQty = BigDecimal.ZERO;

    @Column(name = "reserved_qty", precision = 15, scale = 2)
    private BigDecimal reservedQty = BigDecimal.ZERO;

    @Column(name = "issued_qty", precision = 15, scale = 2)
    private BigDecimal issuedQty = BigDecimal.ZERO;

    @Column(name = "returned_qty", precision = 15, scale = 2)
    private BigDecimal returnedQty = BigDecimal.ZERO;

    @Column(name = "consumed_qty", precision = 15, scale = 2)
    private BigDecimal consumedQty = BigDecimal.ZERO;

    @Column(length = 20)
    private String unit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private PurchaseOrder purchaseOrder;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    /** Computed, not persisted: required - issued + returned. */
    @Transient
    public BigDecimal getRemainingQty() {
        BigDecimal req = requiredQty == null ? BigDecimal.ZERO : requiredQty;
        BigDecimal iss = issuedQty == null ? BigDecimal.ZERO : issuedQty;
        BigDecimal ret = returnedQty == null ? BigDecimal.ZERO : returnedQty;
        return req.subtract(iss).add(ret);
    }
}

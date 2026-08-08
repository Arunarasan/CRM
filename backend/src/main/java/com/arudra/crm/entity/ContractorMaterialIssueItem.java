package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** One material line on a {@link ContractorMaterialIssue}: issued / returned / consumed / waste / damaged. */
@Getter
@Setter
@Entity
@Table(name = "contractor_material_issue_items", indexes = {
    @Index(name = "idx_cmii_issue", columnList = "issue_id"),
    @Index(name = "idx_cmii_product", columnList = "product_id")
})
public class ContractorMaterialIssueItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issue_id", nullable = false)
    private ContractorMaterialIssue issue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "supplier", "defaultWarehouse"})
    private Product product;

    @Column(length = 20)
    private String unit;

    @Column(name = "issued_quantity", nullable = false, precision = 15, scale = 2)
    private BigDecimal issuedQuantity = BigDecimal.ZERO;

    @Column(name = "returned_quantity", nullable = false, precision = 15, scale = 2)
    private BigDecimal returnedQuantity = BigDecimal.ZERO;

    @Column(name = "consumed_quantity", nullable = false, precision = 15, scale = 2)
    private BigDecimal consumedQuantity = BigDecimal.ZERO;

    @Column(name = "waste_quantity", nullable = false, precision = 15, scale = 2)
    private BigDecimal wasteQuantity = BigDecimal.ZERO;

    @Column(name = "damaged_quantity", nullable = false, precision = 15, scale = 2)
    private BigDecimal damagedQuantity = BigDecimal.ZERO;

    @Column(name = "unit_rate", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitRate = BigDecimal.ZERO;

    @Column(name = "total_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalValue = BigDecimal.ZERO;

    /** (waste + damaged) x unitRate — recovered from the contractor. */
    @Column(name = "recoverable_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal recoverableValue = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    /** Computed, not persisted: issued - returned - consumed - waste - damaged. */
    @Transient
    public BigDecimal getUnreconciledQuantity() {
        return nz(issuedQuantity).subtract(nz(returnedQuantity)).subtract(nz(consumedQuantity))
                .subtract(nz(wasteQuantity)).subtract(nz(damagedQuantity));
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}

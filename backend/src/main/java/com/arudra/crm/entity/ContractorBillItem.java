package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** A measured line on a {@link ContractorBill}, normally tied back to a {@link WorkPackageItem}. */
@Getter
@Setter
@Entity
@Table(name = "contractor_bill_items", indexes = {
    @Index(name = "idx_cbi_bill", columnList = "bill_id")
})
public class ContractorBillItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id", nullable = false)
    private ContractorBill bill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_item_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "workPackage", "boqItem", "task"})
    private WorkPackageItem workPackageItem;

    @NotBlank
    @Column(nullable = false, length = 500)
    private String description;

    @Column(length = 20)
    private String unit;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal quantity = BigDecimal.ZERO;

    /** Quantity already billed on earlier running bills — this bill charges only the delta. */
    @Column(name = "previously_billed_quantity", nullable = false, precision = 15, scale = 2)
    private BigDecimal previouslyBilledQuantity = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal rate = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(name = "measurement_details", columnDefinition = "TEXT")
    private String measurementDetails;
}

package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** A single labour/workmanship line within a BoqItem. */
@Getter
@Setter
@Entity
@Table(name = "boq_item_labours")
public class BoqItemLabour extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private BoqItem item;

    @Column(name = "work_type", length = 100)
    private String workType;

    @Column(name = "labour_category", length = 100)
    private String labourCategory;

    @Column(precision = 15, scale = 2)
    private BigDecimal quantity;

    @Column(precision = 15, scale = 2)
    private BigDecimal rate;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO; // computed = quantity * rate

    @Column(name = "contractor_name", length = 255)
    private String contractorName;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

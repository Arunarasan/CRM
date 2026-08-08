package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * A BOQ line brought into a {@link ContractorWorkPackage}. This is the concrete link
 * BOQ → Work Package → Contractor, and carries the executed-quantity progress that
 * running bills are measured against.
 */
@Getter
@Setter
@Entity
@Table(name = "work_package_items", indexes = {
    @Index(name = "idx_wpi_package", columnList = "work_package_id"),
    @Index(name = "idx_wpi_boq_item", columnList = "boq_item_id")
})
public class WorkPackageItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id", nullable = false)
    private ContractorWorkPackage workPackage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_item_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "boq", "materials", "labours"})
    private BoqItem boqItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_room_item_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "room"})
    private ProjectRoomItem projectRoomItem;

    /** The execution task mirroring this line, so contractor work shows on the project board. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "dependencies", "parentTask"})
    private Task task;

    @NotBlank
    @Column(name = "item_name", nullable = false, length = 255)
    private String itemName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 20)
    private String unit;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(name = "completed_quantity", nullable = false, precision = 15, scale = 2)
    private BigDecimal completedQuantity = BigDecimal.ZERO;

    /** Contractor labour rate for this line (not the customer-facing BOQ rate). */
    @Column(precision = 15, scale = 2)
    private BigDecimal rate;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(nullable = false, length = 30)
    private String status = "PENDING"; // PENDING, IN_PROGRESS, COMPLETED

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

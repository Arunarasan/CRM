package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A physical bundle of a customer's material that needs work (stitching / making) after a sale.
 * A sticker carrying {@link #code} is stuck on the bundle; scanning or typing the code opens it.
 * Bundles of the same order share {@link #groupCode} (JB-0042 for JB-0042-1 / JB-0042-2).
 * Invoice / customer are plain ids (FKs in V104) so the entity serializes without lazy graphs.
 */
@Entity
@Table(name = "bundles", indexes = {
    @Index(name = "idx_bundle_group", columnList = "group_code"),
    @Index(name = "idx_bundle_invoice", columnList = "invoice_id"),
    @Index(name = "idx_bundle_status", columnList = "status"),
    @Index(name = "idx_bundle_due", columnList = "due_date")
})
@Getter
@Setter
public class Bundle extends BaseEntity {

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(name = "group_code", nullable = false, length = 40)
    private String groupCode;

    @Column(name = "invoice_id")
    private Long invoiceId;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "bundle_no", nullable = false)
    private Integer bundleNo = 1;

    @Column(name = "bundle_total", nullable = false)
    private Integer bundleTotal = 1;

    /** RECEIVED, CUTTING, STITCHING, QC_CHECK, PACKED, READY, DELIVERED, ON_HOLD, CANCELLED. */
    @Column(nullable = false, length = 20)
    private String status = "RECEIVED";

    @Column(name = "held_from_status", length = 20)
    private String heldFromStatus;

    @Column(name = "hold_reason", length = 500)
    private String holdReason;

    /** STITCHING / MAKING / FITTING / OTHER. */
    @Column(name = "work_type", nullable = false, length = 30)
    private String workType = "STITCHING";

    /** EMPLOYEE (users.id) | CONTRACTOR (contractors.id) — see WorkforceResourceService. */
    @Column(name = "resource_type", length = 20)
    private String resourceType;

    @Column(name = "resource_id")
    private Long resourceId;

    @Column(name = "task_id")
    private Long taskId;

    @Column(name = "due_date")
    private LocalDate dueDate;

    /** LOW / MEDIUM / HIGH / URGENT. */
    @Column(nullable = false, length = 10)
    private String priority = "MEDIUM";

    /** PICKUP / DELIVERY. */
    @Column(name = "handover_mode", nullable = false, length = 20)
    private String handoverMode = "PICKUP";

    @Column(name = "rack_location", length = 100)
    private String rackLocation;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "packed_at")
    private LocalDateTime packedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "delivered_to", length = 150)
    private String deliveredTo;
}

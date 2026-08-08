package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "quotation_items")
public class QuotationItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Quotation quotation;

    @Column(name = "item_code", length = 50)
    private String itemCode;

    /** Plain id, no FK constraint — traceability back to the source BoqItem. */
    @Column(name = "boq_item_id")
    private Long boqItemId;

    // PENDING, APPROVED, REJECTED — customer approval of this specific line item.
    @Column(length = 20)
    private String status = "PENDING";

    @Column(name = "cost_amount", precision = 15, scale = 2)
    private BigDecimal costAmount;

    @Column(length = 50)
    private String category; // Work Category — Windows, False Ceiling, Painting, Kitchen, etc.

    // --- Floor -> Room -> Category -> Item hierarchy, carried from the source BoqItem so the
    // quotation can render the same house structure. Floors/rooms are plain strings (no entity),
    // mirroring BoqItem; every item in a floor/room shares its floor_order/room_order, item_order
    // sequences items within a room. Null floor/room => rendered under "General / General Room".
    @Column(name = "floor_name", length = 100)
    private String floorName;

    @Column(name = "room_name", length = 100)
    private String roomName;

    @Column(name = "floor_order", nullable = false)
    private Integer floorOrder = 0;

    @Column(name = "room_order", nullable = false)
    private Integer roomOrder = 0;

    @Column(name = "item_order", nullable = false)
    private Integer itemOrder = 0;

    @Column(name = "item_name", nullable = false, length = 255)
    private String itemName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 20)
    private String unit;

    // --- Measurement (carried from the BoqItem, read-only in the quotation) ---
    @Column(precision = 15, scale = 2)
    private BigDecimal length;

    @Column(precision = 15, scale = 2)
    private BigDecimal width;

    @Column(precision = 15, scale = 2)
    private BigDecimal height;

    @Column(precision = 15, scale = 2)
    private BigDecimal area;

    // --- Material / labour split, carried from BoqItem.materialTotal/labourTotal; drives the
    // per-room, per-floor and grand Material/Labour roll-ups. ---
    @Column(name = "material_cost", precision = 15, scale = 2)
    private BigDecimal materialCost;

    @Column(name = "labour_cost", precision = 15, scale = 2)
    private BigDecimal labourCost;

    // --- Material-detail annotations (not modelled on the BOQ; free-text display/print only) ---
    @Column(length = 255)
    private String brand;

    @Column(columnDefinition = "TEXT")
    private String specification;

    @Column(length = 100)
    private String color;

    @Column(length = 50)
    private String thickness;

    @Column(length = 50)
    private String grade;

    // --- Execution annotations (assignment is finalised at project conversion) ---
    @Column(name = "estimated_days")
    private Integer estimatedDays;

    @Column(name = "assigned_contractor", length = 255)
    private String assignedContractor;

    // Per-item additional charge, folded into this item's total by recalculateTotals.
    @Column(name = "additional_charges", nullable = false, precision = 15, scale = 2)
    private BigDecimal additionalCharges = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal rate;

    @Column(name = "discount_percentage", precision = 5, scale = 2)
    private BigDecimal discountPercentage = BigDecimal.ZERO;

    @Column(name = "gst_percentage", precision = 5, scale = 2)
    private BigDecimal gstPercentage = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 15, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

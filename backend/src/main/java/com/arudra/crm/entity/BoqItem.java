package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * An executable item within a BOQ (e.g. "Window W1"), scoped to a floor/room and
 * optionally traced back to the MeasurementItem/MeasurementRoom it was generated from.
 * Cost is rolled up from its {@link #materials} and {@link #labours} child lines,
 * not carried directly on the item itself.
 */
@Getter
@Setter
@Entity
@Table(name = "boq_items")
public class BoqItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id", nullable = false)
    private Boq boq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "boq"})
    private BoqPhase phase;

    @Column(name = "item_code", length = 50)
    private String itemCode;

    @Column(length = 50)
    private String category; // Civil, Carpentry, Modular Kitchen, Wardrobe, False Ceiling, Painting,
                              // Electrical, Plumbing, Flooring, Glass, Hardware, Furniture, Others

    @Column(name = "item_name", nullable = false, length = 255)
    private String itemName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "floor_name", length = 100)
    private String floorName;

    @Column(name = "room_name", length = 100)
    private String roomName;

    // User-defined display order for drag-and-drop. Floors/rooms have no entity, so every item in a
    // floor/room shares its floor_order/room_order; item_order sequences items within a room.
    // Sort key across the tree is (floorOrder, roomOrder, itemOrder, id).
    @Column(name = "floor_order", nullable = false)
    private Integer floorOrder = 0;

    @Column(name = "room_order", nullable = false)
    private Integer roomOrder = 0;

    @Column(name = "item_order", nullable = false)
    private Integer itemOrder = 0;

    /** Plain id, no FK constraint — traceability back to the source MeasurementRoom, if generated from one. */
    @Column(name = "measurement_room_id")
    private Long measurementRoomId;

    /** Plain id, no FK constraint — traceability back to the source MeasurementItem, if generated from one. */
    @Column(name = "measurement_item_id")
    private Long measurementItemId;

    @Column(precision = 15, scale = 2)
    private BigDecimal length;

    @Column(precision = 15, scale = 2)
    private BigDecimal width;

    @Column(precision = 15, scale = 2)
    private BigDecimal height;

    @Column(precision = 15, scale = 2)
    private BigDecimal area;

    @Column(precision = 15, scale = 2)
    private BigDecimal perimeter;

    @Column(precision = 15, scale = 2)
    private BigDecimal quantity = BigDecimal.ONE;

    @Column(length = 20)
    private String unit;

    // PENDING (available for a future quotation), SELECTED (included in a generated quotation,
    // not yet customer-approved), APPROVED (customer approved via the quotation), EXECUTED
    // (converted to a project task), REJECTED.
    @Column(length = 20)
    private String status = "PENDING";

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @OneToMany(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("item")
    private List<BoqItemMaterial> materials = new ArrayList<>();

    @OneToMany(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("item")
    private List<BoqItemLabour> labours = new ArrayList<>();

    @Column(name = "material_total", precision = 15, scale = 2)
    private BigDecimal materialTotal = BigDecimal.ZERO;

    @Column(name = "labour_total", precision = 15, scale = 2)
    private BigDecimal labourTotal = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO; // computed = materialTotal + labourTotal

    /** Soft disable — excludes the item from active totals/tasks/inventory while preserving it and its history. */
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    /**
     * Self-referencing lineage id: the item's own id when first created, inherited unchanged through
     * every clone in {@code BoqService.cloneItems}. Lets the same logical item be matched across
     * revisions for diffing, since cloning always produces a brand-new row/id.
     */
    @Column(name = "origin_item_id")
    private Long originItemId;
}

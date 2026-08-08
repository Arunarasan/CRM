package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single work item within a Room — the smallest execution unit and the ONLY level a user
 * edits by hand. Its {@code progress}/{@code status} roll up automatically to Room -> Phase ->
 * Project (see ProjectService). Item types: window, door, wardrobe, kitchen, curtain, painting,
 * flooring, electrical, plumbing, false ceiling, furniture, custom.
 */
@Getter
@Setter
@Entity
@Table(name = "project_room_items", indexes = {
    @Index(name = "idx_pri_room", columnList = "room_id")
})
public class ProjectRoomItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "phase"})
    private ProjectRoom room;

    @NotBlank
    @Column(name = "item_type", nullable = false, length = 50)
    private String itemType; // WINDOW, DOOR, WARDROBE, KITCHEN, CURTAIN, PAINTING, FLOORING, ELECTRICAL, PLUMBING, FALSE_CEILING, FURNITURE, CUSTOM

    @NotBlank
    @Column(name = "item_name", nullable = false, length = 200)
    private String itemName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(precision = 15, scale = 2)
    private BigDecimal quantity = BigDecimal.ONE;

    @Column(length = 20)
    private String unit;

    /** Plain id, no FK constraint — traceability back to the source BoqItem, if generated from one. */
    @Column(name = "boq_item_id")
    private Long boqItemId;

    /** Full work-item lifecycle. Kept a plain String per codebase convention (no DB enums). */
    @Column(length = 50)
    private String status = "PENDING"; // PENDING, ASSIGNED, MATERIAL_READY, STARTED, IN_PROGRESS, INSPECTION, COMPLETED, ON_HOLD, REWORK, CANCELLED

    /** 0-100. The only progress value a user edits directly; everything above rolls up from it. */
    @Column(nullable = false)
    private Integer progress = 0;

    @Column(name = "planned_start_date")
    private LocalDate plannedStartDate;

    @Column(name = "planned_end_date")
    private LocalDate plannedEndDate;

    @Column(name = "actual_start_date")
    private LocalDate actualStartDate;

    @Column(name = "completed_date")
    private LocalDate completedDate;

    /**
     * Unified workforce assignment: {@link ResourceType} + master id (users.id for EMPLOYEE,
     * contractors.id for CONTRACTOR). Replaces the old assignedEmployee/assignedContractor FK pair
     * so employees and contractors share one assignment shape.
     */
    @Column(name = "resource_type", length = 30)
    private String resourceType;

    @Column(name = "resource_id")
    private Long resourceId;

    /** Resolved display view of the assigned resource, populated by the service layer on read. Not persisted. */
    @Transient
    private com.arudra.crm.dto.workforce.WorkforceResourceView assignedResource;

    /** JSON array of uploaded photo URLs. */
    @Column(columnDefinition = "TEXT")
    private String photos;

    /** True once the item is completed; only a Manager/Admin reopen clears it. */
    @Column(nullable = false)
    private Boolean locked = false;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    /** Derived on read: overdue and not finished. Never persisted — see V16 migration notes. */
    @Transient
    public boolean isDelayed() {
        return plannedEndDate != null
                && LocalDate.now().isAfter(plannedEndDate)
                && !"COMPLETED".equalsIgnoreCase(status)
                && !"CANCELLED".equalsIgnoreCase(status);
    }
}

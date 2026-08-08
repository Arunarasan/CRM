package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Per-field audit trail for BOQ edits — separate from the coarse {@link BoqActivityLog}.
 * One row per changed field, carrying previous/new value, reason, and who/when, so the
 * "Editable BOQ" history (Modified By/Date/Reason/Previous Value/New Value) can be shown in full.
 */
@Getter
@Setter
@Entity
@Table(name = "boq_change_logs", indexes = {
    @Index(name = "idx_bcl_boq", columnList = "boq_id")
})
public class BoqChangeLog extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id", nullable = false)
    private Boq boq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_item_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "boq", "materials", "labours"})
    private BoqItem boqItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_phase_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "boq"})
    private BoqPhase boqPhase;

    @Column(name = "change_type", nullable = false, length = 50)
    private String changeType;
    // ADD_FLOOR, REMOVE_FLOOR, ADD_ROOM, REMOVE_ROOM, ADD_ITEM, REMOVE_ITEM, QUANTITY_CHANGED,
    // MATERIAL_CHANGED, DIMENSIONS_CHANGED, LABOUR_CHANGED, RATE_CHANGED, VENDOR_CHANGED,
    // PHASE_SPLIT, PHASE_MERGED, ITEM_DISABLED, ITEM_ENABLED, PHASE_DISABLED, PHASE_ENABLED, ROOM_MOVED

    @Column(name = "field_name", length = 100)
    private String fieldName;

    @Column(name = "previous_value", columnDefinition = "TEXT")
    private String previousValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modified_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User modifiedBy;

    @Column(name = "modified_date", nullable = false)
    private LocalDateTime modifiedDate = LocalDateTime.now();

    @Column(name = "revision_number")
    private Integer revisionNumber;
}

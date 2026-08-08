package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "measurement_checklists")
public class MeasurementChecklist extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id", nullable = false)
    private Measurement measurement;

    @Column(name = "item_name", length = 200)
    private String itemName;

    @Column(name = "is_completed")
    private Boolean isCompleted;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "completed_by", length = 100)
    private String completedBy;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

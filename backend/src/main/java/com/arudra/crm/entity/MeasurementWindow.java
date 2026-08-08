package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_windows")
public class MeasurementWindow extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom measurementRoom;

    @Column(name = "window_name", length = 100)
    private String windowName;

    private Double width;
    private Double height;

    @Column(name = "frame_material", length = 100)
    private String frameMaterial;

    @Column(name = "glass_type", length = 100)
    private String glassType;

    @Column(name = "curtain_required")
    private Boolean curtainRequired;

    @Column(name = "blinds_required")
    private Boolean blindsRequired;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

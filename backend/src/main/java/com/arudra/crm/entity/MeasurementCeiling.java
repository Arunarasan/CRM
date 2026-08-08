package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_ceilings")
public class MeasurementCeiling extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom measurementRoom;

    @Column(name = "ceiling_type", length = 100)
    private String ceilingType;

    private Double height;

    @Column(name = "false_ceiling_required")
    private Boolean falseCeilingRequired;

    @Column(name = "lighting_points")
    private Integer lightingPoints;

    @Column(name = "fan_points")
    private Integer fanPoints;

    @Column(name = "ac_points")
    private Integer acPoints;

    @Column(name = "material_type", length = 100)
    private String materialType;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_material_estimates")
public class MeasurementMaterialEstimate extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id", nullable = false)
    private Measurement measurement;

    @Column(name = "paint_area")
    private Double paintArea;

    @Column(name = "tile_area")
    private Double tileArea;

    @Column(name = "wallpaper_area")
    private Double wallpaperArea;

    @Column(name = "plywood_sheets")
    private Double plywoodSheets;

    @Column(name = "laminates")
    private Double laminates;

    @Column(name = "edge_band")
    private Double edgeBand;

    @Column(name = "granite")
    private Double granite;

    @Column(name = "marble")
    private Double marble;

    @Column(name = "flooring")
    private Double flooring;

    @Column(name = "false_ceiling")
    private Double falseCeiling;

    @Column(name = "electrical_cable")
    private Double electricalCable;

    @Column(name = "lighting")
    private Integer lighting;

    @Column(name = "hardware")
    private Integer hardware;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

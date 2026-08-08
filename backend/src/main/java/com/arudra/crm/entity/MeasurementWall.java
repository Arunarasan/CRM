package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_walls")
public class MeasurementWall extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom measurementRoom;

    @Column(name = "wall_name", length = 50)
    private String wallName;

    private Double length;
    private Double height;
    private Double thickness;

    @Column(name = "finish_type", length = 100)
    private String finishType;

    @Column(name = "paint_required")
    private Boolean paintRequired;

    @Column(name = "wallpaper_required")
    private Boolean wallpaperRequired;

    @Column(name = "false_wall")
    private Boolean falseWall;

    @Column(name = "electrical_points")
    private Integer electricalPoints;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

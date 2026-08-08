package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_floors")
public class MeasurementFloor extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom measurementRoom;

    @Column(name = "floor_type", length = 100)
    private String floorType; // Wooden Flooring, Marble, Granite, Vinyl, Carpet, Tile

    @Column(name = "tile_type", length = 100)
    private String tileType;

    @Column(name = "floor_area")
    private Double floorArea;

    @Column(name = "skirting_length")
    private Double skirtingLength;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

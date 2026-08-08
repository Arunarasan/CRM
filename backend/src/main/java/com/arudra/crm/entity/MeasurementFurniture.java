package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_furniture")
public class MeasurementFurniture extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom measurementRoom;

    @Column(name = "furniture_type", length = 100)
    private String furnitureType; // Wardrobe, TV Unit, Kitchen, Study Table, Shoe Rack, Dining Unit, Office Desk, Reception Counter, Custom Furniture

    private Double length;
    private Double width;
    private Double height;

    @Column(length = 100)
    private String material;

    @Column(length = 100)
    private String finish;

    private Integer quantity;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

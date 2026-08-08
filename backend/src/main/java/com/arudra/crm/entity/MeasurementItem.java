package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * A measured element inside a room: walls, doors, windows, columns, beams, ceiling,
 * floor, electrical/plumbing points, or custom items. Generic on purpose so the API
 * surface stays uniform; the legacy per-type tables (MeasurementWall etc.) remain
 * untouched for backward compatibility.
 */
@Getter
@Setter
@Entity
@Table(name = "measurement_items")
public class MeasurementItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom room;

    @Column(name = "item_type", length = 50)
    private String itemType; // Wall, Door, Window, Column, Beam, Ceiling, Floor, Electrical Point,
                             // Switch, Socket, Light, Fan, AC Point, Plumbing Point, Custom

    @Column(name = "item_name", length = 150)
    private String itemName;

    private Double length;
    private Double width;
    private Double height;

    private Integer quantity;

    /** Auto-calculated: length × height (walls/doors/windows) or length × width, times quantity. */
    private Double area;

    @Column(length = 20)
    private String unit; // sqft, rft, nos

    @Column(length = 100)
    private String material;

    @Column(columnDefinition = "TEXT")
    private String notes;
}

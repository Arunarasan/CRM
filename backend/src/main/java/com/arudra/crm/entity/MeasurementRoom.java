package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_rooms")
public class MeasurementRoom extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id", nullable = false)
    private Measurement measurement;

    @Column(name = "room_name", length = 100)
    private String roomName;

    @Column(name = "room_type", length = 50)
    private String roomType; // Living Room, Bedroom, Kitchen, etc.

    @Column(name = "floor_number", length = 20)
    private String floorNumber;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    private String status;

    // Room Dimensions
    private Double length;
    private Double width;
    private Double height;

    @Column(name = "ceiling_height")
    private Double ceilingHeight;

    // Structural counts
    @Column(name = "door_count")
    private Integer doorCount;

    @Column(name = "window_count")
    private Integer windowCount;

    @Column(name = "column_count")
    private Integer columnCount;

    @Column(name = "beam_count")
    private Integer beamCount;

    // Scope-of-work flags
    @Column(name = "false_ceiling_required")
    private Boolean falseCeilingRequired;

    @Column(name = "flooring_required")
    private Boolean flooringRequired;

    @Column(name = "painting_required")
    private Boolean paintingRequired;

    @Column(name = "wardrobe_required")
    private Boolean wardrobeRequired;

    @Column(name = "kitchen_required")
    private Boolean kitchenRequired;

    @Column(name = "tv_unit_required")
    private Boolean tvUnitRequired;

    @Column(name = "loft_required")
    private Boolean loftRequired;

    @Column(name = "storage_required")
    private Boolean storageRequired;

    @Column(columnDefinition = "TEXT")
    private String notes;

    // Derived calculated values (recomputed by MeasurementService)
    @Column(name = "floor_area")
    private Double floorArea;

    @Column(name = "wall_area")
    private Double wallArea;

    @Column(name = "ceiling_area")
    private Double ceilingArea;

    private Double perimeter;

    @Column(name = "door_area")
    private Double doorArea;

    @Column(name = "window_area")
    private Double windowArea;

    @Column(name = "paintable_area")
    private Double paintableArea;

    @Column(name = "false_ceiling_area")
    private Double falseCeilingArea;

    @Column(name = "tile_area")
    private Double tileArea;

    @Column(name = "woodwork_area")
    private Double woodworkArea;
}

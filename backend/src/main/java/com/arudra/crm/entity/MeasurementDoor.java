package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_doors")
public class MeasurementDoor extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom measurementRoom;

    @Column(name = "door_name", length = 100)
    private String doorName;

    private Double width;
    private Double height;

    @Column(length = 100)
    private String material;

    @Column(name = "frame_type", length = 100)
    private String frameType;

    @Column(length = 100)
    private String glass;

    @Column(name = "hardware_required", columnDefinition = "TEXT")
    private String hardwareRequired;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

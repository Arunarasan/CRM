package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_plumbing")
public class MeasurementPlumbing extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom measurementRoom;

    @Column(name = "water_inlet")
    private Boolean waterInlet;

    @Column(name = "drainage")
    private Boolean drainage;

    @Column(name = "wash_basin")
    private Boolean washBasin;

    @Column(name = "kitchen_sink")
    private Boolean kitchenSink;

    @Column(name = "toilet")
    private Boolean toilet;

    @Column(name = "shower")
    private Boolean shower;

    @Column(name = "geyser_point")
    private Boolean geyserPoint;

    @Column(name = "water_tank")
    private Boolean waterTank;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

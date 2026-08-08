package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_electrical")
public class MeasurementElectrical extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id", nullable = false)
    private MeasurementRoom measurementRoom;

    @Column(name = "switch_points")
    private Integer switchPoints;

    @Column(name = "socket_points")
    private Integer socketPoints;

    @Column(name = "light_points")
    private Integer lightPoints;

    @Column(name = "fan_points")
    private Integer fanPoints;

    @Column(name = "ac_points")
    private Integer acPoints;

    @Column(name = "tv_points")
    private Integer tvPoints;

    @Column(name = "network_points")
    private Integer networkPoints;

    @Column(name = "cctv_points")
    private Integer cctvPoints;

    @Column(name = "power_load", length = 50)
    private String powerLoad;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

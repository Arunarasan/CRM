package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "site_measurements")
public class SiteMeasurement extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_room_id", nullable = false)
    private SiteRoom siteRoom;

    @Column(name = "measurement_length")
    private Double length;

    @Column(name = "measurement_width")
    private Double width;

    @Column(name = "measurement_height")
    private Double height;

    @Column(name = "area")
    private Double area;

    @Column(name = "doors")
    private Integer doors;

    @Column(name = "windows")
    private Integer windows;

    @Column(name = "ceiling_height")
    private Double ceilingHeight;

    @Column(name = "floor_type", length = 100)
    private String floorType;

    @Column(name = "wall_finish", length = 100)
    private String wallFinish;

    @Column(columnDefinition = "TEXT")
    private String notes;
}

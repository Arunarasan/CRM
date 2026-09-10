package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * An office / site geofence. A GEO clock-in is measured against the nearest active location: the
 * session is verified when its captured lat/lng is within {@link #radiusMeters} of this centre,
 * otherwise it is flagged for HR approval (soft enforcement).
 */
@Getter
@Setter
@Entity
@Table(name = "attendance_locations")
public class AttendanceLocation extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, precision = 10, scale = 6)
    private BigDecimal latitude;

    @Column(nullable = false, precision = 10, scale = 6)
    private BigDecimal longitude;

    @Column(name = "radius_meters", nullable = false)
    private Integer radiusMeters = 150;

    @Column(length = 500)
    private String address;

    @Column(nullable = false)
    private Boolean active = true;
}

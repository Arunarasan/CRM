package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "attendance")
public class Attendance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 20)
    private String status; // PRESENT, ABSENT, HALF_DAY, LEAVE

    @Column(name = "check_in_time")
    private LocalTime checkInTime;

    @Column(name = "check_out_time")
    private LocalTime checkOutTime;

    // --- Time-clock: break tracking (self-service clock) ----------------------
    /** Start of the currently-open break; null when not on a break. */
    @Column(name = "break_start")
    private LocalTime breakStart;

    @Column(name = "break_end")
    private LocalTime breakEnd;

    /** Accumulated break time across the day, in minutes. */
    @Column(name = "break_minutes", nullable = false)
    private Integer breakMinutes = 0;

    // --- Computed on clock-out (or live while checked in) ---------------------
    @Column(name = "worked_hours", precision = 6, scale = 2)
    private BigDecimal workedHours;

    @Column(name = "overtime_hours", nullable = false, precision = 6, scale = 2)
    private BigDecimal overtimeHours = BigDecimal.ZERO;

    @Column(name = "day_earnings", precision = 12, scale = 2)
    private BigDecimal dayEarnings;

    // --- Optional capture at clock-in -----------------------------------------
    @Column(name = "check_in_lat", precision = 10, scale = 6)
    private BigDecimal checkInLat;

    @Column(name = "check_in_lng", precision = 10, scale = 6)
    private BigDecimal checkInLng;

    @Column(name = "location_label", length = 255)
    private String locationLabel;

    @Column(name = "device_info", length = 255)
    private String deviceInfo;

    // Additional notes or reasons for late/early out
    @Column(columnDefinition = "TEXT")
    private String remarks;
}

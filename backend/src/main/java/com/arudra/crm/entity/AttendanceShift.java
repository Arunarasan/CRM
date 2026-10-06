package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalTime;

/**
 * A working shift. Drives the late / early-departure / overtime / half-day figures computed when a
 * biometric punch is recorded (see AttendanceShiftCalculator). A shift whose end is before its start
 * runs overnight. {@link #weekOffDays} is a comma-separated list of {@link java.time.DayOfWeek} names.
 */
@Getter
@Setter
@Entity
@Table(name = "attendance_shifts")
public class AttendanceShift extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "grace_period_minutes", nullable = false)
    private Integer gracePeriodMinutes = 15;

    /** Unpaid scheduled break, deducted from payable hours on a full day. */
    @Column(name = "break_minutes", nullable = false)
    private Integer breakMinutes = 60;

    /** Net working hours of the shift (span − break). Derived on save. */
    @Column(name = "working_hours", nullable = false, precision = 5, scale = 2)
    private BigDecimal workingHours = new BigDecimal("8.00");

    @Column(name = "overtime_enabled", nullable = false)
    private Boolean overtimeEnabled = true;

    /** A day worked for fewer minutes than this is a HALF_DAY. */
    @Column(name = "half_day_threshold_minutes", nullable = false)
    private Integer halfDayThresholdMinutes = 240;

    @Column(name = "week_off_days", nullable = false, length = 80)
    private String weekOffDays = "SUNDAY";

    /** Applied to employees with no shift of their own. Exactly one active shift should carry it. */
    @Column(name = "is_default", nullable = false)
    private Boolean defaultShift = false;

    @Column(nullable = false)
    private Boolean active = true;
}

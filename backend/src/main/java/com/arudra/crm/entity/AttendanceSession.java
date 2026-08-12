package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalTime;

/**
 * One clock-in → clock-out session within a day. An {@link Attendance} row is the day aggregate and
 * owns many sessions, so an employee can clock in and out multiple times a day; the day's worked
 * hours/earnings are summed across all its sessions (see EmployeeTimeService.computeBreakdown).
 */
@Getter
@Setter
@Entity
@Table(name = "attendance_sessions", indexes = {
    @Index(name = "idx_att_session_attendance", columnList = "attendance_id")
})
public class AttendanceSession extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attendance_id", nullable = false)
    private Attendance attendance;

    @Column(name = "check_in_time")
    private LocalTime checkInTime;

    @Column(name = "check_out_time")
    private LocalTime checkOutTime;

    /** Start of the currently-open break in this session; null when not on a break. */
    @Column(name = "break_start")
    private LocalTime breakStart;

    @Column(name = "break_end")
    private LocalTime breakEnd;

    /** Accumulated break time within this session, in minutes. */
    @Column(name = "break_minutes", nullable = false)
    private Integer breakMinutes = 0;

    @Column(name = "check_in_lat", precision = 10, scale = 6)
    private BigDecimal checkInLat;

    @Column(name = "check_in_lng", precision = 10, scale = 6)
    private BigDecimal checkInLng;

    @Column(name = "location_label", length = 255)
    private String locationLabel;

    @Column(name = "device_info", length = 255)
    private String deviceInfo;

    /** True once admins have been alerted that this session ran past the shift without a clock-out. */
    @Column(name = "overtime_alert_sent", nullable = false)
    private Boolean overtimeAlertSent = false;
}

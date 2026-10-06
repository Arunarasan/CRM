package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Every punch a terminal sent, accepted or not. (device_id, idempotency_key) is unique, so a punch
 * replayed by offline sync returns the original outcome instead of recording attendance twice.
 */
@Getter
@Setter
@Entity
@Table(name = "attendance_punches",
    uniqueConstraints = @UniqueConstraint(name = "uq_att_punch_device_key", columnNames = {"device_id", "idempotency_key"}),
    indexes = @Index(name = "idx_att_punch_employee_time", columnList = "employee_id, punch_time"))
public class AttendancePunch extends BaseEntity {

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "employee_id")
    private Long employeeId;

    @Column(name = "idempotency_key", nullable = false, length = 64)
    private String idempotencyKey;

    /** When the punch happened (trusted server-anchored time from the terminal, or receipt time). */
    @Column(name = "punch_time", nullable = false)
    private LocalDateTime punchTime;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;

    /** AUTO | CHECK_IN | CHECK_OUT. */
    @Column(name = "requested_action", nullable = false, length = 20)
    private String requestedAction;

    /** See {@code PunchResult}. */
    @Column(nullable = false, length = 30)
    private String result;

    @Column(length = 255)
    private String message;

    @Column(nullable = false)
    private Boolean offline = false;

    /** SERVER / SERVER_ANCHORED / DEVICE_CLOCK. */
    @Column(name = "time_source", length = 30)
    private String timeSource;

    @Column(name = "match_score")
    private Integer matchScore;

    /** FINGERPRINT (1:N) | EMPLOYEE_ID_FINGERPRINT (1:1). */
    @Column(length = 30)
    private String identification;

    @Column(name = "attendance_id")
    private Long attendanceId;

    /** Recorded but needs HR review (e.g. an offline punch whose clock could not be trusted). */
    @Column(nullable = false)
    private Boolean flagged = false;
}

package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * One raw punch pushed by a fingerprint machine. Append-only; (machine, pin, time) is unique so a
 * machine re-sending its log is ignored. {@link #result} records what the pairing engine did with it.
 */
@Getter
@Setter
@Entity
@Table(name = "machine_punches", indexes = {
    @Index(name = "idx_machine_punch_emp_time", columnList = "employee_id,punch_time"),
    @Index(name = "idx_machine_punch_pin", columnList = "machine_pin"),
    @Index(name = "idx_machine_punch_result", columnList = "result")
})
public class MachinePunch extends BaseEntity {

    public static final String PENDING = "PENDING";
    public static final String USED = "USED";
    public static final String DUPLICATE_TAP = "DUPLICATE_TAP";
    public static final String UNMATCHED = "UNMATCHED";
    public static final String AFTER_CORRECTION = "AFTER_CORRECTION";
    public static final String IGNORED = "IGNORED";
    /** Before the machine was added to the CRM, or dated in the future (wrong machine clock) — never used. */
    public static final String OUT_OF_RANGE = "OUT_OF_RANGE";

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "machine_id", nullable = false)
    private AttendanceMachine machine;

    @Column(name = "machine_pin", nullable = false, length = 20)
    private String machinePin;

    /** Machine-local wall-clock time of the punch (see {@link AttendanceMachine#getTimeZone()}). */
    @Column(name = "punch_time", nullable = false)
    private LocalDateTime punchTime;

    /** Null until the PIN is linked to an employee. */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    /** Machine In/Out key: 0 in, 1 out, 2 break-out, 3 break-in, 4 OT-in, 5 OT-out. */
    @Column(name = "status_code")
    private Integer statusCode;

    /** How the machine verified: 1 finger, 15 face, 4 card, 0 password. */
    @Column(name = "verify_code")
    private Integer verifyCode;

    @Column(name = "work_code", length = 20)
    private String workCode;

    @Column(name = "raw_line", length = 255)
    private String rawLine;

    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    @Column(nullable = false, length = 20)
    private String result = PENDING;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private AttendanceSession session;
}

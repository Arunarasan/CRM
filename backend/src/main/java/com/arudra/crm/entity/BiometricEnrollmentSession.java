package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * An admin-initiated enrollment handed to a specific terminal. The admin starts it from the employee's
 * Biometric tab; the terminal picks it up on its next heartbeat, guides the employee through the scans
 * and reports the outcome. A terminal can only complete a session addressed to itself, so a device
 * can never enroll anyone on its own initiative.
 */
@Getter
@Setter
@Entity
@Table(name = "biometric_enrollment_sessions", indexes = @Index(name = "idx_bio_session_device_status", columnList = "device_id, status"))
public class BiometricEnrollmentSession extends BaseEntity {

    public static final String PENDING = "PENDING";
    public static final String IN_PROGRESS = "IN_PROGRESS";
    public static final String COMPLETED = "COMPLETED";
    public static final String FAILED = "FAILED";
    public static final String CANCELLED = "CANCELLED";
    public static final String EXPIRED = "EXPIRED";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private AttendanceDevice device;

    @Column(name = "finger_position", length = 30)
    private String fingerPosition;

    @Column(nullable = false, length = 20)
    private String status = PENDING;

    @Column(name = "requested_by", length = 255)
    private String requestedBy;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(name = "biometric_id")
    private Long biometricId;

    public boolean isOpen() {
        return PENDING.equals(status) || IN_PROGRESS.equals(status);
    }
}

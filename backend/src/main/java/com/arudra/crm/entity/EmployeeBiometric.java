package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A biometric enrollment REFERENCE. The fingerprint template itself never leaves the terminal: it is
 * kept in the terminal's hardware-keyed encrypted store and matched there by the scanner SDK. This
 * row only records which terminal holds a template for the employee, under which opaque handle.
 * Revoking sets status REVOKED; terminals delete the local template on their next enrollment sync.
 */
@Getter
@Setter
@Entity
@Table(name = "employee_biometrics", indexes = @Index(name = "idx_emp_biometric_employee", columnList = "employee_id, status"))
public class EmployeeBiometric extends BaseEntity {

    public static final String ACTIVE = "ACTIVE";
    public static final String REVOKED = "REVOKED";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id")
    private AttendanceDevice device;

    /** BiometricProvider id that produced the template, e.g. EXTERNAL_SCANNER:MANTRA_MFS100. */
    @Column(nullable = false, length = 60)
    private String provider;

    @Column(name = "template_ref", nullable = false, length = 128)
    private String templateRef;

    /** RIGHT_THUMB, RIGHT_INDEX, … LEFT_LITTLE. */
    @Column(name = "finger_position", length = 30)
    private String fingerPosition;

    @Column(name = "quality_score")
    private Integer qualityScore;

    @Column(nullable = false, length = 20)
    private String status = ACTIVE;

    @Column(name = "enrolled_by", length = 255)
    private String enrolledBy;

    @Column(name = "enrolled_at")
    private LocalDateTime enrolledAt;

    @Column(name = "revoked_by", length = 255)
    private String revokedBy;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;
}

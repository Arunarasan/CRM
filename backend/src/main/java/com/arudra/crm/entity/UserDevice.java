package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A phone bound to a user account for attendance. The phone holds a non-extractable WebCrypto
 * ECDSA P-256 key pair; only the public half ({@link #publicKey}, SPKI base64) is stored here and
 * every clock-in/out carries a signed one-time challenge verified against it. One ACTIVE device per
 * user by default (app.attendance.device-binding.max-devices-per-user).
 *
 * Status: PENDING (awaiting admin approval) | ACTIVE | REVOKED | REPLACED | REJECTED.
 */
@Getter
@Setter
@Entity
@Table(name = "user_devices", indexes = {
    @Index(name = "idx_user_device_user_status", columnList = "user_id,status"),
    @Index(name = "idx_user_device_status", columnList = "status"),
    @Index(name = "idx_user_device_uuid", columnList = "device_uuid"),
    @Index(name = "idx_user_device_pk_hash", columnList = "public_key_hash")
})
public class UserDevice extends BaseEntity {

    public static final String PENDING = "PENDING";
    public static final String ACTIVE = "ACTIVE";
    public static final String REVOKED = "REVOKED";
    public static final String REPLACED = "REPLACED";
    public static final String REJECTED = "REJECTED";

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Linked employee (by the employee↔user email rule), for HR screens; null for non-employees. */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    /** Random id generated on the phone and kept beside the key in IndexedDB. */
    @Column(name = "device_uuid", nullable = false, length = 64)
    private String deviceUuid;

    /** SPKI public key, base64. */
    @JsonIgnore
    @Column(name = "public_key", nullable = false, columnDefinition = "TEXT")
    private String publicKey;

    /** SHA-256 hex of the public key — used to spot the same phone bound under two users. */
    @JsonIgnore
    @Column(name = "public_key_hash", nullable = false, length = 64)
    private String publicKeyHash;

    @Column(name = "key_alg", nullable = false, length = 20)
    private String keyAlg = "ES256";

    @Column(name = "device_label", length = 150)
    private String deviceLabel;

    @Column(length = 50)
    private String platform;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(nullable = false, length = 20)
    private String status = PENDING;

    /** Why the employee asked for this (new / lost / broken phone); null for a first bind. */
    @Column(name = "request_reason", length = 255)
    private String requestReason;

    @Column(name = "requested_at")
    private LocalDateTime requestedAt;

    @Column(name = "approved_by", length = 255)
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "revoked_by", length = 255)
    private String revokedBy;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "revoke_reason", length = 255)
    private String revokeReason;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "last_ip", length = 64)
    private String lastIp;

    /** The biometric credential registered on this same phone, if any. */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "webauthn_credential_id")
    private EmployeeWebauthnCredential webauthnCredential;
}

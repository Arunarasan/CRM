package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A registered office kiosk (shared phone/tablet used for face attendance). Paired once with a
 * short-lived code; afterwards the device authenticates with a long random token. Only SHA-256
 * hashes of the code and token are stored.
 */
@Getter
@Setter
@Entity
@Table(name = "attendance_kiosks")
public class AttendanceKiosk extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "office_location_id")
    private AttendanceLocation officeLocation;

    @Column(nullable = false)
    private Boolean active = true;

    /** What this kiosk accepts: FACE | FINGER | EITHER. */
    @Column(name = "verify_mode", nullable = false, length = 10)
    private String verifyMode = "FACE";

    @JsonIgnore
    @Column(name = "pairing_code_hash", length = 64)
    private String pairingCodeHash;

    @Column(name = "pairing_expires_at")
    private LocalDateTime pairingExpiresAt;

    @JsonIgnore
    @Column(name = "token_hash", length = 64)
    private String tokenHash;

    @Column(name = "paired_at")
    private LocalDateTime pairedAt;

    @Column(name = "device_info", length = 255)
    private String deviceInfo;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "last_ip", length = 64)
    private String lastIp;
}

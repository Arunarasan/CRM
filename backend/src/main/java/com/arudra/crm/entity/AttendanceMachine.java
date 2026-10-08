package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A wall fingerprint machine (ZKTeco / eSSL) that pushes punches to the CRM over the ADMS protocol.
 * Identified by its serial number in every request; only registered + active machines are accepted.
 * The machine matches fingers itself — the CRM only ever receives "PIN X punched at T".
 */
@Getter
@Setter
@Entity
@Table(name = "attendance_machines")
public class AttendanceMachine extends BaseEntity {

    @Column(name = "serial_number", nullable = false, length = 64, unique = true)
    private String serialNumber;

    @Column(nullable = false, length = 150)
    private String name;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "office_location_id")
    private AttendanceLocation officeLocation;

    /** Machine clocks send local times with no zone; this is the zone they're in. */
    @Column(name = "time_zone", nullable = false, length = 64)
    private String timeZone = "Asia/Kolkata";

    @Column(nullable = false)
    private Boolean active = true;

    /** Trust the machine's In/Out keys instead of alternating in → out → in. */
    @Column(name = "use_in_out_keys", nullable = false)
    private Boolean useInOutKeys = false;

    /** Optional extra lock: only accept requests from this IP. */
    @Column(name = "allowed_ip", length = 64)
    private String allowedIp;

    @Column(length = 100)
    private String model;

    @Column(name = "push_version", length = 30)
    private String pushVersion;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "last_ip", length = 64)
    private String lastIp;

    @Column(name = "last_punch_at")
    private LocalDateTime lastPunchAt;

    /** An offline alert was already sent for the current outage (reset when it reports again). */
    @Column(name = "offline_alerted", nullable = false)
    private Boolean offlineAlerted = false;
}

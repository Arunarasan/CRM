package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** An unregistered machine that tried to connect — listed for HR to add (or dismiss). */
@Getter
@Setter
@Entity
@Table(name = "attendance_machine_requests")
public class AttendanceMachineRequest extends BaseEntity {

    @Column(name = "serial_number", nullable = false, length = 64, unique = true)
    private String serialNumber;

    @Column(name = "last_ip", length = 64)
    private String lastIp;

    @Column(name = "push_version", length = 30)
    private String pushVersion;

    @Column(nullable = false)
    private Integer attempts = 1;

    @Column(name = "first_seen_at")
    private LocalDateTime firstSeenAt;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(nullable = false)
    private Boolean dismissed = false;
}

package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** One entry in a terminal's activity trail: lifecycle changes, punches, enrollments, auth failures. */
@Getter
@Setter
@Entity
@Table(name = "attendance_device_events", indexes = {
    @Index(name = "idx_att_device_event_device_time", columnList = "device_id, occurred_at")
})
public class AttendanceDeviceEvent extends BaseEntity {

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(length = 500)
    private String message;

    @Column(name = "employee_id")
    private Long employeeId;

    @Column(length = 255)
    private String actor;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;
}

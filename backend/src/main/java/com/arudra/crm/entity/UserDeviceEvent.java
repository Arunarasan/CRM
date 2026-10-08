package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Append-only audit entry for device binding: BIND_REQUESTED | AUTO_APPROVED | APPROVED | REJECTED |
 * REVOKED | REPLACED | RESET | MISMATCH_PUNCH | SHARED_DEVICE_DETECTED. Ids only (no lazy relations)
 * so the trail survives device rows changing state.
 */
@Getter
@Setter
@Entity
@Table(name = "user_device_events", indexes = {
    @Index(name = "idx_user_device_event_user", columnList = "user_id,created_at"),
    @Index(name = "idx_user_device_event_device", columnList = "device_id")
})
public class UserDeviceEvent extends BaseEntity {

    @Column(name = "device_id")
    private Long deviceId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 40)
    private String event;

    @Column(length = 255)
    private String actor;

    @Column(length = 64)
    private String ip;

    @Column(length = 1000)
    private String details;
}

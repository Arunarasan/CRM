package com.arudra.crm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "activity_logs")
public class ActivityLog extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String module;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(name = "entity_name", length = 100)
    private String entityName;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "performed_by", length = 100)
    private String performedBy;

    @Column(name = "performed_role", length = 50)
    private String performedRole;

    @Column(name = "performed_at")
    private LocalDateTime performedAt;

    @Column(name = "old_value", columnDefinition = "JSON")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "JSON")
    private String newValue;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(length = 255)
    private String browser;

    @Column(length = 255)
    private String device;

    @Column(name = "operating_system", length = 100)
    private String operatingSystem;

    @Column(name = "request_id", length = 100)
    private String requestId;

    @Column(name = "company_id")
    private Long companyId;
}

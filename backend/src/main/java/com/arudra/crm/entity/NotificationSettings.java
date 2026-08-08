package com.arudra.crm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "notification_settings")
public class NotificationSettings extends BaseEntity {

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "email_enabled", nullable = false)
    private boolean emailEnabled = true;

    @Column(name = "sms_enabled", nullable = false)
    private boolean smsEnabled = false;

    @Column(name = "whatsapp_enabled", nullable = false)
    private boolean whatsappEnabled = false;

    @Column(name = "in_app_enabled", nullable = false)
    private boolean inAppEnabled = true;
}

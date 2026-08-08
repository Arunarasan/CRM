package com.arudra.crm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "notifications")
public class Notification extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    @Column(nullable = false, length = 50)
    private String type; // TASK, PAYMENT, LEAD, PROJECT, SYSTEM

    @Column(name = "recipient_id", nullable = false)
    private Long recipientId; // Can link to User or Employee

    @Column(name = "is_read", nullable = false)
    private boolean isRead = false;

    @Column(name = "action_url", length = 500)
    private String actionUrl; // Optional deep link
}

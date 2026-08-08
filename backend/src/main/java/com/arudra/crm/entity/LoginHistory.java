package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "login_history")
public class LoginHistory extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user; // Can be null if login fails for non-existent user

    @Column(name = "attempted_email", length = 100)
    private String attemptedEmail;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(nullable = false, length = 20)
    private String status; // SUCCESS, FAILED

    @Column(name = "login_time", nullable = false)
    private LocalDateTime loginTime;
}

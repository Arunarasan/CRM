package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_user_email", columnList = "email")
})
@JsonIgnoreProperties(value = {"hibernateLazyInitializer", "handler"}, ignoreUnknown = true)
public class User extends BaseEntity {

    @NotBlank
    @Email
    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @NotBlank
    @Column(nullable = false, length = 255)
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    @NotBlank
    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @JsonIgnore
    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts = 0;

    @JsonIgnore
    @Column(name = "account_non_locked", nullable = false)
    private boolean accountNonLocked = true;

    @JsonIgnore
    @Column(name = "lock_time")
    private java.time.LocalDateTime lockTime;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();
}

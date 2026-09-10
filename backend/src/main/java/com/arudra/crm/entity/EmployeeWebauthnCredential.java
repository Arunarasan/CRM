package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A WebAuthn platform-authenticator credential registered by an employee on one device (Touch ID /
 * Android fingerprint / Windows Hello). Used to prove OFFICE_DEVICE / biometric clock-ins: the
 * browser returns a signed assertion which the server verifies against {@link #publicKey}, with
 * {@link #signCount} guarding against cloned authenticators.
 *
 * Keys are stored base64url-encoded (credential id + COSE public key) so lookup and verification
 * stay plain-string; never serialised to portal clients.
 */
@Getter
@Setter
@Entity
@Table(name = "employee_webauthn_credential", indexes = {
    @Index(name = "idx_emp_webauthn_employee", columnList = "employee_id")
})
public class EmployeeWebauthnCredential extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    /** base64url-encoded credential id returned by the authenticator; unique across all employees. */
    @Column(name = "credential_id", nullable = false, length = 512)
    private String credentialId;

    /** base64url-encoded COSE public key used to verify assertions. */
    @JsonIgnore
    @Column(name = "public_key", nullable = false, columnDefinition = "TEXT")
    private String publicKey;

    @Column(name = "sign_count", nullable = false)
    private Long signCount = 0L;

    @Column(name = "device_label", length = 150)
    private String deviceLabel;

    @Column(name = "attestation_type", length = 50)
    private String attestationType;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;
}

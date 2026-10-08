-- Attendance device binding: each user account is bound to ONE approved phone, and attendance is
-- only trusted from that phone. The phone holds a non-extractable WebCrypto ECDSA P-256 key pair
-- (private half never leaves the browser); the server stores the public half and verifies a signed
-- one-time challenge on every clock-in/out. Binding is to the LOGIN (users), with the linked
-- employee denormalised for HR screens.
--
-- Enforcement mode: OFF (not checked) | SOFT (punch saved but FLAGGED for HR review) |
-- HARD (punch refused). Global default comes from app.attendance.device-binding.default-mode;
-- employees.device_binding_mode is an optional per-employee override (NULL = use default).

-- 1) Bound devices. status: PENDING (awaiting admin) | ACTIVE | REVOKED | REPLACED.
CREATE TABLE user_devices (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id                 BIGINT        NOT NULL,
    employee_id             BIGINT        NULL,
    device_uuid             VARCHAR(64)   NOT NULL,
    public_key              TEXT          NOT NULL,
    public_key_hash         VARCHAR(64)   NOT NULL,
    key_alg                 VARCHAR(20)   NOT NULL DEFAULT 'ES256',
    device_label            VARCHAR(150)  NULL,
    platform                VARCHAR(50)   NULL,
    user_agent              VARCHAR(500)  NULL,
    status                  VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    request_reason          VARCHAR(255)  NULL,
    requested_at            DATETIME      NULL,
    approved_by             VARCHAR(255)  NULL,
    approved_at             DATETIME      NULL,
    revoked_by              VARCHAR(255)  NULL,
    revoked_at              DATETIME      NULL,
    revoke_reason           VARCHAR(255)  NULL,
    last_seen_at            DATETIME      NULL,
    last_ip                 VARCHAR(64)   NULL,
    webauthn_credential_id  BIGINT        NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_user_device_user     FOREIGN KEY (user_id)     REFERENCES users(id),
    CONSTRAINT fk_user_device_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_user_device_webauthn FOREIGN KEY (webauthn_credential_id) REFERENCES employee_webauthn_credential(id),
    CONSTRAINT uq_user_device_uuid UNIQUE (user_id, device_uuid),
    INDEX idx_user_device_user_status (user_id, status),
    INDEX idx_user_device_status (status),
    INDEX idx_user_device_uuid (device_uuid),
    INDEX idx_user_device_pk_hash (public_key_hash)
);

-- 2) Append-only audit trail of every binding change / suspicious punch.
--    event: BIND_REQUESTED | AUTO_APPROVED | APPROVED | REJECTED | REVOKED | REPLACED | RESET |
--           MISMATCH_PUNCH | SHARED_DEVICE_DETECTED
CREATE TABLE user_device_events (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id   BIGINT        NULL,
    user_id     BIGINT        NOT NULL,
    event       VARCHAR(40)   NOT NULL,
    actor       VARCHAR(255)  NULL,
    ip          VARCHAR(64)   NULL,
    details     VARCHAR(1000) NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_user_device_event_device FOREIGN KEY (device_id) REFERENCES user_devices(id),
    CONSTRAINT fk_user_device_event_user   FOREIGN KEY (user_id)   REFERENCES users(id),
    INDEX idx_user_device_event_user (user_id, created_at),
    INDEX idx_user_device_event_device (device_id)
);

-- 3) Per-employee enforcement override (NULL = global default).
ALTER TABLE employees ADD COLUMN device_binding_mode VARCHAR(10) NULL;

-- 4) Device-check result stamped onto each session.
ALTER TABLE attendance_sessions ADD COLUMN device_id              BIGINT       NULL;
ALTER TABLE attendance_sessions ADD COLUMN device_verified        BIT          NOT NULL DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN device_mismatch_reason VARCHAR(255) NULL;

ALTER TABLE attendance_sessions
    ADD CONSTRAINT fk_att_session_device FOREIGN KEY (device_id) REFERENCES user_devices(id);

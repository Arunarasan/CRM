-- Attendance verification: geo-fence + office-device (WebAuthn biometric).
-- Each employee is assigned a required verification method; a clock-in is never blocked, but a
-- session that fails its check is recorded FLAGGED for HR approval (soft enforcement).
--
-- The attendance/attendance_sessions tables already carry check_in_lat/lng, location_label and
-- device_info (V27). This migration adds: the per-employee method, the office/site geofences a GEO
-- clock-in is measured against, the per-employee registered biometric credentials, and the
-- verification/approval result stamped onto each session.

-- 1) Per-employee required method: GEO (self clock-in inside a fence) | OFFICE_DEVICE (biometric on
--    an approved device) | ANY (either satisfies).
ALTER TABLE employees ADD COLUMN attendance_method VARCHAR(20) NOT NULL DEFAULT 'GEO';

-- 2) Office / site geofences. A GEO clock-in is verified against the nearest active location.
CREATE TABLE attendance_locations (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(150)  NOT NULL,
    latitude       DECIMAL(10,6) NOT NULL,
    longitude      DECIMAL(10,6) NOT NULL,
    radius_meters  INT           NOT NULL DEFAULT 150,
    address        VARCHAR(500)  NULL,
    active         BIT           NOT NULL DEFAULT 1,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0
);

-- 3) Registered WebAuthn credentials (platform biometric — Touch ID / Android fingerprint / Windows
--    Hello). One row per employee+device. Keys stored base64url; sign_count guards against clones.
CREATE TABLE employee_webauthn_credential (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id       BIGINT        NOT NULL,
    credential_id     VARCHAR(512)  NOT NULL,
    public_key        TEXT          NOT NULL,
    sign_count        BIGINT        NOT NULL DEFAULT 0,
    device_label      VARCHAR(150)  NULL,
    attestation_type  VARCHAR(50)   NULL,
    last_used_at      DATETIME      NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_emp_webauthn_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT uq_emp_webauthn_credential_id UNIQUE (credential_id),
    INDEX idx_emp_webauthn_employee (employee_id)
);

-- 4) Verification result stamped onto each clock-in session.
--    verification_method: how this session was checked (GEO | BIOMETRIC | DEVICE | NONE).
--    verified: the check passed. flagged: it did NOT and needs review.
--    approval_status: NULL when not flagged; PENDING/APPROVED/REJECTED once flagged.
ALTER TABLE attendance_sessions ADD COLUMN verification_method VARCHAR(20) NULL;
ALTER TABLE attendance_sessions ADD COLUMN verified            BIT          NOT NULL DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN flagged             BIT          NOT NULL DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN flag_reason         VARCHAR(255) NULL;
ALTER TABLE attendance_sessions ADD COLUMN distance_meters     INT          NULL;
ALTER TABLE attendance_sessions ADD COLUMN office_location_id  BIGINT       NULL;
ALTER TABLE attendance_sessions ADD COLUMN approval_status     VARCHAR(20)  NULL;
ALTER TABLE attendance_sessions ADD COLUMN approved_by         VARCHAR(255) NULL;
ALTER TABLE attendance_sessions ADD COLUMN approved_at         DATETIME     NULL;

ALTER TABLE attendance_sessions
    ADD CONSTRAINT fk_att_session_office_location FOREIGN KEY (office_location_id) REFERENCES attendance_locations(id);

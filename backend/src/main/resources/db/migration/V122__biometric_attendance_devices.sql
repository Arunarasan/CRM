-- Biometric Attendance Device module.
--
-- One (or a few) dedicated, admin-approved Android attendance terminals per office, each with an
-- external USB fingerprint scanner. Employees identify themselves on the terminal; matching happens
-- on the terminal (vendor SDK) and only the resulting employee id reaches the server. The server
-- never receives or stores fingerprint images or templates — only an opaque template reference.
--
-- Adds:
--   branches                       — office/branch master (no branch entity existed before)
--   attendance_shifts              — shift definitions used for late / early / overtime / half-day
--   attendance_devices             — registered terminals + their hashed credential and health
--   attendance_device_events       — per-device activity/audit trail
--   attendance_punches             — every punch received (idempotency + raw log)
--   employee_biometrics            — template REFERENCE per employee (no biometric data)
--   biometric_enrollment_sessions  — admin-initiated enrollment handed to a terminal
-- and extends attendance / employees / attendance_locations with the new links and computed figures.

CREATE TABLE branches (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    code        VARCHAR(30)  NULL,
    address     VARCHAR(500) NULL,
    city        VARCHAR(100) NULL,
    phone       VARCHAR(30)  NULL,
    active      BIT          NOT NULL DEFAULT 1,
    created_at  DATETIME(6)  NULL,
    updated_at  DATETIME(6)  NULL,
    created_by  VARCHAR(255) NULL,
    updated_by  VARCHAR(255) NULL,
    deleted_by  VARCHAR(255) NULL,
    deleted_at  DATETIME(6)  NULL,
    is_deleted  BIT          NOT NULL DEFAULT 0,
    version     BIGINT       NULL DEFAULT 0,
    CONSTRAINT uq_branches_code UNIQUE (code)
);

CREATE TABLE attendance_shifts (
    id                          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name                        VARCHAR(100)  NOT NULL,
    start_time                  TIME          NOT NULL,
    end_time                    TIME          NOT NULL,
    grace_period_minutes        INT           NOT NULL DEFAULT 15,
    break_minutes               INT           NOT NULL DEFAULT 60,
    working_hours               DECIMAL(5,2)  NOT NULL,
    overtime_enabled            BIT           NOT NULL DEFAULT 1,
    half_day_threshold_minutes  INT           NOT NULL DEFAULT 240,
    week_off_days               VARCHAR(80)   NOT NULL DEFAULT 'SUNDAY',
    is_default                  BIT           NOT NULL DEFAULT 0,
    active                      BIT           NOT NULL DEFAULT 1,
    created_at  DATETIME(6)  NULL,
    updated_at  DATETIME(6)  NULL,
    created_by  VARCHAR(255) NULL,
    updated_by  VARCHAR(255) NULL,
    deleted_by  VARCHAR(255) NULL,
    deleted_at  DATETIME(6)  NULL,
    is_deleted  BIT          NOT NULL DEFAULT 0,
    version     BIGINT       NULL DEFAULT 0
);

-- A sensible starting shift so the module works before HR configures anything.
INSERT INTO attendance_shifts
    (name, start_time, end_time, grace_period_minutes, break_minutes, working_hours, overtime_enabled,
     half_day_threshold_minutes, week_off_days, is_default, active, created_at, created_by, is_deleted, version)
VALUES
    ('General Shift', '09:00:00', '18:00:00', 15, 60, 8.00, 1, 240, 'SUNDAY', 1, 1, NOW(6), 'system', 0, 0);

ALTER TABLE attendance_locations ADD COLUMN branch_id BIGINT NULL;
ALTER TABLE attendance_locations
    ADD CONSTRAINT fk_att_location_branch FOREIGN KEY (branch_id) REFERENCES branches(id);

ALTER TABLE employees ADD COLUMN branch_id BIGINT NULL;
ALTER TABLE employees ADD COLUMN attendance_shift_id BIGINT NULL;
ALTER TABLE employees
    ADD CONSTRAINT fk_employee_branch FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE employees
    ADD CONSTRAINT fk_employee_attendance_shift FOREIGN KEY (attendance_shift_id) REFERENCES attendance_shifts(id);

CREATE TABLE attendance_devices (
    id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_name           VARCHAR(120) NOT NULL,
    device_code           VARCHAR(60)  NOT NULL,
    device_uuid           VARCHAR(64)  NULL,
    status                VARCHAR(20)  NOT NULL,
    branch_id             BIGINT       NULL,
    location_id           BIGINT       NULL,
    -- SHA-256 of the high-entropy device secret; the secret itself is shown to the device once.
    credential_hash       VARCHAR(128) NULL,
    credential_version    INT          NOT NULL DEFAULT 0,
    credential_issued_at  DATETIME(6)  NULL,
    credential_delivered  BIT          NOT NULL DEFAULT 0,
    -- One-time token the device uses to poll its own registration status (hashed).
    poll_token_hash       VARCHAR(128) NULL,
    -- Admin-created device slot: one-time pairing code (hashed) the terminal types in.
    pairing_code_hash     VARCHAR(128) NULL,
    pairing_expires_at    DATETIME(6)  NULL,
    app_version           VARCHAR(40)  NULL,
    scanner_status        VARCHAR(30)  NULL,
    scanner_vendor        VARCHAR(60)  NULL,
    scanner_model         VARCHAR(100) NULL,
    scanner_serial        VARCHAR(100) NULL,
    manufacturer          VARCHAR(100) NULL,
    model                 VARCHAR(100) NULL,
    os_version            VARCHAR(40)  NULL,
    last_ip               VARCHAR(64)  NULL,
    last_seen_at          DATETIME(6)  NULL,
    last_sync_at          DATETIME(6)  NULL,
    pending_sync_count    INT          NOT NULL DEFAULT 0,
    offline_alert_sent    BIT          NOT NULL DEFAULT 0,
    registered_at         DATETIME(6)  NULL,
    approved_by           VARCHAR(255) NULL,
    approved_at           DATETIME(6)  NULL,
    status_reason         VARCHAR(255) NULL,
    status_changed_by     VARCHAR(255) NULL,
    status_changed_at     DATETIME(6)  NULL,
    created_at  DATETIME(6)  NULL,
    updated_at  DATETIME(6)  NULL,
    created_by  VARCHAR(255) NULL,
    updated_by  VARCHAR(255) NULL,
    deleted_by  VARCHAR(255) NULL,
    deleted_at  DATETIME(6)  NULL,
    is_deleted  BIT          NOT NULL DEFAULT 0,
    version     BIGINT       NULL DEFAULT 0,
    CONSTRAINT uq_att_device_code UNIQUE (device_code),
    CONSTRAINT uq_att_device_uuid UNIQUE (device_uuid),
    CONSTRAINT fk_att_device_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
    CONSTRAINT fk_att_device_location FOREIGN KEY (location_id) REFERENCES attendance_locations(id),
    INDEX idx_att_device_status (status)
);

CREATE TABLE attendance_device_events (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id    BIGINT       NOT NULL,
    event_type   VARCHAR(40)  NOT NULL,
    message      VARCHAR(500) NULL,
    employee_id  BIGINT       NULL,
    actor        VARCHAR(255) NULL,
    ip_address   VARCHAR(64)  NULL,
    occurred_at  DATETIME(6)  NOT NULL,
    created_at  DATETIME(6)  NULL,
    updated_at  DATETIME(6)  NULL,
    created_by  VARCHAR(255) NULL,
    updated_by  VARCHAR(255) NULL,
    deleted_by  VARCHAR(255) NULL,
    deleted_at  DATETIME(6)  NULL,
    is_deleted  BIT          NOT NULL DEFAULT 0,
    version     BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_att_device_event_device FOREIGN KEY (device_id) REFERENCES attendance_devices(id),
    INDEX idx_att_device_event_device_time (device_id, occurred_at)
);

CREATE TABLE attendance_punches (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id         BIGINT       NOT NULL,
    employee_id       BIGINT       NULL,
    idempotency_key   VARCHAR(64)  NOT NULL,
    punch_time        DATETIME(6)  NOT NULL,
    received_at       DATETIME(6)  NOT NULL,
    requested_action  VARCHAR(20)  NOT NULL,
    result            VARCHAR(30)  NOT NULL,
    message           VARCHAR(255) NULL,
    offline           BIT          NOT NULL DEFAULT 0,
    time_source       VARCHAR(30)  NULL,
    match_score       INT          NULL,
    identification    VARCHAR(30)  NULL,
    attendance_id     BIGINT       NULL,
    flagged           BIT          NOT NULL DEFAULT 0,
    created_at  DATETIME(6)  NULL,
    updated_at  DATETIME(6)  NULL,
    created_by  VARCHAR(255) NULL,
    updated_by  VARCHAR(255) NULL,
    deleted_by  VARCHAR(255) NULL,
    deleted_at  DATETIME(6)  NULL,
    is_deleted  BIT          NOT NULL DEFAULT 0,
    version     BIGINT       NULL DEFAULT 0,
    -- Server-side idempotency: a replayed offline record can never create a second punch.
    CONSTRAINT uq_att_punch_device_key UNIQUE (device_id, idempotency_key),
    CONSTRAINT fk_att_punch_device FOREIGN KEY (device_id) REFERENCES attendance_devices(id),
    CONSTRAINT fk_att_punch_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_att_punch_attendance FOREIGN KEY (attendance_id) REFERENCES attendance(id),
    INDEX idx_att_punch_employee_time (employee_id, punch_time)
);

CREATE TABLE employee_biometrics (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id     BIGINT       NOT NULL,
    device_id       BIGINT       NULL,
    provider        VARCHAR(60)  NOT NULL,
    -- Opaque handle of the template held in the terminal's encrypted store. NOT biometric data.
    template_ref    VARCHAR(128) NOT NULL,
    finger_position VARCHAR(30)  NULL,
    quality_score   INT          NULL,
    status          VARCHAR(20)  NOT NULL,
    enrolled_by     VARCHAR(255) NULL,
    enrolled_at     DATETIME(6)  NULL,
    revoked_by      VARCHAR(255) NULL,
    revoked_at      DATETIME(6)  NULL,
    created_at  DATETIME(6)  NULL,
    updated_at  DATETIME(6)  NULL,
    created_by  VARCHAR(255) NULL,
    updated_by  VARCHAR(255) NULL,
    deleted_by  VARCHAR(255) NULL,
    deleted_at  DATETIME(6)  NULL,
    is_deleted  BIT          NOT NULL DEFAULT 0,
    version     BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_emp_biometric_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_emp_biometric_device FOREIGN KEY (device_id) REFERENCES attendance_devices(id),
    INDEX idx_emp_biometric_employee (employee_id, status)
);

CREATE TABLE biometric_enrollment_sessions (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id      BIGINT       NOT NULL,
    device_id        BIGINT       NOT NULL,
    finger_position  VARCHAR(30)  NULL,
    status           VARCHAR(20)  NOT NULL,
    requested_by     VARCHAR(255) NULL,
    expires_at       DATETIME(6)  NOT NULL,
    completed_at     DATETIME(6)  NULL,
    failure_reason   VARCHAR(255) NULL,
    biometric_id     BIGINT       NULL,
    created_at  DATETIME(6)  NULL,
    updated_at  DATETIME(6)  NULL,
    created_by  VARCHAR(255) NULL,
    updated_by  VARCHAR(255) NULL,
    deleted_by  VARCHAR(255) NULL,
    deleted_at  DATETIME(6)  NULL,
    is_deleted  BIT          NOT NULL DEFAULT 0,
    version     BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_bio_session_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_bio_session_device FOREIGN KEY (device_id) REFERENCES attendance_devices(id),
    CONSTRAINT fk_bio_session_biometric FOREIGN KEY (biometric_id) REFERENCES employee_biometrics(id),
    INDEX idx_bio_session_device_status (device_id, status)
);

-- Day-aggregate extensions. `attendance.date` is the attendance date; the existing status column
-- now also carries LATE / HOLIDAY / WEEK_OFF / ON_DUTY / WORK_FROM_HOME.
ALTER TABLE attendance ADD COLUMN attendance_type          VARCHAR(20) NULL;
ALTER TABLE attendance ADD COLUMN device_id                BIGINT      NULL;
ALTER TABLE attendance ADD COLUMN branch_id                BIGINT      NULL;
ALTER TABLE attendance ADD COLUMN location_id              BIGINT      NULL;
ALTER TABLE attendance ADD COLUMN shift_id                 BIGINT      NULL;
ALTER TABLE attendance ADD COLUMN biometric_verified       BIT         NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN check_in_method          VARCHAR(30) NULL;
ALTER TABLE attendance ADD COLUMN check_out_method         VARCHAR(30) NULL;
ALTER TABLE attendance ADD COLUMN working_minutes          INT         NULL;
ALTER TABLE attendance ADD COLUMN overtime_minutes         INT         NULL;
ALTER TABLE attendance ADD COLUMN late_minutes             INT         NULL;
ALTER TABLE attendance ADD COLUMN early_departure_minutes  INT         NULL;
ALTER TABLE attendance
    ADD CONSTRAINT fk_attendance_device FOREIGN KEY (device_id) REFERENCES attendance_devices(id);
ALTER TABLE attendance
    ADD CONSTRAINT fk_attendance_branch FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE attendance
    ADD CONSTRAINT fk_attendance_location FOREIGN KEY (location_id) REFERENCES attendance_locations(id);
ALTER TABLE attendance
    ADD CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id);
CREATE INDEX idx_attendance_date_v122 ON attendance (date);

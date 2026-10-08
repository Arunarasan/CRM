-- Fingerprint-machine attendance + field-punch approval (foundations).
--
-- Office staff punch on a wall fingerprint machine (ZKTeco/eSSL, ADMS push protocol). The machine
-- identifies the finger itself and pushes "machine PIN X punched at T" to the CRM; fingerprints never
-- leave the machine. Field staff punch on their own phone and an admin approves it.
--
-- New attendance method on employees.attendance_method: MACHINE (machine punches are verified;
-- own-phone punches always need approval). No DDL needed for that — the column is a VARCHAR.

-- 1) Registered machines. A machine is identified by its serial number (SN) in every ADMS request;
--    only registered + active machines are accepted.
CREATE TABLE attendance_machines (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    serial_number       VARCHAR(64)   NOT NULL,
    name                VARCHAR(150)  NOT NULL,
    office_location_id  BIGINT        NULL,
    time_zone           VARCHAR(64)   NOT NULL DEFAULT 'Asia/Kolkata',
    active              BIT           NOT NULL DEFAULT 1,
    use_in_out_keys     BIT           NOT NULL DEFAULT 0,
    allowed_ip          VARCHAR(64)   NULL,
    model               VARCHAR(100)  NULL,
    push_version        VARCHAR(30)   NULL,
    last_seen_at        DATETIME      NULL,
    last_ip             VARCHAR(64)   NULL,
    last_punch_at       DATETIME      NULL,
    offline_alerted     BIT           NOT NULL DEFAULT 0,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT uq_att_machine_sn UNIQUE (serial_number),
    CONSTRAINT fk_att_machine_location FOREIGN KEY (office_location_id) REFERENCES attendance_locations(id)
);

-- 2) Unknown machines that tried to connect, so HR can add them with one click.
CREATE TABLE attendance_machine_requests (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    serial_number   VARCHAR(64)  NOT NULL,
    last_ip         VARCHAR(64)  NULL,
    push_version    VARCHAR(30)  NULL,
    attempts        INT          NOT NULL DEFAULT 1,
    first_seen_at   DATETIME     NULL,
    last_seen_at    DATETIME     NULL,
    dismissed       BIT          NOT NULL DEFAULT 0,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT uq_att_machine_req_sn UNIQUE (serial_number)
);

-- 3) Raw punch log, append-only. Machines resend logs they think weren't acknowledged, so
--    (machine, pin, time) is unique and a resend is silently ignored.
--    result: PENDING (not processed yet) | USED | DUPLICATE_TAP | UNMATCHED | AFTER_CORRECTION | IGNORED
CREATE TABLE machine_punches (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    machine_id      BIGINT        NOT NULL,
    machine_pin     VARCHAR(20)   NOT NULL,
    punch_time      DATETIME      NOT NULL,
    employee_id     BIGINT        NULL,
    status_code     INT           NULL,
    verify_code     INT           NULL,
    work_code       VARCHAR(20)   NULL,
    raw_line        VARCHAR(255)  NULL,
    received_at     DATETIME      NULL,
    result          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    session_id      BIGINT        NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT uq_machine_punch UNIQUE (machine_id, machine_pin, punch_time),
    CONSTRAINT fk_machine_punch_machine  FOREIGN KEY (machine_id)  REFERENCES attendance_machines(id),
    CONSTRAINT fk_machine_punch_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_machine_punch_session  FOREIGN KEY (session_id)  REFERENCES attendance_sessions(id),
    INDEX idx_machine_punch_emp_time (employee_id, punch_time),
    INDEX idx_machine_punch_pin (machine_pin),
    INDEX idx_machine_punch_result (result)
);

-- 4) The ID typed into the machine for this employee (digits). Unique when set.
ALTER TABLE employees ADD COLUMN machine_pin VARCHAR(20) NULL;
ALTER TABLE employees ADD CONSTRAINT uq_employee_machine_pin UNIQUE (machine_pin);

-- 5) Where each half of a session came from, plus clock-out evidence for field punches.
--    source: PHONE (portal, the default for existing rows) | MACHINE | MANUAL (HR correction)
ALTER TABLE attendance_sessions ADD COLUMN check_in_source      VARCHAR(20)   NOT NULL DEFAULT 'PHONE';
ALTER TABLE attendance_sessions ADD COLUMN check_out_source     VARCHAR(20)   NULL;
ALTER TABLE attendance_sessions ADD COLUMN machine_id           BIGINT        NULL;
ALTER TABLE attendance_sessions ADD COLUMN check_out_lat        DECIMAL(10,6) NULL;
ALTER TABLE attendance_sessions ADD COLUMN check_out_lng        DECIMAL(10,6) NULL;
ALTER TABLE attendance_sessions ADD COLUMN check_out_accuracy   INT           NULL;
ALTER TABLE attendance_sessions ADD COLUMN field_note           VARCHAR(255)  NULL;
-- Reason an admin gave when rejecting (shown to the employee).
ALTER TABLE attendance_sessions ADD COLUMN approval_note        VARCHAR(255)  NULL;

ALTER TABLE attendance_sessions
    ADD CONSTRAINT fk_att_session_machine FOREIGN KEY (machine_id) REFERENCES attendance_machines(id);

-- Sessions created by an HR time-correction were never tagged; mark the obvious ones.
UPDATE attendance_sessions SET check_in_source = 'MANUAL' WHERE verification_method = 'MANUAL';

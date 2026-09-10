-- Attendance regularization: employees request a correction to a day's clock times (came early but
-- clocked in late, forgot to clock out, or worked a day with no punch at all); an admin approves and
-- the session times are rewritten so worked-hours/earnings recompute from them. Original values are
-- captured for audit. Admins can also edit/add times directly (no request needed) — those don't
-- create a row here.

CREATE TABLE attendance_correction_requests (
    id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id            BIGINT       NOT NULL,
    attendance_session_id  BIGINT       NULL,          -- the session to fix; NULL when adding a missed day
    correction_date        DATE         NOT NULL,
    type                   VARCHAR(20)  NOT NULL,       -- FIX_IN | FIX_OUT | ADD_DAY
    requested_check_in     TIME         NULL,
    requested_check_out    TIME         NULL,
    original_check_in      TIME         NULL,           -- snapshot of the session's times at request/approve
    original_check_out     TIME         NULL,
    reason                 VARCHAR(500) NULL,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
    reviewed_by            VARCHAR(255) NULL,
    reviewed_at            DATETIME     NULL,
    review_remarks         VARCHAR(500) NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_att_corr_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_att_corr_session  FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id),
    INDEX idx_att_corr_employee (employee_id),
    INDEX idx_att_corr_status (status)
);

-- Call recordings → follow-up tasks → leads.
--
-- An admin uploads phone-call recordings on Tasks & Workforce → "Call Recordings". Each file becomes
-- one row here with the caller's number, the call date/time and the length (read from the file name
-- and the audio itself, editable). From a row the admin raises a "Call follow-up" task for an
-- employee (tasks.source = 'CALL_RECORDING', linked back through task_id). The task carries the
-- lead form: creating the lead (or adding the call to an existing lead, or closing it as "not a
-- lead") records the outcome here and completes the task.

CREATE TABLE call_recordings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NULL,
    duration_sec INT NULL,
    phone_number VARCHAR(30) NULL,
    called_at DATETIME NULL,
    direction VARCHAR(10) NULL,             -- IN | OUT, when the file name says so
    contact_name VARCHAR(150) NULL,
    note VARCHAR(1000) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW', -- NEW | TASK_CREATED | DONE | DISCARDED
    task_id BIGINT NULL,
    matched_lead_id BIGINT NULL,            -- an existing lead on the same number, found at upload
    outcome VARCHAR(20) NULL,               -- LEAD_CREATED | ADDED_TO_LEAD | NOT_A_LEAD
    outcome_reason VARCHAR(500) NULL,
    lead_id BIGINT NULL,                    -- the lead this call ended up on
    outcome_by_id BIGINT NULL,
    outcome_at DATETIME NULL,
    uploaded_by_id BIGINT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    INDEX idx_call_rec_status (status),
    INDEX idx_call_rec_phone (phone_number),
    INDEX idx_call_rec_task (task_id)
);

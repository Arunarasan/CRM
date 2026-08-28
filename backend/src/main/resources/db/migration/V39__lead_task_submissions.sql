-- Structured data captured when an employee completes a lead-workflow task (the "Task Data" log
-- behind the lead page). Common fields are typed columns; task-specific fields live in data_json.
-- The submission is also applied to native lead records at submit time (LeadTaskFormService).

CREATE TABLE lead_task_submissions (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    created_at         DATETIME(6),
    updated_at         DATETIME(6),
    created_by         VARCHAR(255),
    updated_by         VARCHAR(255),
    version            BIGINT       NOT NULL DEFAULT 0,
    deleted_by         VARCHAR(255),
    deleted_at         DATETIME(6),
    is_deleted         BIT(1)       NOT NULL DEFAULT b'0',

    task_id            BIGINT       NOT NULL,
    lead_id            BIGINT       NOT NULL,
    form_type          VARCHAR(40)  NOT NULL,
    task_name          VARCHAR(200),
    outcome            VARCHAR(120),
    notes              TEXT,
    next_follow_up_date DATE,
    media_json         TEXT,
    data_json          TEXT,
    submitted_by_id    BIGINT,
    submitted_by_name  VARCHAR(150),
    submitted_at       DATETIME(6),

    PRIMARY KEY (id),
    KEY idx_lts_lead (lead_id),
    KEY idx_lts_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

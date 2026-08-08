-- Smart Employee Auto Assignment.
-- Two additive tables:
--   assignment_settings  — singleton manager-configurable tuning (weights, caps, toggles).
--   assignment_history    — immutable audit of every assign / auto-assign / replacement event.
-- No existing table is touched; the recommendation engine reads existing HR/task/attendance data.

CREATE TABLE assignment_settings (
    id                           BIGINT AUTO_INCREMENT PRIMARY KEY,
    max_tasks_per_day            INT           NOT NULL DEFAULT 5,
    max_working_hours            DECIMAL(5,2)  NOT NULL DEFAULT 8.00,
    max_overtime_hours           DECIMAL(5,2)  NOT NULL DEFAULT 3.00,
    auto_balance_enabled         BIT           NOT NULL DEFAULT 1,
    allow_overtime               BIT           NOT NULL DEFAULT 0,
    allow_low_priority_reassign  BIT           NOT NULL DEFAULT 0,
    min_suitability_score        INT           NOT NULL DEFAULT 40,
    mandatory_skill_matching     BIT           NOT NULL DEFAULT 1,
    prefer_same_project_team     BIT           NOT NULL DEFAULT 1,
    prefer_nearest               BIT           NOT NULL DEFAULT 0,
    min_performance_score        INT           NOT NULL DEFAULT 0,
    -- Suitability weights (percent, should sum to ~100; engine normalises regardless).
    weight_availability          INT           NOT NULL DEFAULT 30,
    weight_workload              INT           NOT NULL DEFAULT 25,
    weight_skills                INT           NOT NULL DEFAULT 20,
    weight_department            INT           NOT NULL DEFAULT 10,
    weight_performance           INT           NOT NULL DEFAULT 5,
    weight_location              INT           NOT NULL DEFAULT 5,
    weight_experience            INT           NOT NULL DEFAULT 5,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0
);

-- Seed the singleton settings row so the engine always has a config.
INSERT INTO assignment_settings (id) VALUES (1);

CREATE TABLE assignment_history (
    id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id               BIGINT       NULL,
    task_name             VARCHAR(255) NULL,
    project_id            BIGINT       NULL,
    project_name          VARCHAR(255) NULL,
    resource_type         VARCHAR(30)  NOT NULL DEFAULT 'EMPLOYEE',
    resource_id           BIGINT       NULL,
    employee_id           BIGINT       NULL,
    employee_name         VARCHAR(255) NULL,
    assigned_by_id        BIGINT       NULL,
    assigned_by_name      VARCHAR(255) NULL,
    assignment_method     VARCHAR(20)  NOT NULL DEFAULT 'MANUAL',  -- MANUAL, AUTO, REPLACEMENT
    suitability_score     DECIMAL(5,2) NULL,
    reason                TEXT         NULL,
    reassignment_reason   VARCHAR(255) NULL,
    replaced_history_id   BIGINT       NULL,
    status                VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, REPLACED, CANCELLED, COMPLETED
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_asnhist_task        FOREIGN KEY (task_id)        REFERENCES tasks(id),
    CONSTRAINT fk_asnhist_project     FOREIGN KEY (project_id)     REFERENCES projects(id),
    CONSTRAINT fk_asnhist_assigned_by FOREIGN KEY (assigned_by_id) REFERENCES users(id),
    INDEX idx_asnhist_task (task_id),
    INDEX idx_asnhist_resource (resource_type, resource_id),
    INDEX idx_asnhist_status (status),
    INDEX idx_asnhist_method (assignment_method)
);

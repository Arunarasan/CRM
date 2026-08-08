-- Daily Report: an employee's end-of-day work report (+ photo/video attachments).
-- Additive; self-service portal feature. employee_id keyed to users.id (assignment layer).

CREATE TABLE daily_reports (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id       BIGINT       NOT NULL,
    project_id        BIGINT       NULL,
    task_id           BIGINT       NULL,
    report_date       DATE         NOT NULL,
    todays_work       TEXT         NULL,
    hours_worked      DECIMAL(5,2) NULL,
    completed_work    TEXT         NULL,
    pending_work      TEXT         NULL,
    problems          TEXT         NULL,
    material_used     TEXT         NULL,
    material_required TEXT         NULL,
    remarks           TEXT         NULL,
    manager_comment   TEXT         NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'SUBMITTED',
    created_at        DATETIME     NULL,
    updated_at        DATETIME     NULL,
    created_by        VARCHAR(255) NULL,
    updated_by        VARCHAR(255) NULL,
    deleted_by        VARCHAR(255) NULL,
    deleted_at        DATETIME     NULL,
    is_deleted        BIT          NOT NULL DEFAULT 0,
    version           BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_dr_employee FOREIGN KEY (employee_id) REFERENCES users(id),
    CONSTRAINT fk_dr_project  FOREIGN KEY (project_id)  REFERENCES projects(id),
    CONSTRAINT fk_dr_task     FOREIGN KEY (task_id)     REFERENCES tasks(id),
    INDEX idx_dr_employee (employee_id),
    INDEX idx_dr_date (report_date)
);

CREATE TABLE daily_report_media (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id         BIGINT       NOT NULL,
    media_type        VARCHAR(20)  NOT NULL,
    file_url          VARCHAR(500) NOT NULL,
    caption           VARCHAR(255) NULL,
    created_at        DATETIME     NULL,
    updated_at        DATETIME     NULL,
    created_by        VARCHAR(255) NULL,
    updated_by        VARCHAR(255) NULL,
    deleted_by        VARCHAR(255) NULL,
    deleted_at        DATETIME     NULL,
    is_deleted        BIT          NOT NULL DEFAULT 0,
    version           BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_drm_report FOREIGN KEY (report_id) REFERENCES daily_reports(id),
    INDEX idx_drm_report (report_id)
);

-- Employee Task & Work Execution module: activates task_assignments as the real
-- one-task-multiple-employees mechanism and adds the mobile field-execution tables.
-- All additions are nullable (or default-backed) so no existing row is affected.

ALTER TABLE tasks ADD COLUMN completed_date DATE NULL;

ALTER TABLE task_assignments ADD COLUMN role VARCHAR(50) NULL;
ALTER TABLE task_assignments ADD COLUMN accepted_at DATETIME NULL;
ALTER TABLE task_assignments ADD COLUMN started_at DATETIME NULL;
ALTER TABLE task_assignments ADD COLUMN completed_at DATETIME NULL;

CREATE TABLE task_progress_updates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    employee_id BIGINT NOT NULL,
    progress_percent INT NULL,
    remarks TEXT NULL,
    time_spent_minutes INT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_tpu_task FOREIGN KEY (task_id) REFERENCES tasks(id),
    CONSTRAINT fk_tpu_employee FOREIGN KEY (employee_id) REFERENCES users(id),
    INDEX idx_tpu_task (task_id)
);

CREATE TABLE task_progress_media (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    progress_update_id BIGINT NOT NULL,
    media_type VARCHAR(20) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    caption VARCHAR(255) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_tpm_progress FOREIGN KEY (progress_update_id) REFERENCES task_progress_updates(id),
    INDEX idx_tpm_progress (progress_update_id)
);

CREATE TABLE task_issues (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    employee_id BIGINT NOT NULL,
    issue_type VARCHAR(50) NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    reported_at DATETIME NULL,
    resolved_at DATETIME NULL,
    resolution_remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_ti_task FOREIGN KEY (task_id) REFERENCES tasks(id),
    CONSTRAINT fk_ti_employee FOREIGN KEY (employee_id) REFERENCES users(id),
    INDEX idx_ti_task (task_id)
);

CREATE TABLE task_material_usage (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity_used DECIMAL(15,2) NOT NULL,
    unit VARCHAR(50) NULL,
    used_by_id BIGINT NOT NULL,
    used_at DATETIME NULL,
    remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_tmu_task FOREIGN KEY (task_id) REFERENCES tasks(id),
    CONSTRAINT fk_tmu_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_tmu_user FOREIGN KEY (used_by_id) REFERENCES users(id),
    INDEX idx_tmu_task (task_id)
);

CREATE TABLE task_checkins (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    employee_id BIGINT NOT NULL,
    check_in_time DATETIME NULL,
    check_out_time DATETIME NULL,
    check_in_latitude DECIMAL(10,7) NULL,
    check_in_longitude DECIMAL(10,7) NULL,
    check_out_latitude DECIMAL(10,7) NULL,
    check_out_longitude DECIMAL(10,7) NULL,
    location_label VARCHAR(255) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_tc_task FOREIGN KEY (task_id) REFERENCES tasks(id),
    CONSTRAINT fk_tc_employee FOREIGN KEY (employee_id) REFERENCES users(id),
    INDEX idx_tc_task (task_id)
);

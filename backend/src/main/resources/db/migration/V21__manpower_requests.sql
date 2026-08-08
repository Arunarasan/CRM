-- Manpower Request: field employees request additional workers for a project/task.
-- PENDING -> APPROVED / REJECTED -> ASSIGNED. Additive; self-service portal feature.

CREATE TABLE manpower_requests (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_number    VARCHAR(30)  NOT NULL UNIQUE,
    requested_by_id   BIGINT       NOT NULL,
    project_id        BIGINT       NULL,
    task_id           BIGINT       NULL,
    current_workers   INT          NULL,
    required_workers  INT          NOT NULL,
    skill_required    VARCHAR(150) NULL,
    reason            TEXT         NULL,
    priority          VARCHAR(20)  NULL,
    required_date     DATE         NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    approved_by_id    BIGINT       NULL,
    decided_at        DATETIME     NULL,
    remarks           TEXT         NULL,
    created_at        DATETIME     NULL,
    updated_at        DATETIME     NULL,
    created_by        VARCHAR(255) NULL,
    updated_by        VARCHAR(255) NULL,
    deleted_by        VARCHAR(255) NULL,
    deleted_at        DATETIME     NULL,
    is_deleted        BIT          NOT NULL DEFAULT 0,
    version           BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_mpr_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id),
    CONSTRAINT fk_mpr_project      FOREIGN KEY (project_id)      REFERENCES projects(id),
    CONSTRAINT fk_mpr_task         FOREIGN KEY (task_id)         REFERENCES tasks(id),
    CONSTRAINT fk_mpr_approved_by  FOREIGN KEY (approved_by_id)  REFERENCES users(id),
    INDEX idx_mpr_status (status),
    INDEX idx_mpr_requested_by (requested_by_id)
);

-- Agreed price reductions at project close-out (customer bargaining, compensation, round-off).
-- projects.agreed_reduction is the running total (cheap to query); project_adjustments is the audit trail.
ALTER TABLE projects ADD COLUMN agreed_reduction DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE TABLE project_adjustments (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id   BIGINT        NOT NULL,
    amount       DECIMAL(15,2) NOT NULL,
    reason_code  VARCHAR(30)   NOT NULL,                     -- BARGAINING | COMPENSATION | ROUND_OFF | OTHER
    reason       VARCHAR(1000) NULL,
    pending_before DECIMAL(15,2) NULL,
    created_by_id BIGINT       NULL,
    created_at   DATETIME      NULL,
    updated_at   DATETIME      NULL,
    created_by   VARCHAR(255)  NULL,
    updated_by   VARCHAR(255)  NULL,
    deleted_by   VARCHAR(255)  NULL,
    deleted_at   DATETIME      NULL,
    is_deleted   BIT           NOT NULL DEFAULT 0,
    version      BIGINT        NULL DEFAULT 0,
    CONSTRAINT fk_padj_project FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX idx_padj_project (project_id)
);

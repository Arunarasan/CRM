-- A field employee asks to cancel the work behind a task (customer cancelled / other issue).
-- Admin approval marks the lead LOST, cancels the project, or cancels the task itself.
CREATE TABLE task_cancel_requests (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id       BIGINT       NOT NULL,
    requester_id  BIGINT       NOT NULL,
    target_type   VARCHAR(10)  NOT NULL,                      -- LEAD | PROJECT | TASK
    lead_id       BIGINT       NULL,
    project_id    BIGINT       NULL,
    reason_code   VARCHAR(30)  NOT NULL,                      -- CUSTOMER_CANCELLED | OTHER_ISSUE
    reason        VARCHAR(1000) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',    -- PENDING | APPROVED | REJECTED
    decided_by_id BIGINT       NULL,
    decided_at    DATETIME     NULL,
    decision_note VARCHAR(500) NULL,
    created_at    DATETIME     NULL,
    updated_at    DATETIME     NULL,
    created_by    VARCHAR(255) NULL,
    updated_by    VARCHAR(255) NULL,
    deleted_by    VARCHAR(255) NULL,
    deleted_at    DATETIME     NULL,
    is_deleted    BIT          NOT NULL DEFAULT 0,
    version       BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_tcr_task      FOREIGN KEY (task_id)       REFERENCES tasks(id),
    CONSTRAINT fk_tcr_requester FOREIGN KEY (requester_id)  REFERENCES users(id),
    CONSTRAINT fk_tcr_decider   FOREIGN KEY (decided_by_id) REFERENCES users(id),
    INDEX idx_tcr_status (status),
    INDEX idx_tcr_task (task_id, status)
);

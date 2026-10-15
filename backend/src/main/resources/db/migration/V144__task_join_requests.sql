-- An employee asks the holder of a task (or the project manager) to be added to it as a helper.
CREATE TABLE task_join_requests (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id      BIGINT       NOT NULL,
    requester_id BIGINT       NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',   -- PENDING | APPROVED | REJECTED | CANCELLED
    note         VARCHAR(500) NULL,
    decided_by_id BIGINT      NULL,
    decided_at   DATETIME     NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_tjr_task      FOREIGN KEY (task_id)       REFERENCES tasks(id),
    CONSTRAINT fk_tjr_requester FOREIGN KEY (requester_id)  REFERENCES users(id),
    CONSTRAINT fk_tjr_decider   FOREIGN KEY (decided_by_id) REFERENCES users(id),
    INDEX idx_tjr_task (task_id, status),
    INDEX idx_tjr_requester (requester_id, status)
);

-- Personal Reminders ("Task Management"): private employee-only work reminders.
-- Never assigned or shared; keyed to the owning user. Additive.

CREATE TABLE personal_reminders (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id      BIGINT       NOT NULL,
    title         VARCHAR(200) NOT NULL,
    notes         TEXT         NULL,
    due_date      DATE         NULL,
    priority      VARCHAR(20)  NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    completed_at  DATETIME     NULL,
    created_at    DATETIME     NULL,
    updated_at    DATETIME     NULL,
    created_by    VARCHAR(255) NULL,
    updated_by    VARCHAR(255) NULL,
    deleted_by    VARCHAR(255) NULL,
    deleted_at    DATETIME     NULL,
    is_deleted    BIT          NOT NULL DEFAULT 0,
    version       BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_pr_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    INDEX idx_pr_owner (owner_id),
    INDEX idx_pr_status (status)
);

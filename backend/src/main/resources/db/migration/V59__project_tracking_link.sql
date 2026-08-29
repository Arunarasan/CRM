-- Public, no-login project tracking page (Amazon/Flipkart-style order tracking).
--  * projects.share_token: unguessable per-project token; the public link is /track/{token}.
--    Anyone with the link sees a curated, customer-safe view — timeline, progress, current
--    activity — and can submit a request or leave a review, with no login.
--  * project_reviews: star + comment left from the public tracking page, moderated in the CRM.

ALTER TABLE projects
    ADD COLUMN share_token VARCHAR(64) NULL,
    ADD COLUMN tracking_enabled BIT(1) NOT NULL DEFAULT b'1';

-- Backfill a token for every existing project (UUID() is evaluated per-row in MySQL).
UPDATE projects SET share_token = REPLACE(UUID(), '-', '') WHERE share_token IS NULL;

ALTER TABLE projects
    ADD CONSTRAINT uq_project_share_token UNIQUE (share_token);

CREATE TABLE project_reviews (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    created_at  DATETIME(6),
    updated_at  DATETIME(6),
    created_by  VARCHAR(255),
    updated_by  VARCHAR(255),
    version     BIGINT       NOT NULL DEFAULT 0,
    deleted_by  VARCHAR(255),
    deleted_at  DATETIME(6),
    is_deleted  BIT(1)       NOT NULL DEFAULT b'0',

    project_id    BIGINT       NOT NULL,
    reviewer_name VARCHAR(150),
    rating        INT          NOT NULL,
    comment       TEXT,
    -- APPROVED (visible) | HIDDEN (moderated out). New reviews default to APPROVED.
    status        VARCHAR(20)  NOT NULL DEFAULT 'APPROVED',

    PRIMARY KEY (id),
    CONSTRAINT fk_project_review_project FOREIGN KEY (project_id) REFERENCES projects (id),
    INDEX idx_project_review_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Replay protection for writes that a phone queued while offline and re-sent later.
-- One row per (user, Idempotency-Key): IN_PROGRESS while the first attempt runs, DONE once it
-- succeeded (the response is kept so a retry gets the original answer instead of a duplicate record).
CREATE TABLE idempotency_keys (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    owner           VARCHAR(255) NOT NULL,
    idem_key        VARCHAR(64)  NOT NULL,
    http_method     VARCHAR(8)   NOT NULL,
    path            VARCHAR(255) NOT NULL,
    state           VARCHAR(12)  NOT NULL,
    response_status INT          NULL,
    content_type    VARCHAR(100) NULL,
    response_body   MEDIUMTEXT   NULL,
    created_at      DATETIME(3)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_idempotency_owner_key (owner, idem_key),
    KEY idx_idempotency_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

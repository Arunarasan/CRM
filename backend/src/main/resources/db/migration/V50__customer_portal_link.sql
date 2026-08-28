-- Phase 5 — Customer Portal foundation: link a login User to one or more Customer records.
-- Forward-compatible with multi-user-per-company (one company/customer may have several logins,
-- each with a portal role). The ROLE_CUSTOMER role and WEBSITE_CONTENT_MANAGE permission are
-- seeded idempotently in DataSeeder (reference data), consistent with the other roles.

CREATE TABLE customer_user (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    created_at   DATETIME(6),
    updated_at   DATETIME(6),
    created_by   VARCHAR(255),
    updated_by   VARCHAR(255),
    version      BIGINT      NOT NULL DEFAULT 0,
    deleted_by   VARCHAR(255),
    deleted_at   DATETIME(6),
    is_deleted   BIT(1)      NOT NULL DEFAULT b'0',

    user_id      BIGINT      NOT NULL,
    customer_id  BIGINT      NOT NULL,
    portal_role  VARCHAR(20) NOT NULL DEFAULT 'OWNER',   -- OWNER | MEMBER
    is_primary   BIT(1)      NOT NULL DEFAULT b'1',

    PRIMARY KEY (id),
    CONSTRAINT uq_customer_user UNIQUE (user_id, customer_id),
    CONSTRAINT fk_cu_user     FOREIGN KEY (user_id)     REFERENCES users (id),
    CONSTRAINT fk_cu_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    INDEX idx_cu_user (user_id),
    INDEX idx_cu_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

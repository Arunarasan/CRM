-- Portal governance + service reviews.
--  * customer_user.suspended: admin can suspend one client's portal without deleting their login.
--  * service_reviews: customers rate/review the service catalog from the portal; admin moderates.
-- (The global portal on/off switch is a `portal.enabled` row in site_settings, seeded by DataSeeder.)

ALTER TABLE customer_user
    ADD COLUMN suspended BIT(1) NOT NULL DEFAULT b'0';

CREATE TABLE service_reviews (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    created_at  DATETIME(6),
    updated_at  DATETIME(6),
    created_by  VARCHAR(255),
    updated_by  VARCHAR(255),
    version     BIGINT       NOT NULL DEFAULT 0,
    deleted_by  VARCHAR(255),
    deleted_at  DATETIME(6),
    is_deleted  BIT(1)       NOT NULL DEFAULT b'0',

    service_id  BIGINT       NOT NULL,
    customer_id BIGINT       NOT NULL,
    rating      INT          NOT NULL,
    comment     TEXT,
    -- APPROVED (visible) | HIDDEN (moderated out). New reviews default to APPROVED.
    status      VARCHAR(20)  NOT NULL DEFAULT 'APPROVED',

    PRIMARY KEY (id),
    CONSTRAINT fk_review_service  FOREIGN KEY (service_id)  REFERENCES services (id),
    CONSTRAINT fk_review_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT uq_service_review  UNIQUE (service_id, customer_id),
    INDEX idx_review_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

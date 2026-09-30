-- Per-employee QR review capture + Google review funnel.
--  * employees.review_token: unguessable per-employee token. The QR encodes the public
--    website URL /r/{token}. A customer scans it, rates + writes a message (captured here,
--    tied to the employee), and is then redirected to the company's Google review page.
--  * employee_reviews: the captured rating + message, tracked on the employee's profile,
--    moderated in the CRM (APPROVED / HIDDEN) like project and service reviews.
--  * site_settings 'google_review_url': the Google Business review link everyone is sent to.

ALTER TABLE employees
    ADD COLUMN review_token VARCHAR(64) NULL;

-- Backfill a token for every existing employee (UUID() is evaluated per-row in MySQL).
UPDATE employees SET review_token = REPLACE(UUID(), '-', '') WHERE review_token IS NULL;

ALTER TABLE employees
    ADD CONSTRAINT uq_employee_review_token UNIQUE (review_token);

CREATE TABLE employee_reviews (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    created_at     DATETIME(6),
    updated_at     DATETIME(6),
    created_by     VARCHAR(255),
    updated_by     VARCHAR(255),
    version        BIGINT       NOT NULL DEFAULT 0,
    deleted_by     VARCHAR(255),
    deleted_at     DATETIME(6),
    is_deleted     BIT(1)       NOT NULL DEFAULT b'0',

    employee_id     BIGINT       NOT NULL,
    reviewer_name   VARCHAR(150),
    reviewer_phone  VARCHAR(30),
    rating          INT          NOT NULL,
    comment         TEXT,
    -- Whether the customer went on to the Google review page after submitting.
    redirected_to_google BIT(1)  NOT NULL DEFAULT b'0',
    -- APPROVED (visible) | HIDDEN (moderated out). New reviews default to APPROVED.
    status          VARCHAR(20)  NOT NULL DEFAULT 'APPROVED',

    PRIMARY KEY (id),
    CONSTRAINT fk_employee_review_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    INDEX idx_employee_review_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed the Google review URL setting so it appears in the CRM Website › Settings form.
INSERT INTO site_settings (setting_key, setting_value, group_name, label, input_type, display_order, is_deleted, version)
SELECT 'google_review_url', '', 'General', 'Google Review Link', 'text', 90, b'0', 0
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'google_review_url');

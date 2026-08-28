-- Phase 5 — Customer service requests + notifications. A service request raised in the portal
-- becomes a CRM Task (wired in Phase 7); task_id links back once created. Notifications are the
-- customer-facing feed (quotation ready, payment received, request update, project completed…).

CREATE TABLE service_requests (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    created_at     DATETIME(6),
    updated_at     DATETIME(6),
    created_by     VARCHAR(255),
    updated_by     VARCHAR(255),
    version        BIGINT       NOT NULL DEFAULT 0,
    deleted_by     VARCHAR(255),
    deleted_at     DATETIME(6),
    is_deleted     BIT(1)       NOT NULL DEFAULT b'0',

    customer_id    BIGINT       NOT NULL,
    project_id     BIGINT,
    task_id        BIGINT,
    issue_type     VARCHAR(80),
    priority       VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    subject        VARCHAR(200) NOT NULL,
    description    TEXT,
    status         VARCHAR(30)  NOT NULL DEFAULT 'OPEN',
    preferred_date DATE,

    PRIMARY KEY (id),
    CONSTRAINT fk_sr_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT fk_sr_project  FOREIGN KEY (project_id)  REFERENCES projects (id),
    CONSTRAINT fk_sr_task     FOREIGN KEY (task_id)     REFERENCES tasks (id),
    INDEX idx_sr_customer (customer_id),
    INDEX idx_sr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE service_request_media (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    created_at         DATETIME(6),
    updated_at         DATETIME(6),
    created_by         VARCHAR(255),
    updated_by         VARCHAR(255),
    version            BIGINT       NOT NULL DEFAULT 0,
    deleted_by         VARCHAR(255),
    deleted_at         DATETIME(6),
    is_deleted         BIT(1)       NOT NULL DEFAULT b'0',

    service_request_id BIGINT       NOT NULL,
    url                VARCHAR(500) NOT NULL,
    media_type         VARCHAR(50),

    PRIMARY KEY (id),
    CONSTRAINT fk_srm_request FOREIGN KEY (service_request_id) REFERENCES service_requests (id),
    INDEX idx_srm_request (service_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_notifications (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    created_at  DATETIME(6),
    updated_at  DATETIME(6),
    created_by  VARCHAR(255),
    updated_by  VARCHAR(255),
    version     BIGINT       NOT NULL DEFAULT 0,
    deleted_by  VARCHAR(255),
    deleted_at  DATETIME(6),
    is_deleted  BIT(1)       NOT NULL DEFAULT b'0',

    customer_id BIGINT       NOT NULL,
    type        VARCHAR(50),
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    link        VARCHAR(300),
    read_at     DATETIME(6),

    PRIMARY KEY (id),
    CONSTRAINT fk_cn_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    INDEX idx_cn_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

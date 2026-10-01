-- Bundle tracking: a customer's material that needs work (stitching / making) after a sale is
-- tracked as one or more physical BUNDLES. Each bundle carries a printed sticker with a unique
-- code (e.g. JB-0042 or JB-0042-1); scanning or typing the code opens the bundle — its items,
-- the work specs, the current status and the full history — and lets staff move it on:
--   RECEIVED -> CUTTING -> STITCHING -> QC_CHECK -> PACKED -> READY -> DELIVERED
-- (plus ON_HOLD with a reason, and CANCELLED when the bill is cancelled).
--  * bundles:        one row per physical bundle (sticker).
--  * bundle_items:   the bill lines inside the bundle + their work spec (JSON text).
--  * bundle_events:  the status history (who moved it, when, note/photo).

CREATE TABLE bundles (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    created_at     DATETIME(6),
    updated_at     DATETIME(6),
    created_by     VARCHAR(255),
    updated_by     VARCHAR(255),
    version        BIGINT       NOT NULL DEFAULT 0,
    deleted_by     VARCHAR(255),
    deleted_at     DATETIME(6),
    is_deleted     BIT(1)       NOT NULL DEFAULT b'0',

    code            VARCHAR(40)  NOT NULL,
    -- Shared by every bundle of the same order (JB-0042 for JB-0042-1 / JB-0042-2).
    group_code      VARCHAR(40)  NOT NULL,
    invoice_id      BIGINT       NULL,
    customer_id     BIGINT       NULL,
    bundle_no       INT          NOT NULL DEFAULT 1,
    bundle_total    INT          NOT NULL DEFAULT 1,
    status          VARCHAR(20)  NOT NULL DEFAULT 'RECEIVED',
    -- Status to resume to when an ON_HOLD bundle is released.
    held_from_status VARCHAR(20) NULL,
    hold_reason     VARCHAR(500) NULL,
    work_type       VARCHAR(30)  NOT NULL DEFAULT 'STITCHING',
    -- Assigned tailor / maker: polymorphic EMPLOYEE (users.id) | CONTRACTOR (contractors.id).
    resource_type   VARCHAR(20)  NULL,
    resource_id     BIGINT       NULL,
    task_id         BIGINT       NULL,
    due_date        DATE         NULL,
    priority        VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM',
    handover_mode   VARCHAR(20)  NOT NULL DEFAULT 'PICKUP',
    rack_location   VARCHAR(100) NULL,
    notes           TEXT         NULL,
    packed_at       DATETIME(6)  NULL,
    delivered_at    DATETIME(6)  NULL,
    delivered_to    VARCHAR(150) NULL,

    PRIMARY KEY (id),
    CONSTRAINT uq_bundle_code UNIQUE (code),
    CONSTRAINT fk_bundle_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id),
    CONSTRAINT fk_bundle_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    INDEX idx_bundle_group (group_code),
    INDEX idx_bundle_invoice (invoice_id),
    INDEX idx_bundle_status (status),
    INDEX idx_bundle_due (due_date),
    INDEX idx_bundle_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bundle_items (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    created_at     DATETIME(6),
    updated_at     DATETIME(6),
    created_by     VARCHAR(255),
    updated_by     VARCHAR(255),
    version        BIGINT       NOT NULL DEFAULT 0,
    deleted_by     VARCHAR(255),
    deleted_at     DATETIME(6),
    is_deleted     BIT(1)       NOT NULL DEFAULT b'0',

    bundle_id        BIGINT       NOT NULL,
    invoice_item_id  BIGINT       NULL,
    product_id       BIGINT       NULL,
    description      VARCHAR(500) NOT NULL,
    quantity         DECIMAL(12,2) NOT NULL DEFAULT 1,
    unit             VARCHAR(30)  NULL,
    -- Free-form JSON: {"type":"Curtain","width":..,"height":..,"pleat":..,"lining":..,...}
    work_spec        TEXT         NULL,
    notes            TEXT         NULL,
    -- JSON array of uploaded reference photo URLs.
    photo_urls       TEXT         NULL,
    is_done          BIT(1)       NOT NULL DEFAULT b'0',

    PRIMARY KEY (id),
    CONSTRAINT fk_bundle_item_bundle FOREIGN KEY (bundle_id) REFERENCES bundles (id),
    INDEX idx_bundle_item_bundle (bundle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bundle_events (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    created_at     DATETIME(6),
    updated_at     DATETIME(6),
    created_by     VARCHAR(255),
    updated_by     VARCHAR(255),
    version        BIGINT       NOT NULL DEFAULT 0,
    deleted_by     VARCHAR(255),
    deleted_at     DATETIME(6),
    is_deleted     BIT(1)       NOT NULL DEFAULT b'0',

    bundle_id      BIGINT       NOT NULL,
    from_status    VARCHAR(20)  NULL,
    to_status      VARCHAR(20)  NOT NULL,
    user_id        BIGINT       NULL,
    user_name      VARCHAR(150) NULL,
    note           VARCHAR(1000) NULL,
    photo_url      VARCHAR(1000) NULL,

    PRIMARY KEY (id),
    CONSTRAINT fk_bundle_event_bundle FOREIGN KEY (bundle_id) REFERENCES bundles (id),
    INDEX idx_bundle_event_bundle (bundle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

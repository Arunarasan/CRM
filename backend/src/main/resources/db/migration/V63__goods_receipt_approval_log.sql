-- Goods-receipt approval log: an append-only audit row written every time a GRN is approved
-- (from the desktop order page OR the employee mobile portal). Denormalised so the admin log view
-- reads with no joins and survives later edits/deletes of the source PO/GRN.

CREATE TABLE goods_receipt_approval_logs (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    grn_id              BIGINT       NULL,
    grn_number          VARCHAR(50)  NULL,
    purchase_order_id   BIGINT       NULL,
    po_number           VARCHAR(50)  NULL,
    supplier_name       VARCHAR(200) NULL,
    warehouse_name      VARCHAR(200) NULL,
    approved_by_id      BIGINT       NULL,
    approved_by_name    VARCHAR(150) NULL,
    approved_by_role    VARCHAR(80)  NULL,
    source              VARCHAR(20)  NULL,   -- PORTAL, DESKTOP
    items_summary       TEXT         NULL,
    total_accepted_qty  INT          NULL,
    qc_status           VARCHAR(20)  NULL,
    approved_at         DATETIME     NULL,
    created_at          DATETIME     NULL,
    updated_at          DATETIME     NULL,
    created_by          VARCHAR(255) NULL,
    updated_by          VARCHAR(255) NULL,
    deleted_by          VARCHAR(255) NULL,
    deleted_at          DATETIME     NULL,
    is_deleted          BIT          NOT NULL DEFAULT 0,
    version             BIGINT       NULL DEFAULT 0,
    INDEX idx_gral_approved_at (approved_at),
    INDEX idx_gral_approved_by (approved_by_id)
);

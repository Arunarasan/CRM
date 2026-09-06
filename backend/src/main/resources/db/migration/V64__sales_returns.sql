-- Sales / product returns: a customer brings goods back from a counter sale or invoice.
-- Restocks inventory and settles the money as either a credit note (store credit) or a cash refund.
-- Distinct from purchase_returns (goods sent back to a supplier).

CREATE TABLE sales_returns (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    return_number    VARCHAR(50)  NOT NULL UNIQUE,
    invoice_id       BIGINT       NULL,
    customer_id      BIGINT       NOT NULL,
    date             DATE         NOT NULL,
    reason           TEXT         NULL,
    sub_total        DECIMAL(15,2) NULL,
    gst_amount       DECIMAL(15,2) NULL,
    total_amount     DECIMAL(15,2) NULL,
    settlement_mode  VARCHAR(20)  NULL,   -- REFUND, CREDIT_NOTE
    refund_method    VARCHAR(50)  NULL,   -- CASH/UPI/... when settlement_mode = REFUND
    restocked        BIT          NOT NULL DEFAULT 1,
    warehouse_id     BIGINT       NULL,
    note_id          BIGINT       NULL,   -- linked credit note
    refund_id        BIGINT       NULL,   -- linked refund payout (REFUND mode)
    status           VARCHAR(20)  NOT NULL DEFAULT 'COMPLETED',
    created_at       DATETIME     NULL,
    updated_at       DATETIME     NULL,
    created_by       VARCHAR(255) NULL,
    updated_by       VARCHAR(255) NULL,
    deleted_by       VARCHAR(255) NULL,
    deleted_at       DATETIME     NULL,
    is_deleted       BIT          NOT NULL DEFAULT 0,
    version          BIGINT       NULL DEFAULT 0,
    INDEX idx_sret_customer (customer_id),
    INDEX idx_sret_invoice (invoice_id)
);

CREATE TABLE sales_return_items (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    sales_return_id  BIGINT       NOT NULL,
    invoice_item_id  BIGINT       NULL,
    product_id       BIGINT       NULL,
    description      VARCHAR(255) NULL,
    hsn_code         VARCHAR(20)  NULL,
    quantity         INT          NOT NULL,
    unit_price       DECIMAL(15,2) NOT NULL,
    gst_rate         DECIMAL(5,2) NULL,
    line_total       DECIMAL(15,2) NOT NULL,
    created_at       DATETIME     NULL,
    updated_at       DATETIME     NULL,
    created_by       VARCHAR(255) NULL,
    updated_by       VARCHAR(255) NULL,
    deleted_by       VARCHAR(255) NULL,
    deleted_at       DATETIME     NULL,
    is_deleted       BIT          NOT NULL DEFAULT 0,
    version          BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_sri_return FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id),
    INDEX idx_sri_return (sales_return_id),
    INDEX idx_sri_invoice_item (invoice_item_id)
);

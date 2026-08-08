-- Enterprise Inventory Management phase 2: system-generated purchase requests
-- (low-stock trigger, separate from the manual PurchaseOrder flow). Additive only.

CREATE TABLE purchase_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_number VARCHAR(30) NOT NULL UNIQUE,
    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    supplier_id BIGINT NULL,
    quantity INT NOT NULL,
    reorder_level_snapshot INT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    triggered_by VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    converted_purchase_order_id BIGINT NULL,
    notes TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_pr_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_pr_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_pr_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_pr_po FOREIGN KEY (converted_purchase_order_id) REFERENCES purchase_orders(id),
    INDEX idx_pr_status (status),
    INDEX idx_pr_product (product_id)
);

-- Shipments against a purchase order. A supplier can send one PO in several deliveries, each with
-- its own shipping/tracking ID; the goods-received report for a delivery is matched by that ID.
CREATE TABLE purchase_order_shipments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id BIGINT NOT NULL,
    shipping_id VARCHAR(100) NOT NULL,
    transporter_name VARCHAR(150) NULL,
    dispatch_date DATE NULL,
    notes TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_TRANSIT', -- IN_TRANSIT, RECEIVED
    grn_id BIGINT NULL,
    received_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_po_shipment_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
    CONSTRAINT fk_po_shipment_grn FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes (id)
);
CREATE INDEX idx_po_shipment_shipping_id ON purchase_order_shipments (shipping_id);
CREATE INDEX idx_po_shipment_po ON purchase_order_shipments (purchase_order_id);

-- Which shipment a goods-received report verified (copied as text so it reads without a join).
ALTER TABLE goods_receipt_notes
    ADD COLUMN shipping_id VARCHAR(100) NULL;
CREATE INDEX idx_grn_shipping_id ON goods_receipt_notes (shipping_id);

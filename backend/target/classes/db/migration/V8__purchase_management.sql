-- Enterprise Purchase Management module: full procurement lifecycle from purchase request
-- to supplier payment. Extends the existing purchase skeleton (suppliers, purchase_orders,
-- goods_receipt_notes, purchase_bills, purchase_payments, purchase_requests) additively —
-- new columns are nullable/default-backed and the two MODIFYs only relax NOT NULL, so every
-- existing row and code path keeps working.

-- ---------------------------------------------------------------------------
-- Supplier profile: statutory, banking and commercial terms
-- ---------------------------------------------------------------------------
ALTER TABLE suppliers ADD COLUMN gstin VARCHAR(20) NULL;
ALTER TABLE suppliers ADD COLUMN pan VARCHAR(20) NULL;
ALTER TABLE suppliers ADD COLUMN bank_name VARCHAR(100) NULL;
ALTER TABLE suppliers ADD COLUMN bank_account_number VARCHAR(50) NULL;
ALTER TABLE suppliers ADD COLUMN bank_ifsc VARCHAR(20) NULL;
ALTER TABLE suppliers ADD COLUMN credit_limit DECIMAL(15,2) NULL;
ALTER TABLE suppliers ADD COLUMN payment_terms VARCHAR(100) NULL;
ALTER TABLE suppliers ADD COLUMN lead_time_days INT NULL;
ALTER TABLE suppliers ADD COLUMN city VARCHAR(100) NULL;
ALTER TABLE suppliers ADD COLUMN state VARCHAR(100) NULL;
ALTER TABLE suppliers ADD COLUMN pincode VARCHAR(10) NULL;
ALTER TABLE suppliers ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- ---------------------------------------------------------------------------
-- Purchase requests: from single-product low-stock queue to full multi-line PR
-- with requester, project/BOQ context, priority and multi-level approval.
-- Legacy system-generated rows keep using the header product/warehouse/quantity.
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_requests MODIFY product_id BIGINT NULL;
ALTER TABLE purchase_requests MODIFY warehouse_id BIGINT NULL;
ALTER TABLE purchase_requests MODIFY quantity INT NULL;
ALTER TABLE purchase_requests ADD COLUMN project_id BIGINT NULL;
ALTER TABLE purchase_requests ADD CONSTRAINT fk_pr_project FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE purchase_requests ADD COLUMN boq_id BIGINT NULL;
ALTER TABLE purchase_requests ADD CONSTRAINT fk_pr_boq FOREIGN KEY (boq_id) REFERENCES boqs(id);
ALTER TABLE purchase_requests ADD COLUMN requested_by_id BIGINT NULL;
ALTER TABLE purchase_requests ADD CONSTRAINT fk_pr_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id);
ALTER TABLE purchase_requests ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE purchase_requests ADD COLUMN required_date DATE NULL;
ALTER TABLE purchase_requests ADD COLUMN reason TEXT NULL;
ALTER TABLE purchase_requests ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT 'INVENTORY';
ALTER TABLE purchase_requests ADD COLUMN approval_levels INT NOT NULL DEFAULT 1;
ALTER TABLE purchase_requests ADD COLUMN current_level INT NOT NULL DEFAULT 0;
ALTER TABLE purchase_requests ADD COLUMN approved_by_id BIGINT NULL;
ALTER TABLE purchase_requests ADD CONSTRAINT fk_pr_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id);
ALTER TABLE purchase_requests ADD COLUMN decided_at DATETIME NULL;
ALTER TABLE purchase_requests ADD COLUMN material_request_id BIGINT NULL;
ALTER TABLE purchase_requests ADD CONSTRAINT fk_pr_material_request FOREIGN KEY (material_request_id) REFERENCES material_requests(id);

CREATE TABLE purchase_request_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    purchase_request_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    estimated_unit_price DECIMAL(15,2) NULL,
    notes VARCHAR(255) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_pri_request FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id),
    CONSTRAINT fk_pri_product FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_pri_request (purchase_request_id)
);

CREATE TABLE purchase_request_approvals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    purchase_request_id BIGINT NOT NULL,
    level INT NOT NULL,
    approver_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    comments TEXT NULL,
    acted_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_pra_request FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id),
    CONSTRAINT fk_pra_approver FOREIGN KEY (approver_id) REFERENCES users(id),
    INDEX idx_pra_request (purchase_request_id)
);

-- ---------------------------------------------------------------------------
-- Purchase orders: commercial terms, delivery, and project/BOQ traceability
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_orders ADD COLUMN warehouse_id BIGINT NULL;
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE purchase_orders ADD COLUMN project_id BIGINT NULL;
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_project FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE purchase_orders ADD COLUMN boq_id BIGINT NULL;
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_boq FOREIGN KEY (boq_id) REFERENCES boqs(id);
ALTER TABLE purchase_orders ADD COLUMN phase_id BIGINT NULL;
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id);
ALTER TABLE purchase_orders ADD COLUMN room_id BIGINT NULL;
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_room FOREIGN KEY (room_id) REFERENCES project_rooms(id);
ALTER TABLE purchase_orders ADD COLUMN task_id BIGINT NULL;
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_task FOREIGN KEY (task_id) REFERENCES tasks(id);
ALTER TABLE purchase_orders ADD COLUMN purchase_request_id BIGINT NULL;
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_purchase_request FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id);
ALTER TABLE purchase_orders ADD COLUMN delivery_address TEXT NULL;
ALTER TABLE purchase_orders ADD COLUMN payment_terms VARCHAR(100) NULL;
ALTER TABLE purchase_orders ADD COLUMN subtotal DECIMAL(15,2) NULL;
ALTER TABLE purchase_orders ADD COLUMN tax_percent DECIMAL(5,2) NULL;
ALTER TABLE purchase_orders ADD COLUMN tax_amount DECIMAL(15,2) NULL;
ALTER TABLE purchase_orders ADD COLUMN discount_amount DECIMAL(15,2) NULL;
ALTER TABLE purchase_orders ADD COLUMN transportation_cost DECIMAL(15,2) NULL;
ALTER TABLE purchase_orders ADD COLUMN sent_at DATETIME NULL;
ALTER TABLE purchase_orders ADD COLUMN confirmed_at DATETIME NULL;
ALTER TABLE purchase_orders ADD INDEX idx_po_status (status);
ALTER TABLE purchase_orders ADD INDEX idx_po_expected_delivery (expected_delivery_date);

ALTER TABLE purchase_order_items ADD COLUMN returned_quantity INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Goods receipt: receiver, supplier references, quality check, damage, photos
-- ---------------------------------------------------------------------------
ALTER TABLE goods_receipt_notes ADD COLUMN received_by_id BIGINT NULL;
ALTER TABLE goods_receipt_notes ADD CONSTRAINT fk_grn_received_by FOREIGN KEY (received_by_id) REFERENCES users(id);
ALTER TABLE goods_receipt_notes ADD COLUMN supplier_invoice_number VARCHAR(50) NULL;
ALTER TABLE goods_receipt_notes ADD COLUMN vehicle_number VARCHAR(30) NULL;
ALTER TABLE goods_receipt_notes ADD COLUMN qc_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE goods_receipt_notes ADD COLUMN qc_reason TEXT NULL;
ALTER TABLE goods_receipt_notes ADD COLUMN qc_remarks TEXT NULL;

ALTER TABLE goods_receipt_note_items ADD COLUMN damaged_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE goods_receipt_note_items ADD COLUMN qc_status VARCHAR(20) NULL;
ALTER TABLE goods_receipt_note_items ADD COLUMN remarks VARCHAR(255) NULL;

CREATE TABLE grn_photos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    grn_id BIGINT NOT NULL,
    photo_url VARCHAR(500) NOT NULL,
    caption VARCHAR(255) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_grnp_grn FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id),
    INDEX idx_grnp_grn (grn_id)
);

-- ---------------------------------------------------------------------------
-- Purchase invoices (bills) and supplier payments (advance support)
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_bills ADD COLUMN tax_amount DECIMAL(15,2) NULL;
ALTER TABLE purchase_bills ADD COLUMN notes TEXT NULL;
ALTER TABLE purchase_bills ADD INDEX idx_pb_status (status);
ALTER TABLE purchase_bills ADD INDEX idx_pb_due_date (due_date);

ALTER TABLE purchase_payments MODIFY purchase_bill_id BIGINT NULL;
ALTER TABLE purchase_payments ADD COLUMN purchase_order_id BIGINT NULL;
ALTER TABLE purchase_payments ADD CONSTRAINT fk_pp_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
ALTER TABLE purchase_payments ADD COLUMN supplier_id BIGINT NULL;
ALTER TABLE purchase_payments ADD CONSTRAINT fk_pp_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
ALTER TABLE purchase_payments ADD COLUMN payment_type VARCHAR(20) NOT NULL DEFAULT 'PARTIAL';
ALTER TABLE purchase_payments ADD COLUMN notes TEXT NULL;

-- Backfill supplier on legacy payments from their bill for supplier-level outstanding math.
UPDATE purchase_payments pp
JOIN purchase_bills pb ON pp.purchase_bill_id = pb.id
SET pp.supplier_id = pb.supplier_id
WHERE pp.supplier_id IS NULL;

-- ---------------------------------------------------------------------------
-- Purchase returns (damaged / wrong / excess material back to supplier)
-- ---------------------------------------------------------------------------
CREATE TABLE purchase_returns (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    return_number VARCHAR(50) NOT NULL UNIQUE,
    purchase_order_id BIGINT NOT NULL,
    grn_id BIGINT NULL,
    supplier_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    reason_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    total_amount DECIMAL(15,2) NULL,
    notes TEXT NULL,
    confirmed_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_pret_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    CONSTRAINT fk_pret_grn FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id),
    CONSTRAINT fk_pret_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_pret_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    INDEX idx_pret_status (status)
);

CREATE TABLE purchase_return_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    purchase_return_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(15,2) NULL,
    total_price DECIMAL(15,2) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_preti_return FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id),
    CONSTRAINT fk_preti_product FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_preti_return (purchase_return_id)
);

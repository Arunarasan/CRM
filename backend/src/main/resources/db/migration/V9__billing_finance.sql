-- Enterprise Billing & Finance module. Extends the legacy billing skeleton
-- (invoices, invoice_items, customer_payments, credit_debit_notes, expenses) additively —
-- every new column is nullable or default-backed so the existing /api/billing paths keep working —
-- and adds payment schedules, customer ledger, project expenses and refunds.

-- ---------------------------------------------------------------------------
-- Customers: opening balance for ledger continuity (credit_limit already exists)
-- ---------------------------------------------------------------------------
ALTER TABLE customers ADD COLUMN opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Invoices: GST invoice fields, typing, discount, round-off, paid/balance tracking
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN invoice_type VARCHAR(30) NOT NULL DEFAULT 'PROGRESS';
ALTER TABLE invoices ADD COLUMN quotation_id BIGINT NULL;
ALTER TABLE invoices ADD CONSTRAINT fk_inv_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id);
ALTER TABLE invoices ADD COLUMN boq_id BIGINT NULL;
ALTER TABLE invoices ADD CONSTRAINT fk_inv_boq FOREIGN KEY (boq_id) REFERENCES boqs(id);
ALTER TABLE invoices ADD COLUMN payment_schedule_id BIGINT NULL;
ALTER TABLE invoices ADD COLUMN payment_stage VARCHAR(50) NULL;
ALTER TABLE invoices ADD COLUMN discount_type VARCHAR(20) NULL;
ALTER TABLE invoices ADD COLUMN discount_value DECIMAL(15,2) NULL;
ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN gst_type VARCHAR(10) NOT NULL DEFAULT 'CGST_SGST';
ALTER TABLE invoices ADD COLUMN cgst_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN sgst_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN igst_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN round_off DECIMAL(6,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN balance_due DECIMAL(15,2) NULL;
ALTER TABLE invoices ADD COLUMN retention_percent DECIMAL(5,2) NULL;
ALTER TABLE invoices ADD COLUMN retention_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN place_of_supply VARCHAR(100) NULL;
ALTER TABLE invoices ADD COLUMN sent_at DATETIME NULL;
ALTER TABLE invoices ADD COLUMN cancelled_reason TEXT NULL;
ALTER TABLE invoices ADD INDEX idx_inv_status (status);
ALTER TABLE invoices ADD INDEX idx_inv_due_date (due_date);
ALTER TABLE invoices ADD INDEX idx_inv_customer (customer_id);
ALTER TABLE invoices ADD INDEX idx_inv_project (project_id);

-- Legacy rows: balance = total - paid (both default 0-paid so balance = total)
UPDATE invoices SET balance_due = total_amount - amount_paid WHERE balance_due IS NULL;

ALTER TABLE invoice_items ADD COLUMN hsn_code VARCHAR(20) NULL;
ALTER TABLE invoice_items ADD COLUMN unit VARCHAR(30) NULL;

-- ---------------------------------------------------------------------------
-- Customer payments: project link, typing, stage, collection + approval workflow
-- ---------------------------------------------------------------------------
ALTER TABLE customer_payments ADD COLUMN project_id BIGINT NULL;
ALTER TABLE customer_payments ADD CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE customer_payments ADD COLUMN payment_type VARCHAR(20) NOT NULL DEFAULT 'PARTIAL';
ALTER TABLE customer_payments ADD COLUMN payment_stage VARCHAR(50) NULL;
ALTER TABLE customer_payments ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE customer_payments ADD COLUMN collected_by_id BIGINT NULL;
ALTER TABLE customer_payments ADD CONSTRAINT fk_cp_collected_by FOREIGN KEY (collected_by_id) REFERENCES users(id);
ALTER TABLE customer_payments ADD COLUMN proof_url VARCHAR(500) NULL;
ALTER TABLE customer_payments ADD COLUMN remarks TEXT NULL;
ALTER TABLE customer_payments ADD INDEX idx_cp_payment_date (payment_date);
ALTER TABLE customer_payments ADD INDEX idx_cp_customer (customer_id);

-- ---------------------------------------------------------------------------
-- Credit/debit notes: project traceability + lifecycle status
-- ---------------------------------------------------------------------------
ALTER TABLE credit_debit_notes ADD COLUMN project_id BIGINT NULL;
ALTER TABLE credit_debit_notes ADD CONSTRAINT fk_cdn_project FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE credit_debit_notes ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- ---------------------------------------------------------------------------
-- Contractor payments: project traceability so labour cost can roll up per project
-- ---------------------------------------------------------------------------
ALTER TABLE contractor_payments ADD COLUMN project_id BIGINT NULL;
ALTER TABLE contractor_payments ADD CONSTRAINT fk_ctp_project FOREIGN KEY (project_id) REFERENCES projects(id);

-- ---------------------------------------------------------------------------
-- Payment schedules: stage-wise / milestone payment plan for a project
-- ---------------------------------------------------------------------------
CREATE TABLE payment_schedules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    stage VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    percentage DECIMAL(5,2) NULL,
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    invoice_id BIGINT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_ps_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_ps_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    INDEX idx_ps_project (project_id),
    INDEX idx_ps_status (status)
);

ALTER TABLE invoices ADD CONSTRAINT fk_inv_schedule FOREIGN KEY (payment_schedule_id) REFERENCES payment_schedules(id);

-- ---------------------------------------------------------------------------
-- Customer ledger: one immutable row per financial event (invoice, payment, note,
-- refund, reversal). Running/closing balances are computed, never stored.
-- ---------------------------------------------------------------------------
CREATE TABLE customer_ledger_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    project_id BIGINT NULL,
    entry_date DATE NOT NULL,
    entry_type VARCHAR(30) NOT NULL,
    reference_type VARCHAR(30) NULL,
    reference_id BIGINT NULL,
    reference_number VARCHAR(50) NULL,
    description VARCHAR(500) NULL,
    debit DECIMAL(15,2) NOT NULL DEFAULT 0,
    credit DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cle_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_cle_project FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX idx_cle_customer_date (customer_id, entry_date),
    INDEX idx_cle_reference (reference_type, reference_id)
);

-- ---------------------------------------------------------------------------
-- Project expenses: manual entries plus auto-synced rows from purchase bills,
-- inventory consumption and contractor payments (source + reference keys make
-- the sync idempotent — one row per source document, updated in place).
-- ---------------------------------------------------------------------------
CREATE TABLE project_expenses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    category VARCHAR(30) NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    reference_type VARCHAR(30) NULL,
    reference_id BIGINT NULL,
    description VARCHAR(500) NULL,
    amount DECIMAL(15,2) NOT NULL,
    expense_date DATE NOT NULL,
    vendor VARCHAR(200) NULL,
    payment_method VARCHAR(50) NULL,
    recorded_by_id BIGINT NULL,
    notes TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_pe_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_pe_recorded_by FOREIGN KEY (recorded_by_id) REFERENCES users(id),
    INDEX idx_pe_project (project_id),
    INDEX idx_pe_category (category),
    INDEX idx_pe_reference (source, reference_id)
);

-- ---------------------------------------------------------------------------
-- Refunds: approval-gated money returned to a customer
-- ---------------------------------------------------------------------------
CREATE TABLE refunds (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    refund_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    invoice_id BIGINT NULL,
    project_id BIGINT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_by_id BIGINT NULL,
    approved_by_id BIGINT NULL,
    decided_at DATETIME NULL,
    refund_date DATE NULL,
    payment_method VARCHAR(50) NULL,
    reference_number VARCHAR(100) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_ref_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_ref_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    CONSTRAINT fk_ref_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_ref_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id),
    CONSTRAINT fk_ref_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id),
    INDEX idx_ref_status (status)
);

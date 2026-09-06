-- Post-completion Service & Warranty.
-- Once a project is COMPLETED, staff "activate" warranty cover on it (service/workmanship warranty
-- and product/material warranty, each with its own period). Later issues raised by the customer are
-- logged as service works (reusing the existing service_requests + Task bridge); each is marked FREE
-- (in-warranty goodwill) or PAID, and a PAID one can raise a real Billing invoice.

-- ---- Projects: separate service + product warranty cover, activated at handover ----
ALTER TABLE projects
    ADD COLUMN warranty_activated        BIT(1)   NOT NULL DEFAULT b'0',
    ADD COLUMN warranty_start_date       DATE,
    ADD COLUMN service_warranty_months   INT,
    ADD COLUMN product_warranty_months   INT,
    ADD COLUMN service_warranty_end_date DATE,
    ADD COLUMN product_warranty_end_date DATE,
    ADD COLUMN warranty_notes            TEXT;

-- ---- Service requests → service works: free/paid + optional billing link ----
ALTER TABLE service_requests
    ADD COLUMN charge_type      VARCHAR(20),   -- FREE | PAID (null until decided)
    ADD COLUMN warranty_type    VARCHAR(20),   -- SERVICE | PRODUCT | NONE (what it's claimed under)
    ADD COLUMN charge_amount    DECIMAL(15,2),
    ADD COLUMN invoice_id       BIGINT,        -- set once a PAID work raises a Billing invoice
    ADD COLUMN resolution_notes TEXT,
    ADD COLUMN origin           VARCHAR(20)    NOT NULL DEFAULT 'PORTAL'; -- PORTAL (customer) | STAFF

ALTER TABLE service_requests
    ADD CONSTRAINT fk_service_request_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id);

CREATE INDEX idx_service_request_project ON service_requests (project_id);

-- ---- Default warranty periods (months), surfaced on the admin Settings › Company tab ----
INSERT IGNORE INTO site_settings (setting_key, setting_value, group_name, label, input_type, display_order, version, is_deleted)
VALUES
    ('warranty.service_months', '6',  'Warranty', 'Default service warranty (months)', 'number', 90, 0, b'0'),
    ('warranty.product_months', '12', 'Warranty', 'Default product warranty (months)', 'number', 91, 0, b'0');

-- Field employee "Customer Agreed" → a request an admin approves before the project is created.
--
-- The employee records what the customer paid as advance (optional: amount, method, UPI/txn reference,
-- receipt photo) and sends the agreed quote for approval. Nothing is created yet. An admin / project
-- manager approves it on the lead's Quote step → the project is created and the advance becomes a
-- CONFIRMED customer payment (collected by the employee); or rejects it with a reason → the quote opens
-- again for the employee to fix and send again.

CREATE TABLE project_conversion_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    lead_id BIGINT NOT NULL,
    boq_id BIGINT NULL,                      -- the quote sheet the customer agreed to
    quotation_id BIGINT NULL,                -- its customer-approved quotation
    quote_total DECIMAL(15,2) NULL,          -- what the customer agreed to, at the time of the request
    advance_amount DECIMAL(15,2) NULL,
    payment_method VARCHAR(30) NULL,
    reference_number VARCHAR(100) NULL,
    proof_url VARCHAR(500) NULL,
    note VARCHAR(1000) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
    requested_by_id BIGINT NULL,
    decided_by_id BIGINT NULL,
    decided_at DATETIME NULL,
    decision_note VARCHAR(1000) NULL,
    project_id BIGINT NULL,                  -- the project created on approval
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    INDEX idx_pcr_lead (lead_id),
    INDEX idx_pcr_status (status)
);

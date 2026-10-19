-- Simple "order given to a contractor": a job on a project with an agreed amount.
-- Paid / balance / status are calculated from the payments linked to the order.
CREATE TABLE contractor_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contractor_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    order_date DATE NULL,
    notes TEXT NULL,
    -- ACTIVE or CANCELLED; payment status is derived, never stored
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cord_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
    CONSTRAINT fk_cord_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Every payment, either direction, can belong to one order (null = a general advance).
ALTER TABLE contractor_payments
    ADD COLUMN order_id BIGINT NULL,
    ADD CONSTRAINT fk_ctp_order FOREIGN KEY (order_id) REFERENCES contractor_orders(id);

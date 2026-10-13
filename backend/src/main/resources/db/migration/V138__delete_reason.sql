-- Reason captured when a lead, project or customer payment is deleted (soft delete).
ALTER TABLE leads ADD COLUMN delete_reason VARCHAR(500) NULL;
ALTER TABLE projects ADD COLUMN delete_reason VARCHAR(500) NULL;
ALTER TABLE customer_payments ADD COLUMN delete_reason VARCHAR(500) NULL;

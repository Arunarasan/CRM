-- The employee who runs a lead's quote: only they (and admins) may edit it, and their "Customer Agreed"
-- creates the project directly without admin approval.
ALTER TABLE leads
    ADD COLUMN lead_manager_id BIGINT NULL,
    ADD INDEX idx_leads_lead_manager (lead_manager_id),
    ADD CONSTRAINT fk_leads_lead_manager FOREIGN KEY (lead_manager_id) REFERENCES users(id);

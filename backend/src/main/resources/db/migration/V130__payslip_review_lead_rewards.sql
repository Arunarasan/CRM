-- Payslip shows QR-review rewards and qualified-lead pay as their own counted lines.
--  * leads.lead_reward_salary_record_id: the payslip that paid this lead (prevents paying twice).
--    0 = never paid by design (leads added before this feature).
--  * lead_collected_reward_amount: pay per qualified lead the employee collected (admin-editable).

ALTER TABLE leads ADD COLUMN lead_reward_salary_record_id BIGINT NULL;
CREATE INDEX idx_lead_reward_salary ON leads(lead_reward_salary_record_id);

-- Leads added before October 2026 are not back-paid.
UPDATE leads SET lead_reward_salary_record_id = 0 WHERE created_at < '2026-10-01';

-- Pay per qualified lead (shown in the CRM Website › Settings form, next to the review reward).
INSERT INTO site_settings (setting_key, setting_value, group_name, label, input_type, display_order, is_deleted, version)
SELECT 'lead_collected_reward_amount', '0', 'General', 'Pay per Qualified Lead Collected (₹)', 'text', 92, b'0', 0
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'lead_collected_reward_amount');

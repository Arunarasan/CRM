-- Cash collected on site, logged by an employee in their daily report.
-- A positive amount on a project report raises a PENDING_APPROVAL customer payment (linked below).
ALTER TABLE daily_reports ADD COLUMN cash_collected DECIMAL(15,2) NULL;
ALTER TABLE daily_reports ADD COLUMN cash_payment_method VARCHAR(50) NULL;
ALTER TABLE daily_reports ADD COLUMN cash_reference VARCHAR(100) NULL;
ALTER TABLE daily_reports ADD COLUMN cash_payment_id BIGINT NULL;

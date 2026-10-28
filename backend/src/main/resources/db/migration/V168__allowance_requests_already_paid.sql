-- Travel / food allowance requests, and "already paid" amounts shown on a payslip.
-- An allowance request, once approved, adds an earning to the payslip; when the money was already handed over
-- it is also recorded as already paid so the balance payable excludes it. All new columns are nullable or
-- default-backed, so existing rows stay valid.
ALTER TABLE payroll_requests
    ADD COLUMN allowance_type VARCHAR(20) NULL,
    ADD COLUMN request_date DATE NULL,
    ADD COLUMN already_paid BIT NOT NULL DEFAULT b'0',
    ADD COLUMN paid_on DATE NULL,
    ADD COLUMN paid_mode VARCHAR(20) NULL;

ALTER TABLE salary_records
    ADD COLUMN already_paid DECIMAL(15,2) NOT NULL DEFAULT 0;

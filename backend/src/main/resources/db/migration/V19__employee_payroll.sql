-- Employee payroll depth: structured payslip, salary structure, advances, loans, recovery audit.
--
-- Contractor financials are NOT touched here — they already live in the contractor bill/payment/ledger
-- engine (V12) and are only surfaced by HR. This migration is entirely employee-side and additive:
-- every new column is nullable or default-backed so existing salary_records stay valid.
--
-- Rollback: DROP TABLE payroll_recoveries, employee_loans, employee_advances, salary_structures;
-- drop the added salary_records columns; DELETE FROM flyway_schema_history WHERE version='19'.

-- ---------------------------------------------------------------------------
-- salary_records: expand the lean (basic/allowances/deductions/net) row into a full payslip.
-- ---------------------------------------------------------------------------
ALTER TABLE salary_records ADD COLUMN hra DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN overtime_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN overtime_hours DECIMAL(8,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN bonus DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN incentive DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN other_earnings DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN gross_earnings DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN pf_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN esi_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN professional_tax DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN advance_recovery DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN loan_recovery DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN leave_deduction DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN other_deductions DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN working_days DECIMAL(6,2) NULL;
ALTER TABLE salary_records ADD COLUMN paid_days DECIMAL(6,2) NULL;
ALTER TABLE salary_records ADD COLUMN lop_days DECIMAL(6,2) NULL;
ALTER TABLE salary_records ADD COLUMN payslip_number VARCHAR(50) NULL;
ALTER TABLE salary_records ADD COLUMN generated_at DATETIME NULL;
ALTER TABLE salary_records ADD COLUMN remarks TEXT NULL;

-- ---------------------------------------------------------------------------
-- salary_structures: the per-employee earning components + statutory flags a payroll run reads.
-- ---------------------------------------------------------------------------
CREATE TABLE salary_structures (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    basic DECIMAL(15,2) NOT NULL DEFAULT 0,
    hra DECIMAL(15,2) NOT NULL DEFAULT 0,
    allowances DECIMAL(15,2) NOT NULL DEFAULT 0,
    special_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
    pf_enabled BIT NOT NULL DEFAULT 1,
    pf_percentage DECIMAL(5,2) NOT NULL DEFAULT 12,
    esi_enabled BIT NOT NULL DEFAULT 0,
    professional_tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    overtime_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    effective_from DATE NULL,
    active BIT NOT NULL DEFAULT 1,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_salstruct_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    INDEX idx_salstruct_employee (employee_id)
);

-- ---------------------------------------------------------------------------
-- employee_advances: salary advances recovered over subsequent payrolls.
-- ---------------------------------------------------------------------------
CREATE TABLE employee_advances (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    reason VARCHAR(255) NULL,
    advance_date DATE NULL,
    -- PENDING, APPROVED, RECOVERING, RECOVERED, REJECTED
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    monthly_recovery DECIMAL(15,2) NOT NULL DEFAULT 0,
    recovered_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    approved_by_id BIGINT NULL,
    remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_empadv_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    CONSTRAINT fk_empadv_approver FOREIGN KEY (approved_by_id) REFERENCES users(id),
    INDEX idx_empadv_employee (employee_id),
    INDEX idx_empadv_status (status)
);

-- ---------------------------------------------------------------------------
-- employee_loans: recovered via EMI over subsequent payrolls.
-- ---------------------------------------------------------------------------
CREATE TABLE employee_loans (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    principal DECIMAL(15,2) NOT NULL DEFAULT 0,
    emi_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tenure_months INT NULL,
    disbursed_date DATE NULL,
    -- ACTIVE, CLOSED
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    recovered_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_emploan_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    INDEX idx_emploan_employee (employee_id),
    INDEX idx_emploan_status (status)
);

-- ---------------------------------------------------------------------------
-- payroll_recoveries: immutable audit linking each recovery deduction on a payslip back to the
-- advance/loan it paid down (supports correct history + reversal if a payroll is cancelled).
-- ---------------------------------------------------------------------------
CREATE TABLE payroll_recoveries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    salary_record_id BIGINT NOT NULL,
    -- ADVANCE, LOAN
    source_type VARCHAR(20) NOT NULL,
    source_id BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_payrec_salary FOREIGN KEY (salary_record_id) REFERENCES salary_records(id),
    INDEX idx_payrec_salary (salary_record_id),
    INDEX idx_payrec_source (source_type, source_id)
);

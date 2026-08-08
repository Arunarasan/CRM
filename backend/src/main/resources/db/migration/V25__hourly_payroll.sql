-- Hourly Payroll Management (spec: company pays by hourly wage + OT + approved bonuses, not fixed salary).
-- Builds on V19 (payroll), V20 (attendance time-clock / hourly earnings) and V24 (employee bonuses).
-- All additive.

-- 1) Expanded HR wage settings on the employee master. Explicit per-hour rates OVERRIDE the multiplier
--    when set (NULL = fall back to hourly_rate x multiplier from V20). Plus payroll config fields.
ALTER TABLE employees
    ADD COLUMN overtime_rate    DECIMAL(10,2) NULL,
    ADD COLUMN holiday_rate     DECIMAL(10,2) NULL,
    ADD COLUMN weekend_rate     DECIMAL(10,2) NULL,
    ADD COLUMN night_rate       DECIMAL(10,2) NULL,
    ADD COLUMN max_daily_hours  DECIMAL(5,2)  NULL,
    ADD COLUMN bonus_eligible   TINYINT(1)    NOT NULL DEFAULT 1,
    ADD COLUMN payroll_cycle    VARCHAR(20)   NOT NULL DEFAULT 'MONTHLY',
    ADD COLUMN payment_method   VARCHAR(30)   NULL;

-- 2) Hourly payslip fields on the salary record. pay_type distinguishes an HOURLY run from the legacy
--    MONTHLY (fixed-salary) run so a payslip renders the right breakdown.
ALTER TABLE salary_records
    ADD COLUMN pay_type          VARCHAR(20)   NOT NULL DEFAULT 'MONTHLY',
    ADD COLUMN hourly_rate       DECIMAL(10,2) NULL,
    ADD COLUMN overtime_rate     DECIMAL(10,2) NULL,
    ADD COLUMN worked_hours      DECIMAL(8,2)  NOT NULL DEFAULT 0,
    ADD COLUMN regular_hours     DECIMAL(8,2)  NOT NULL DEFAULT 0,
    ADD COLUMN attendance_days   INT           NOT NULL DEFAULT 0,
    ADD COLUMN regular_earnings  DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN project_bonus     DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN manual_bonus      DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN manual_deduction  DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN approved_by_id    BIGINT        NULL,
    ADD COLUMN approved_at       DATETIME      NULL,
    ADD CONSTRAINT fk_salrec_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id);

-- 3) Project-bonus recommend workflow (Project Manager recommends -> HR approves). Also link a bonus to
--    the payslip that absorbed it so it is never counted twice.
ALTER TABLE employee_bonuses
    ADD COLUMN recommended_by_id     BIGINT NULL,
    ADD COLUMN paid_salary_record_id BIGINT NULL,
    ADD CONSTRAINT fk_empbonus_recommended_by FOREIGN KEY (recommended_by_id) REFERENCES users(id);

-- 4) Manual deductions (fine / damage / advance recovery / loan recovery / other) — HR-added, approved,
--    then absorbed into a payroll run (linked via applied_salary_record_id, immutable audit).
CREATE TABLE employee_deductions (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id              BIGINT       NOT NULL,
    deduction_type           VARCHAR(40)  NOT NULL,
    amount                   DECIMAL(15,2) NOT NULL DEFAULT 0,
    reason                   TEXT         NULL,
    deduction_date           DATE         NULL,
    status                   VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    approved_by_id           BIGINT       NULL,
    decided_at               DATETIME     NULL,
    applied_salary_record_id BIGINT       NULL,
    target_month             INT          NULL,
    target_year              INT          NULL,
    created_at               DATETIME     NULL,
    updated_at               DATETIME     NULL,
    created_by               VARCHAR(255) NULL,
    updated_by               VARCHAR(255) NULL,
    deleted_by               VARCHAR(255) NULL,
    deleted_at               DATETIME     NULL,
    is_deleted               BIT          NOT NULL DEFAULT 0,
    version                  BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_empded_employee    FOREIGN KEY (employee_id)    REFERENCES employees(id),
    CONSTRAINT fk_empded_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id),
    INDEX idx_empded_employee (employee_id),
    INDEX idx_empded_status (status)
);

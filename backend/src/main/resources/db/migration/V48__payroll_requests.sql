-- Employee-raised payroll requests: salary advance, one-off loan repayment for a month, or an
-- "other" deduction/reimbursement. Employees raise these from the self-service app; HR/Admin
-- approve. On approval an ADVANCE spawns an employee_advances row (existing recovery engine);
-- LOAN_REPAYMENT / OTHER are absorbed by the target month's payroll run. Additive.

CREATE TABLE payroll_requests (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id              BIGINT        NOT NULL,
    requested_by_id          BIGINT        NULL,
    request_type             VARCHAR(30)   NOT NULL,           -- ADVANCE | LOAN_REPAYMENT | OTHER
    direction                VARCHAR(10)   NOT NULL DEFAULT 'DEBIT', -- DEBIT | CREDIT
    amount                   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    monthly_recovery         DECIMAL(15,2) NULL,               -- suggested per-month recovery (advance)
    target_month             INT           NULL,
    target_year              INT           NULL,
    loan_id                  BIGINT        NULL,               -- loan being repaid (LOAN_REPAYMENT)
    reason                   TEXT          NULL,
    status                   VARCHAR(20)   NOT NULL DEFAULT 'PENDING', -- PENDING|APPROVED|APPLIED|CONVERTED|REJECTED
    approved_by_id           BIGINT        NULL,
    decided_at               DATETIME      NULL,
    admin_remarks            TEXT          NULL,
    applied_salary_record_id BIGINT        NULL,               -- payslip that absorbed it
    converted_advance_id     BIGINT        NULL,               -- advance spawned from an approved ADVANCE
    created_at               DATETIME      NULL,
    updated_at               DATETIME      NULL,
    created_by               VARCHAR(255)  NULL,
    updated_by               VARCHAR(255)  NULL,
    deleted_by               VARCHAR(255)  NULL,
    deleted_at               DATETIME      NULL,
    is_deleted               BIT           NOT NULL DEFAULT 0,
    version                  BIGINT        NULL DEFAULT 0,
    CONSTRAINT fk_payreq_employee     FOREIGN KEY (employee_id)     REFERENCES employees(id),
    CONSTRAINT fk_payreq_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id),
    CONSTRAINT fk_payreq_approved_by  FOREIGN KEY (approved_by_id)  REFERENCES users(id),
    INDEX idx_payreq_employee (employee_id),
    INDEX idx_payreq_status (status)
);

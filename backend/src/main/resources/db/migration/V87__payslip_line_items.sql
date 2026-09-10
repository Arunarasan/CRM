-- Editable payslip line items: admin-added named earnings/deductions on top of the auto-computed
-- payslip (attendance pay, auto-absorbed bonuses, PF/ESI/PT, loan & advance recovery). Used for
-- lead/project task-completion incentives, customer-feedback incentive, company incentive, other
-- allowances, ad-hoc bonuses and deductions. Gross/net recompute from the record's component fields
-- plus the sum of these lines, so editing is idempotent.

CREATE TABLE payslip_line_items (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    salary_record_id  BIGINT       NOT NULL,
    category          VARCHAR(20)  NOT NULL,        -- EARNING | DEDUCTION
    label             VARCHAR(150) NOT NULL,
    amount            DECIMAL(15,2) NOT NULL DEFAULT 0,
    source            VARCHAR(20)  NOT NULL DEFAULT 'MANUAL',  -- MANUAL | AUTO
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_payslip_line_salary FOREIGN KEY (salary_record_id) REFERENCES salary_records(id),
    INDEX idx_payslip_line_salary (salary_record_id)
);

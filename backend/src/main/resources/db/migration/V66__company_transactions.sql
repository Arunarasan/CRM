-- Company-wide cash transactions: the home for money that no other module records.
--
-- The Finance "Cash Book" consolidates every inflow and outflow across the business by READING
-- across the existing tables (customer payments in; supplier / contractor / payroll payments out).
-- This table adds the two things that had nowhere to live before:
--   * OTHER INCOME  — interest, scrap/asset sale, misc receipts that are not customer invoices
--   * OTHER EXPENSE — company overhead / "other charges": rent, utilities, office, marketing, etc.
-- Rows are cash movements (money actually in/out on txn_date). Project link is optional — most
-- overhead is company-level, but a charge can still be attributed to a project when relevant.

CREATE TABLE company_transactions (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    txn_number       VARCHAR(50)  NOT NULL UNIQUE,
    direction        VARCHAR(10)  NOT NULL,             -- INCOME, EXPENSE
    category         VARCHAR(40)  NOT NULL,             -- RENT, UTILITIES, MARKETING, INTEREST, SCRAP_SALE, ...
    party_type       VARCHAR(30)  NULL,                 -- SUPPLIER, EMPLOYEE, CONTRACTOR, CUSTOMER, OTHER
    party_name       VARCHAR(200) NULL,                 -- free-text payee / payer
    amount           DECIMAL(15,2) NOT NULL,
    txn_date         DATE         NOT NULL,
    payment_method   VARCHAR(50)  NULL,                 -- CASH, UPI, BANK_TRANSFER, CHEQUE, ...
    reference_number VARCHAR(100) NULL,
    project_id       BIGINT       NULL,                 -- optional attribution
    description      VARCHAR(500) NULL,
    notes            TEXT         NULL,
    recorded_by_id   BIGINT       NULL,
    created_at       DATETIME     NULL,
    updated_at       DATETIME     NULL,
    created_by       VARCHAR(255) NULL,
    updated_by       VARCHAR(255) NULL,
    deleted_by       VARCHAR(255) NULL,
    deleted_at       DATETIME     NULL,
    is_deleted       BIT          NOT NULL DEFAULT 0,
    version          BIGINT       NULL DEFAULT 0,
    INDEX idx_ctxn_direction (direction),
    INDEX idx_ctxn_date (txn_date),
    INDEX idx_ctxn_category (category),
    INDEX idx_ctxn_project (project_id)
);

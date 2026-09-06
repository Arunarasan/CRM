-- Recurring company expense heads (rent, electricity, internet, …) + bill attachment.
--
-- A "head" is the standing definition of a repeating overhead. There is NO auto-scheduling:
-- each month the user records that period's actual payment by hand as a company_transactions
-- EXPENSE row linked back to its head (recurring_expense_id) with the bill/receipt on file
-- (document_url). Those rows already flow into the Cash Book and the P&L / expense reports,
-- so recording a recurring payment reflects in cash-out exactly like any other expense.

CREATE TABLE recurring_expenses (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,             -- "Office Rent", "Electricity — Shop"
    category         VARCHAR(40)  NOT NULL,             -- RENT, ELECTRICITY, INTERNET, …
    default_amount   DECIMAL(15,2) NULL,                -- usual amount (null for variable bills)
    party_name       VARCHAR(200) NULL,                 -- landlord / board / provider
    payment_method   VARCHAR(50)  NULL,                 -- usual method
    frequency        VARCHAR(20)  NOT NULL DEFAULT 'MONTHLY',
    day_of_month     INT          NULL,                 -- informational "usually due on" day
    active           BIT          NOT NULL DEFAULT 1,
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
    INDEX idx_recexp_active (active),
    INDEX idx_recexp_category (category)
);

-- A recorded company transaction can now point back at its recurring head and carry a bill.
ALTER TABLE company_transactions
    ADD COLUMN recurring_expense_id BIGINT NULL,
    ADD COLUMN document_url         VARCHAR(500) NULL;

CREATE INDEX idx_ctxn_recurring ON company_transactions (recurring_expense_id);

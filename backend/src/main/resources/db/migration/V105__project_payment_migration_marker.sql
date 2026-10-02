-- Legacy project_payments (advances recorded at quotation→project conversion) were never visible on the
-- project's Payments tab, ledger or outstanding, which read customer_payments. LegacyProjectPaymentBackfill
-- moves each one into customer_payments through FinanceService on startup; this column marks the moved
-- rows (the customer_payments id it became, 0 = nothing to move) so the backfill runs exactly once.
ALTER TABLE project_payments ADD COLUMN migrated_payment_id BIGINT NULL;

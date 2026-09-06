-- Distinguish walk-in (counter-sale) customers from full project clients.
-- All existing records default to PROJECT_CLIENT so nothing that already carries
-- project/lead history is reclassified; new counter-sale customers are tagged WALK_IN
-- at creation time by FinanceService.
ALTER TABLE customers ADD COLUMN customer_segment VARCHAR(30);

UPDATE customers SET customer_segment = 'PROJECT_CLIENT' WHERE customer_segment IS NULL;

CREATE INDEX idx_customer_segment ON customers (customer_segment);

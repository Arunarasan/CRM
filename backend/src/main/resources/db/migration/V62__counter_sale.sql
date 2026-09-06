-- Walk-in / counter sale support.
--
-- A counter sale is an invoice with no project (invoice_type = 'COUNTER_SALE') that bills
-- products/materials sold over the counter, optionally with an installation charge. Product
-- lines carry the source product + warehouse so a cancellation can put the stock back, and an
-- installation charge spins off a Task (optionally assigned to an employee) linked to the invoice.

ALTER TABLE invoice_items
    ADD COLUMN product_id BIGINT NULL,
    ADD COLUMN source_warehouse_id BIGINT NULL;

-- Plain id back-link (no FK constraint) following the tasks.generated_from_boq_item_id convention.
ALTER TABLE tasks
    ADD COLUMN invoice_id BIGINT NULL;

CREATE INDEX idx_task_invoice ON tasks (invoice_id);

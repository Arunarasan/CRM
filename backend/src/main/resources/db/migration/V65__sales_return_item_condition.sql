-- Per-line condition on a sales/product return: GOOD goes back to usable stock,
-- DAMAGED is restocked then moved into the damaged bucket via a damage entry.
ALTER TABLE sales_return_items
    ADD COLUMN item_condition VARCHAR(20) NULL DEFAULT 'GOOD';

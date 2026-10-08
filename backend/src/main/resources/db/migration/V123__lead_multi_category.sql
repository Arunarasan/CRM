-- A lead can now name several catalog categories (comma-separated, like requirement_product),
-- so the column needs room for more than one name.
ALTER TABLE leads MODIFY requirement_category VARCHAR(500) NULL;

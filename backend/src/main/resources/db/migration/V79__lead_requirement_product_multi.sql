-- A lead can now capture more than one requirement product, stored as a comma-separated list
-- of product names. Widen the column from the original single-name size to hold several.

ALTER TABLE leads
    MODIFY COLUMN requirement_product VARCHAR(1000) NULL;

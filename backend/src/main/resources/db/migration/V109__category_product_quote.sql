-- Category → Product quotations: each pricing-sheet line can be a catalogue product (or a custom one)
-- with its own photo, colour, optional location note and optional line discount; the sheet carries
-- labour and shipping charges in its totals; products get a list of colours to pick from.

ALTER TABLE boq_items
    ADD COLUMN product_id BIGINT NULL,
    ADD COLUMN image_url VARCHAR(1000) NULL,
    ADD COLUMN color VARCHAR(100) NULL,
    ADD COLUMN location VARCHAR(150) NULL,
    ADD COLUMN discount_type VARCHAR(10) NULL,
    ADD COLUMN discount_value DECIMAL(15,2) NULL,
    ADD COLUMN gross_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT fk_boq_item_catalog_product FOREIGN KEY (product_id) REFERENCES products (id);

-- Existing lines had no line discount: gross = amount.
UPDATE boq_items SET gross_amount = COALESCE(amount, 0);

ALTER TABLE boqs
    ADD COLUMN line_discount_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN labour_charge DECIMAL(15,2) NULL,
    ADD COLUMN labour_note VARCHAR(255) NULL,
    ADD COLUMN shipping_charge DECIMAL(15,2) NULL,
    ADD COLUMN shipping_note VARCHAR(255) NULL;

ALTER TABLE quotation_items
    ADD COLUMN product_id BIGINT NULL,
    ADD COLUMN image_url VARCHAR(1000) NULL,
    ADD COLUMN location VARCHAR(150) NULL,
    ADD COLUMN discount_amount DECIMAL(15,2) NULL,
    ADD CONSTRAINT fk_quotation_item_catalog_product FOREIGN KEY (product_id) REFERENCES products (id);

-- [{"name":"Ivory","hex":"#f4efe2","imageUrl":"..."}]
ALTER TABLE products
    ADD COLUMN colors_json TEXT NULL;

-- A product's existing single colour becomes its first colour option.
UPDATE products
SET colors_json = JSON_ARRAY(JSON_OBJECT('name', TRIM(color)))
WHERE color IS NOT NULL AND TRIM(color) <> '';

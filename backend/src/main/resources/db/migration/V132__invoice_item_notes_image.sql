-- Bill lines can carry a short description and a photo (counter sale "add item"), printed on the
-- invoice / receipt under the item name.
ALTER TABLE invoice_items ADD COLUMN notes TEXT NULL;
ALTER TABLE invoice_items ADD COLUMN image_url VARCHAR(500) NULL;

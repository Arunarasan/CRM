-- Colour/finish variants for website shop products.
-- Stored as a JSON array of { name, hex, image } objects, mirroring gallery_json / specifications_json.
ALTER TABLE shop_products ADD COLUMN colors_json TEXT NULL;

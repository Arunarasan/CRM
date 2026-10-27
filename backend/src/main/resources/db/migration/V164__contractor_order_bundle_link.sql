-- A contractor job can optionally point at a customer order (a bundle, called "Order" on screen).
ALTER TABLE contractor_orders
    ADD COLUMN bundle_id BIGINT NULL,
    ADD INDEX idx_cord_bundle (bundle_id),
    ADD CONSTRAINT fk_cord_bundle FOREIGN KEY (bundle_id) REFERENCES bundles(id);

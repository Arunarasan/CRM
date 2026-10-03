-- A purchase order can deliver to several places (site, godown, transport office…), one per
-- shipment. Newline-separated list; delivery_address keeps the first one for older screens.
ALTER TABLE purchase_orders
    ADD COLUMN delivery_addresses TEXT NULL;

UPDATE purchase_orders
   SET delivery_addresses = delivery_address
 WHERE delivery_address IS NOT NULL AND TRIM(delivery_address) <> '';

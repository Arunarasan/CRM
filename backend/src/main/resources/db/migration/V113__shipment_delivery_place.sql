-- Where each parcel is delivered (customer site, our godown, or a transport office to collect from).
ALTER TABLE purchase_order_shipments
    ADD COLUMN delivery_place VARCHAR(255) NULL;

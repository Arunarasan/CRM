-- The customer's other choices on the public quotation link (/q/{token}) besides "Accept":
-- ask for changes, or decline. The last choice is kept here; "Accept" still uses customer_accepted_*.
-- Neither choice locks anything — staff read the message and follow up in the CRM.
ALTER TABLE quotations
    ADD COLUMN customer_response VARCHAR(20) NULL,
    ADD COLUMN customer_response_at DATETIME(6) NULL,
    ADD COLUMN customer_response_name VARCHAR(150) NULL,
    ADD COLUMN customer_response_note TEXT NULL;

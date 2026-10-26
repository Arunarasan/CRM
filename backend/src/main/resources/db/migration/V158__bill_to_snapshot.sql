-- Editable "Bill To" (customer's company details) kept on each quotation / invoice, so edits apply to
-- that document only and an issued invoice doesn't change when the customer record is edited later.
ALTER TABLE quotations
    ADD COLUMN bill_to_name VARCHAR(200) NULL,
    ADD COLUMN bill_to_gstin VARCHAR(20) NULL,
    ADD COLUMN bill_to_address TEXT NULL,
    ADD COLUMN bill_to_state VARCHAR(100) NULL,
    ADD COLUMN bill_to_phone VARCHAR(30) NULL,
    ADD COLUMN bill_to_email VARCHAR(150) NULL;

ALTER TABLE invoices
    ADD COLUMN bill_to_name VARCHAR(200) NULL,
    ADD COLUMN bill_to_gstin VARCHAR(20) NULL,
    ADD COLUMN bill_to_address TEXT NULL,
    ADD COLUMN bill_to_state VARCHAR(100) NULL,
    ADD COLUMN bill_to_phone VARCHAR(30) NULL,
    ADD COLUMN bill_to_email VARCHAR(150) NULL;

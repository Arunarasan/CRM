-- Public, no-login quotation link (/q/{token}) sent to the customer with the PDF from "Share Quote".
-- The token is the only credential and opens exactly one quotation; share_enabled = 0 turns it off.
-- customer_accepted_* records the customer pressing "Accept" on that page — staff then confirm the
-- approval in the CRM (an unauthenticated click never locks the sheet by itself).
ALTER TABLE quotations
    ADD COLUMN share_token VARCHAR(64) NULL,
    ADD COLUMN share_enabled BIT(1) NOT NULL DEFAULT b'1',
    ADD COLUMN share_pdf_url VARCHAR(1000) NULL,
    ADD COLUMN shared_at DATETIME(6) NULL,
    ADD COLUMN customer_accepted_at DATETIME(6) NULL,
    ADD COLUMN customer_accepted_name VARCHAR(150) NULL,
    ADD COLUMN customer_accept_note TEXT NULL,
    ADD CONSTRAINT uk_quotations_share_token UNIQUE (share_token);

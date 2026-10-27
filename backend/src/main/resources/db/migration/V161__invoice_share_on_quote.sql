-- Staff can show a project invoice (PDF + paid/balance) on the customer's quotation link (/q/{token}).
ALTER TABLE invoices
    ADD COLUMN share_on_quote BIT(1) NOT NULL DEFAULT b'0',
    ADD COLUMN share_pdf_url VARCHAR(1000) NULL;

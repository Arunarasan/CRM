-- Product-quote enquiries from the public site carry the category and the selected colour/finish the
-- client was viewing, alongside the product (product_slug / interest). Surfaced in Website → Enquiries
-- so the team knows exactly which catalog item the client wants a quote for.

ALTER TABLE website_enquiries
    ADD COLUMN category VARCHAR(120) NULL AFTER product_slug,
    ADD COLUMN colour   VARCHAR(80)  NULL AFTER category;

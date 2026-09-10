-- Streamlined lead capture: a manual 1-5 star quality rating and the catalog product the
-- requirement maps to (alongside the existing requirement_category). All nullable — set at
-- creation from the trimmed "Create New Lead" form; older leads leave them empty.

ALTER TABLE leads
    ADD COLUMN rating              TINYINT      NULL,
    ADD COLUMN requirement_product VARCHAR(150) NULL;

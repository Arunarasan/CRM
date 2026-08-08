-- Manual overrides for a BOQ's material / labour totals. NULL (the default) keeps the existing
-- behaviour of summing the totals from each item's material/labour lines; a non-null value is a
-- user-entered lump sum that replaces the computed total and flows through subtotal → discount →
-- tax → grand total. Discount (type/value) and tax percent already existed on boqs and stay as-is.
ALTER TABLE boqs
    ADD COLUMN material_total_override DECIMAL(15, 2) NULL,
    ADD COLUMN labour_total_override   DECIMAL(15, 2) NULL;

-- "Prices include GST" toggle on every document that charges GST.
--
-- tax_inclusive = 0 (default) keeps today's behaviour: rates are before GST and GST is added on top.
-- tax_inclusive = 1 means the entered rates already contain GST: the GST is worked out of them and the
-- total is not increased.
--
-- Invoices keep their line unit_price as the taxable (before-GST) rate, so GST reports, HSN summaries
-- and sales returns stay correct; the rate the user typed (with GST) is kept in unit_price_incl for
-- display. unit_price gains two decimals so a with-GST rate converts back without paise drift.

ALTER TABLE boqs ADD COLUMN tax_inclusive BIT(1) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN tax_inclusive BIT(1) NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN unit_price_incl DECIMAL(15,2) NULL;
ALTER TABLE invoice_items MODIFY unit_price DECIMAL(15,4) NOT NULL;
ALTER TABLE purchase_orders ADD COLUMN tax_inclusive BIT(1) NOT NULL DEFAULT 0;
ALTER TABLE contractor_bills ADD COLUMN tax_inclusive BIT(1) NOT NULL DEFAULT 0;

-- Quote rates to 4 decimals: a sheet line of Rs 2,000 for 3 units has rate 666.6667, so rate x qty
-- rounds back to exactly 2,000.00 instead of 666.67 x 3 = 2,000.01.
ALTER TABLE quotation_items MODIFY COLUMN rate DECIMAL(15,4) NOT NULL;

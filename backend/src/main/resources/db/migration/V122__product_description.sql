-- A product's own description (shown under its name on quote lines). Items saved from quotes keep
-- the line's description here, and editing it on a quote updates it.
ALTER TABLE products ADD COLUMN description TEXT NULL;

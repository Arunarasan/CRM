-- Where a catalogue product came from. 'QUOTE' = typed into a quote and saved for reuse:
-- name / unit / rate only, no stock kept until someone stocks it.
ALTER TABLE products ADD COLUMN source VARCHAR(20) NULL;

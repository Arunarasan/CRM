-- Backfills the new boqs.lead_id / site_visit_id columns for existing rows from whichever
-- already-linked record (measurement, else quotation) carries that reference, and flags
-- pre-existing measurement-less BOQs as unlinked for manual review.
-- Idempotent: every statement is guarded by "IS NULL" on the column being filled, so it is
-- safe to re-run and never overwrites a value that is already populated.

UPDATE boqs b
JOIN measurements m ON b.measurement_id = m.id
SET b.lead_id = m.lead_id
WHERE b.lead_id IS NULL AND m.lead_id IS NOT NULL;

UPDATE boqs b
JOIN measurements m ON b.measurement_id = m.id
SET b.site_visit_id = m.site_visit_id
WHERE b.site_visit_id IS NULL AND m.site_visit_id IS NOT NULL;

UPDATE boqs b
JOIN quotations q ON b.quotation_id = q.id
SET b.lead_id = q.lead_id
WHERE b.lead_id IS NULL AND q.lead_id IS NOT NULL;

UPDATE boqs b
JOIN quotations q ON b.quotation_id = q.id
SET b.site_visit_id = q.site_visit_id
WHERE b.site_visit_id IS NULL AND q.site_visit_id IS NOT NULL;

UPDATE boqs
SET link_status = 'UNLINKED_LEGACY'
WHERE measurement_id IS NULL AND link_status = 'LINKED';

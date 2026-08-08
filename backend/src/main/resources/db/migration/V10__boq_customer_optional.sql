-- A BOQ generated from a lead's site visit has no customer yet: leads only become customers on
-- conversion, and the BOQ legitimately hangs off lead_id until then (see boqs.lead_id, added in V2).
-- The Boq entity never declared customer_id as non-null — the NOT NULL is a leftover from the
-- original schema, and it made "Generate BOQ" fail with a raw DataIntegrityViolationException.
ALTER TABLE boqs MODIFY COLUMN customer_id BIGINT NULL;

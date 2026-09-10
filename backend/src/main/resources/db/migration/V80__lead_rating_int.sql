-- V78 created leads.rating as TINYINT, but the Lead entity maps it as Integer, which Hibernate
-- schema-validation expects to be SQL INTEGER. Widen the column to INT so validation passes.
-- The stored 1-5 rating values are unaffected.

ALTER TABLE leads
    MODIFY COLUMN rating INT NULL;

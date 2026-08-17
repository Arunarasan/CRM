-- Back-fill workforce headers for orphan extension rows.
--
-- V18 introduced the unified `workforce` header and seeded one header per employee/contractor that
-- existed at that time. Between V18 and the "single source of truth" fix, the legacy
-- `POST /hr/employees` path (and any direct Employee.save) could still persist an employee with a
-- NULL workforce_id — an orphan invisible to the Workforce directory, the assignment pool and the
-- unified profile. HrService.createEmployee now always attaches a header, so no NEW orphans can be
-- created; this migration heals the ones already in the database so the invariant
-- "every employee/contractor has a workforce header" holds for all existing data too.
--
-- Idempotent by construction: only rows WHERE workforce_id IS NULL are touched, so on a database with
-- no orphans this inserts nothing (the temp column is still added and dropped, which is harmless).
--
-- Pattern mirrors the V18 back-fill exactly. `backfill_source` was dropped at the end of V18, so it is
-- re-added here purely to wire each freshly inserted header back to its extension row, then dropped.
--
-- Rollback: headers created here are indistinguishable from normal ones after the temp column is
-- dropped; to undo, delete workforce rows that have no matching employee/contractor and re-null the
-- corresponding workforce_id. DELETE FROM flyway_schema_history WHERE version='32'.

ALTER TABLE workforce ADD COLUMN backfill_source VARCHAR(50) NULL;

-- --- Employees --------------------------------------------------------------
INSERT INTO workforce (workforce_type, full_name, mobile, email, profile_photo_url, status,
                       is_deleted, version, backfill_source, created_at, updated_at)
SELECT 'EMPLOYEE',
       TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))),
       phone, email, profile_photo_url,
       CASE status
            WHEN 'ACTIVE' THEN 'AVAILABLE'
            WHEN 'ON_LEAVE' THEN 'ON_LEAVE'
            WHEN 'TERMINATED' THEN 'INACTIVE'
            ELSE 'AVAILABLE'
       END,
       0, 0, CONCAT('EMP:', id), NOW(), NOW()
FROM employees
WHERE workforce_id IS NULL;

UPDATE employees e
   JOIN workforce w ON w.backfill_source = CONCAT('EMP:', e.id)
   SET e.workforce_id = w.id;

-- --- Contractors ------------------------------------------------------------
INSERT INTO workforce (workforce_type, full_name, mobile, email, primary_skill,
                       address_line1, address_line2, city, state, pincode, pan_number, status,
                       is_deleted, version, backfill_source, created_at, updated_at)
SELECT 'CONTRACTOR',
       name, phone, email, trade,
       address_line1, address_line2, city, state, pincode, pan,
       CASE status WHEN 'ACTIVE' THEN 'AVAILABLE' ELSE 'INACTIVE' END,
       0, 0, CONCAT('CON:', id), NOW(), NOW()
FROM contractors
WHERE workforce_id IS NULL;

UPDATE contractors c
   JOIN workforce w ON w.backfill_source = CONCAT('CON:', c.id)
   SET c.workforce_id = w.id;

-- Wiring done; the temp key is no longer needed.
ALTER TABLE workforce DROP COLUMN backfill_source;

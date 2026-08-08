-- Unified Workforce master.
--
-- Employees and contractors share ~90% of their information. This migration introduces one
-- `workforce` header table holding all shared fields + the workforce type, and keeps the existing
-- `employees` and `contractors` tables as the type-specific EXTENSION tables (each gains a
-- workforce_id back-reference). No existing column is dropped and no existing FK is touched, so the
-- whole Contractor module (work packages / bills / ledger / portal, 13 dependent tables) and the HR
-- payroll/attendance/leave chain keep working unchanged.
--
-- Shared fields remain mirrored onto the extension rows on write (WorkforceService) because existing
-- module code reads contractor.name / employee.first_name directly — this migration seeds that mirror
-- for pre-existing rows via the backfill below.
--
-- Rollback: DROP TABLE workforce_documents, workforce; ALTER TABLE employees/contractors DROP the
-- workforce_id column + fk; DELETE FROM flyway_schema_history WHERE version='18'.

-- ---------------------------------------------------------------------------
-- workforce: the single header. workforce_type is a plain String (codebase convention — no DB enums)
-- so future types (FREELANCER, CONSULTANT, VENDOR, ...) need no schema change.
-- ---------------------------------------------------------------------------
CREATE TABLE workforce (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    -- EMPLOYEE, CONTRACTOR, FREELANCER, CONSULTANT, VENDOR, TEMPORARY (extensible)
    workforce_type VARCHAR(30) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    profile_photo_url VARCHAR(500) NULL,
    mobile VARCHAR(20) NULL,
    email VARCHAR(150) NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(20) NULL,
    address_line1 VARCHAR(255) NULL,
    address_line2 VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    pincode VARCHAR(20) NULL,
    -- Identity
    aadhaar_number VARCHAR(20) NULL,
    pan_number VARCHAR(20) NULL,
    driving_license VARCHAR(50) NULL,
    passport_number VARCHAR(50) NULL,
    -- Emergency contact
    emergency_contact_name VARCHAR(100) NULL,
    emergency_relationship VARCHAR(50) NULL,
    emergency_phone VARCHAR(20) NULL,
    -- Skills
    primary_skill VARCHAR(100) NULL,
    secondary_skills TEXT NULL,
    experience_years INT NULL,
    certifications TEXT NULL,
    -- Project info
    available_from DATE NULL,
    -- AVAILABLE, BUSY, ON_LEAVE, INACTIVE
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    notes TEXT NULL,
    -- Temporary column used only to wire backfilled extension rows back to their header; dropped below.
    backfill_source VARCHAR(50) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    INDEX idx_workforce_type (workforce_type),
    INDEX idx_workforce_status (status),
    INDEX idx_workforce_skill (primary_skill)
);

-- ---------------------------------------------------------------------------
-- workforce_documents: unified document store for new uploads (Aadhaar / PAN / Photo / Certificate /
-- Agreement / Other). Existing employee_documents / contractor_documents remain for their modules.
-- ---------------------------------------------------------------------------
CREATE TABLE workforce_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workforce_id BIGINT NOT NULL,
    -- AADHAAR, PAN, PHOTO, CERTIFICATE, AGREEMENT, OTHER
    doc_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(200) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_wfdoc_workforce FOREIGN KEY (workforce_id) REFERENCES workforce(id),
    INDEX idx_wfdoc_workforce (workforce_id)
);

-- ---------------------------------------------------------------------------
-- Extension back-references. Nullable + no NOT NULL tightening so existing rows are valid immediately;
-- the backfill below fills them for all current data.
-- ---------------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN workforce_id BIGINT NULL;
ALTER TABLE employees ADD CONSTRAINT fk_wf_employee FOREIGN KEY (workforce_id) REFERENCES workforce(id);
CREATE INDEX idx_employee_workforce ON employees (workforce_id);

ALTER TABLE contractors ADD COLUMN workforce_id BIGINT NULL;
ALTER TABLE contractors ADD CONSTRAINT fk_wf_contractor FOREIGN KEY (workforce_id) REFERENCES workforce(id);
CREATE INDEX idx_contractor_workforce ON contractors (workforce_id);

-- ---------------------------------------------------------------------------
-- Employee-only fields from the unified form that the lean employees table did not yet have
-- (payroll / statutory / banking). All additive + nullable/default-backed.
-- ---------------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN salary_type VARCHAR(30) NULL;            -- MONTHLY, DAILY, HOURLY
ALTER TABLE employees ADD COLUMN shift VARCHAR(50) NULL;
ALTER TABLE employees ADD COLUMN attendance_required BIT NOT NULL DEFAULT 1;
ALTER TABLE employees ADD COLUMN leave_policy VARCHAR(100) NULL;
ALTER TABLE employees ADD COLUMN payroll_enabled BIT NOT NULL DEFAULT 1;
ALTER TABLE employees ADD COLUMN pf_number VARCHAR(50) NULL;
ALTER TABLE employees ADD COLUMN esi_number VARCHAR(50) NULL;
ALTER TABLE employees ADD COLUMN bank_account VARCHAR(50) NULL;
ALTER TABLE employees ADD COLUMN ifsc VARCHAR(20) NULL;
ALTER TABLE employees ADD COLUMN uan VARCHAR(50) NULL;

-- ---------------------------------------------------------------------------
-- Contractor-only fields from the unified form not already present. (Company / GST / contract dates /
-- labour rate / agreement / service categories / insurance all map to existing columns.)
-- ---------------------------------------------------------------------------
ALTER TABLE contractors ADD COLUMN payment_terms VARCHAR(255) NULL;
ALTER TABLE contractors ADD COLUMN tds_applicable BIT NULL;

-- ---------------------------------------------------------------------------
-- Backfill: one workforce header per existing employee and per existing contractor, then wire the
-- extension's workforce_id via the temporary backfill_source key.
-- ---------------------------------------------------------------------------
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

-- Backfill wiring done; the temp key is no longer needed.
ALTER TABLE workforce DROP COLUMN backfill_source;

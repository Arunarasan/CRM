-- Enterprise Contractor Management.
--
-- Contractors are NOT a standalone workflow: every execution row here hangs off a
-- Work Package, and a Work Package always belongs to a Project (optionally scoped to a
-- Phase / Room / BOQ items). The chain is
--   Project -> Phase -> Room -> BOQ Items -> Work Package -> Contractor -> Execution -> Bill -> Payment
--
-- The legacy contractor tables (contractors, contractor_projects, contractor_attendance,
-- contractor_payments, contractor_documents) are extended additively so /api/contractors
-- keeps working; every new column is nullable or default-backed.

-- ---------------------------------------------------------------------------
-- Contractor master: identity, statutory, banking, trade, rating, compliance
-- ---------------------------------------------------------------------------
ALTER TABLE contractors ADD COLUMN contractor_code VARCHAR(50) NULL;
ALTER TABLE contractors ADD COLUMN owner_name VARCHAR(255) NULL;
ALTER TABLE contractors ADD COLUMN contact_person VARCHAR(255) NULL;
ALTER TABLE contractors ADD COLUMN alternate_phone VARCHAR(50) NULL;
ALTER TABLE contractors ADD COLUMN gstin VARCHAR(20) NULL;
ALTER TABLE contractors ADD COLUMN pan VARCHAR(20) NULL;
ALTER TABLE contractors ADD COLUMN bank_name VARCHAR(150) NULL;
ALTER TABLE contractors ADD COLUMN bank_account_name VARCHAR(200) NULL;
ALTER TABLE contractors ADD COLUMN bank_account_number VARCHAR(50) NULL;
ALTER TABLE contractors ADD COLUMN bank_ifsc VARCHAR(20) NULL;
ALTER TABLE contractors ADD COLUMN bank_branch VARCHAR(150) NULL;
ALTER TABLE contractors ADD COLUMN upi_id VARCHAR(100) NULL;
ALTER TABLE contractors ADD COLUMN address_line1 VARCHAR(255) NULL;
ALTER TABLE contractors ADD COLUMN address_line2 VARCHAR(255) NULL;
ALTER TABLE contractors ADD COLUMN city VARCHAR(100) NULL;
ALTER TABLE contractors ADD COLUMN state VARCHAR(100) NULL;
ALTER TABLE contractors ADD COLUMN pincode VARCHAR(20) NULL;
-- Primary trade + comma-separated secondary trades (matches the codebase's
-- "status/type fields are plain Strings" convention — no DB enums anywhere).
ALTER TABLE contractors ADD COLUMN trade VARCHAR(50) NULL;
ALTER TABLE contractors ADD COLUMN trades TEXT NULL;
ALTER TABLE contractors ADD COLUMN contractor_type VARCHAR(50) NULL;
ALTER TABLE contractors ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE contractors ADD COLUMN rating_quality DECIMAL(4,2) NULL;
ALTER TABLE contractors ADD COLUMN rating_timeliness DECIMAL(4,2) NULL;
ALTER TABLE contractors ADD COLUMN rating_safety DECIMAL(4,2) NULL;
ALTER TABLE contractors ADD COLUMN overall_rating DECIMAL(4,2) NULL;
ALTER TABLE contractors ADD COLUMN total_work_packages INT NOT NULL DEFAULT 0;
ALTER TABLE contractors ADD COLUMN completed_work_packages INT NOT NULL DEFAULT 0;
ALTER TABLE contractors ADD COLUMN agreement_number VARCHAR(100) NULL;
ALTER TABLE contractors ADD COLUMN agreement_start_date DATE NULL;
ALTER TABLE contractors ADD COLUMN agreement_end_date DATE NULL;
ALTER TABLE contractors ADD COLUMN insurance_number VARCHAR(100) NULL;
ALTER TABLE contractors ADD COLUMN insurance_expiry_date DATE NULL;
ALTER TABLE contractors ADD COLUMN license_number VARCHAR(100) NULL;
ALTER TABLE contractors ADD COLUMN license_expiry_date DATE NULL;
ALTER TABLE contractors ADD COLUMN pf_number VARCHAR(50) NULL;
ALTER TABLE contractors ADD COLUMN esi_number VARCHAR(50) NULL;
ALTER TABLE contractors ADD COLUMN credit_days INT NULL;
ALTER TABLE contractors ADD COLUMN opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE contractors ADD COLUMN retention_percentage DECIMAL(5,2) NULL;
ALTER TABLE contractors ADD COLUMN tds_percentage DECIMAL(5,2) NULL;
-- Portal login: a contractor may be given a User account with ROLE_CONTRACTOR.
ALTER TABLE contractors ADD COLUMN user_id BIGINT NULL;
ALTER TABLE contractors ADD COLUMN notes TEXT NULL;
ALTER TABLE contractors ADD CONSTRAINT fk_contractor_user FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE contractors ADD CONSTRAINT uk_contractor_code UNIQUE (contractor_code);
ALTER TABLE contractors ADD INDEX idx_contractor_trade (trade);
ALTER TABLE contractors ADD INDEX idx_contractor_status (status);

-- Backfill codes for pre-existing contractors so the master has no blank codes.
UPDATE contractors SET contractor_code = CONCAT('CON-', LPAD(id, 6, '0')) WHERE contractor_code IS NULL;
-- performance_rating (1-5 int) is the legacy column; seed the new decimal rating from it.
UPDATE contractors SET overall_rating = performance_rating WHERE overall_rating IS NULL AND performance_rating IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Contractor documents: expiry tracking + verification
-- ---------------------------------------------------------------------------
ALTER TABLE contractor_documents ADD COLUMN document_number VARCHAR(100) NULL;
ALTER TABLE contractor_documents ADD COLUMN issue_date DATE NULL;
ALTER TABLE contractor_documents ADD COLUMN expiry_date DATE NULL;
ALTER TABLE contractor_documents ADD COLUMN verified BIT NOT NULL DEFAULT 0;
ALTER TABLE contractor_documents ADD COLUMN verified_by_id BIGINT NULL;
ALTER TABLE contractor_documents ADD COLUMN verified_at DATETIME NULL;
ALTER TABLE contractor_documents ADD COLUMN remarks TEXT NULL;
ALTER TABLE contractor_documents ADD CONSTRAINT fk_cdoc_verified_by FOREIGN KEY (verified_by_id) REFERENCES users(id);

-- ---------------------------------------------------------------------------
-- Work Package: the unit of contractor engagement. Never assign a whole project.
-- ---------------------------------------------------------------------------
CREATE TABLE contractor_work_packages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    package_code VARCHAR(50) NULL,
    package_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    project_id BIGINT NOT NULL,
    phase_id BIGINT NULL,
    room_id BIGINT NULL,
    boq_id BIGINT NULL,
    trade VARCHAR(50) NULL,
    -- DRAFT, PENDING_ASSIGNMENT, ASSIGNED, ACCEPTED, IN_PROGRESS, ON_HOLD,
    -- WORK_COMPLETED, INSPECTION_PENDING, REWORK, COMPLETED, CANCELLED
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    -- PER_DAY, PER_SQFT, PER_RUNNING_FEET, PER_UNIT, FIXED_CONTRACT, MILESTONE_BASED
    rate_type VARCHAR(30) NOT NULL DEFAULT 'FIXED_CONTRACT',
    rate DECIMAL(15,2) NULL,
    quantity DECIMAL(15,2) NULL,
    unit VARCHAR(20) NULL,
    estimated_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    approved_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    actual_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    billed_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    retention_percentage DECIMAL(5,2) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    actual_start_date DATE NULL,
    actual_end_date DATE NULL,
    completion_percentage INT NOT NULL DEFAULT 0,
    quality_status VARCHAR(30) NULL,
    site_engineer_id BIGINT NULL,
    created_by_id BIGINT NULL,
    -- Plain id, no FK: traceability back to the BOQ phase this package was generated from,
    -- used to keep "generate work packages from BOQ" idempotent (same pattern as project_phases).
    source_boq_phase_id BIGINT NULL,
    source_trade_key VARCHAR(100) NULL,
    scope_of_work TEXT NULL,
    terms TEXT NULL,
    remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_wp_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_wp_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id),
    CONSTRAINT fk_wp_room FOREIGN KEY (room_id) REFERENCES project_rooms(id),
    CONSTRAINT fk_wp_boq FOREIGN KEY (boq_id) REFERENCES boqs(id),
    CONSTRAINT fk_wp_engineer FOREIGN KEY (site_engineer_id) REFERENCES users(id),
    CONSTRAINT fk_wp_created_by FOREIGN KEY (created_by_id) REFERENCES users(id),
    CONSTRAINT uk_wp_code UNIQUE (package_code),
    INDEX idx_wp_project (project_id),
    INDEX idx_wp_status (status),
    INDEX idx_wp_trade (trade),
    INDEX idx_wp_phase (phase_id),
    INDEX idx_wp_dates (start_date, end_date)
);

-- BOQ items (and the project room items derived from them) covered by a package.
CREATE TABLE work_package_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_package_id BIGINT NOT NULL,
    boq_item_id BIGINT NULL,
    project_room_item_id BIGINT NULL,
    task_id BIGINT NULL,
    item_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    unit VARCHAR(20) NULL,
    quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    completed_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    rate DECIMAL(15,2) NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_wpi_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    CONSTRAINT fk_wpi_boq_item FOREIGN KEY (boq_item_id) REFERENCES boq_items(id),
    CONSTRAINT fk_wpi_room_item FOREIGN KEY (project_room_item_id) REFERENCES project_room_items(id),
    CONSTRAINT fk_wpi_task FOREIGN KEY (task_id) REFERENCES tasks(id),
    INDEX idx_wpi_package (work_package_id),
    INDEX idx_wpi_boq_item (boq_item_id)
);

-- One row per contractor engaged on a package (supports multi-contractor packages).
CREATE TABLE work_package_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_package_id BIGINT NOT NULL,
    contractor_id BIGINT NOT NULL,
    -- ASSIGNED, ACCEPTED, REJECTED, IN_PROGRESS, COMPLETED, TERMINATED
    status VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',
    role VARCHAR(50) NULL,
    scope_share DECIMAL(5,2) NULL,
    rate_type VARCHAR(30) NULL,
    rate DECIMAL(15,2) NULL,
    agreed_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    start_date DATE NULL,
    end_date DATE NULL,
    assigned_at DATETIME NULL,
    accepted_at DATETIME NULL,
    rejected_at DATETIME NULL,
    rejection_reason TEXT NULL,
    completed_at DATETIME NULL,
    assigned_by_id BIGINT NULL,
    remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_wpa_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    CONSTRAINT fk_wpa_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
    CONSTRAINT fk_wpa_assigned_by FOREIGN KEY (assigned_by_id) REFERENCES users(id),
    INDEX idx_wpa_package (work_package_id),
    INDEX idx_wpa_contractor (contractor_id),
    INDEX idx_wpa_status (status)
);

-- ---------------------------------------------------------------------------
-- Material issue to contractor (issue / return / consumption / waste / damage)
-- ---------------------------------------------------------------------------
CREATE TABLE contractor_material_issues (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    issue_number VARCHAR(50) NULL,
    work_package_id BIGINT NOT NULL,
    contractor_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    warehouse_id BIGINT NULL,
    issue_date DATE NOT NULL,
    -- DRAFT, ISSUED, PARTIALLY_RETURNED, RECONCILED, CANCELLED
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    issued_by_id BIGINT NULL,
    received_by VARCHAR(150) NULL,
    total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    recoverable_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cmi_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    CONSTRAINT fk_cmi_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
    CONSTRAINT fk_cmi_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_cmi_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_cmi_issued_by FOREIGN KEY (issued_by_id) REFERENCES users(id),
    CONSTRAINT uk_cmi_number UNIQUE (issue_number),
    INDEX idx_cmi_package (work_package_id),
    INDEX idx_cmi_contractor (contractor_id),
    INDEX idx_cmi_project (project_id),
    INDEX idx_cmi_date (issue_date)
);

CREATE TABLE contractor_material_issue_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    issue_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    unit VARCHAR(20) NULL,
    issued_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    returned_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    consumed_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    waste_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    damaged_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    unit_rate DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    recoverable_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cmii_issue FOREIGN KEY (issue_id) REFERENCES contractor_material_issues(id),
    CONSTRAINT fk_cmii_product FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_cmii_issue (issue_id),
    INDEX idx_cmii_product (product_id)
);

-- ---------------------------------------------------------------------------
-- Daily progress + media
-- ---------------------------------------------------------------------------
CREATE TABLE contractor_daily_progress (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_package_id BIGINT NOT NULL,
    contractor_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    progress_date DATE NOT NULL,
    work_done TEXT NULL,
    completion_percentage INT NOT NULL DEFAULT 0,
    quantity_completed DECIMAL(15,2) NULL,
    unit VARCHAR(20) NULL,
    workers_count INT NULL,
    supervisor_name VARCHAR(150) NULL,
    issues TEXT NULL,
    remarks TEXT NULL,
    weather VARCHAR(50) NULL,
    -- SUBMITTED, VERIFIED, REJECTED
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    reported_by_id BIGINT NULL,
    verified_by_id BIGINT NULL,
    verified_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cdp_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    CONSTRAINT fk_cdp_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
    CONSTRAINT fk_cdp_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_cdp_reported_by FOREIGN KEY (reported_by_id) REFERENCES users(id),
    CONSTRAINT fk_cdp_verified_by FOREIGN KEY (verified_by_id) REFERENCES users(id),
    INDEX idx_cdp_package (work_package_id),
    INDEX idx_cdp_project_date (project_id, progress_date),
    INDEX idx_cdp_date (progress_date)
);

CREATE TABLE contractor_progress_media (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    progress_id BIGINT NULL,
    inspection_id BIGINT NULL,
    media_type VARCHAR(20) NOT NULL DEFAULT 'PHOTO',
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NULL,
    caption VARCHAR(500) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cpm_progress FOREIGN KEY (progress_id) REFERENCES contractor_daily_progress(id),
    INDEX idx_cpm_progress (progress_id),
    INDEX idx_cpm_inspection (inspection_id)
);

-- ---------------------------------------------------------------------------
-- Quality inspection
-- ---------------------------------------------------------------------------
CREATE TABLE contractor_quality_inspections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inspection_number VARCHAR(50) NULL,
    work_package_id BIGINT NOT NULL,
    contractor_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    inspection_date DATE NOT NULL,
    inspection_type VARCHAR(50) NULL,
    -- PENDING, PASS, FAIL, REWORK, APPROVED
    result VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    score INT NULL,
    checklist TEXT NULL,
    observations TEXT NULL,
    defects TEXT NULL,
    corrective_action TEXT NULL,
    rework_due_date DATE NULL,
    inspected_by_id BIGINT NULL,
    approved_by_id BIGINT NULL,
    approved_at DATETIME NULL,
    comments TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cqi_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    CONSTRAINT fk_cqi_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
    CONSTRAINT fk_cqi_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_cqi_inspected_by FOREIGN KEY (inspected_by_id) REFERENCES users(id),
    CONSTRAINT fk_cqi_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id),
    CONSTRAINT uk_cqi_number UNIQUE (inspection_number),
    INDEX idx_cqi_package (work_package_id),
    INDEX idx_cqi_project (project_id),
    INDEX idx_cqi_result (result)
);

ALTER TABLE contractor_progress_media
    ADD CONSTRAINT fk_cpm_inspection FOREIGN KEY (inspection_id) REFERENCES contractor_quality_inspections(id);

-- ---------------------------------------------------------------------------
-- Work package change request (BOQ variation -> extra work / reduced scope)
-- ---------------------------------------------------------------------------
CREATE TABLE work_package_changes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    change_number VARCHAR(50) NULL,
    work_package_id BIGINT NOT NULL,
    project_change_request_id BIGINT NULL,
    -- ADDITIONAL_WORK, REDUCED_SCOPE, RATE_REVISION, TIME_EXTENSION
    change_type VARCHAR(30) NOT NULL,
    description TEXT NULL,
    reason TEXT NULL,
    cost_impact DECIMAL(15,2) NOT NULL DEFAULT 0,
    quantity_impact DECIMAL(15,2) NULL,
    days_extension INT NULL,
    revised_end_date DATE NULL,
    -- PENDING, APPROVED, REJECTED
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    requested_by_id BIGINT NULL,
    approved_by_id BIGINT NULL,
    approved_at DATETIME NULL,
    rejection_reason TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_wpc_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    CONSTRAINT fk_wpc_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id),
    CONSTRAINT fk_wpc_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id),
    CONSTRAINT uk_wpc_number UNIQUE (change_number),
    INDEX idx_wpc_package (work_package_id),
    INDEX idx_wpc_status (status)
);

-- ---------------------------------------------------------------------------
-- Contractor bill: work done -> gross -> deductions/retention/penalty -> tax -> net
-- ---------------------------------------------------------------------------
CREATE TABLE contractor_bills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bill_number VARCHAR(50) NULL,
    contractor_id BIGINT NOT NULL,
    work_package_id BIGINT NULL,
    project_id BIGINT NOT NULL,
    -- ADVANCE, RUNNING, FINAL
    bill_type VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
    bill_date DATE NOT NULL,
    period_from DATE NULL,
    period_to DATE NULL,
    contractor_invoice_number VARCHAR(100) NULL,
    work_completed_percentage INT NULL,
    gross_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    material_deduction DECIMAL(15,2) NOT NULL DEFAULT 0,
    advance_adjustment DECIMAL(15,2) NOT NULL DEFAULT 0,
    penalty_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    other_deduction DECIMAL(15,2) NOT NULL DEFAULT 0,
    retention_percentage DECIMAL(5,2) NULL,
    retention_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    taxable_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    gst_percentage DECIMAL(5,2) NULL,
    gst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tds_percentage DECIMAL(5,2) NULL,
    tds_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    -- DRAFT, SUBMITTED, ENGINEER_APPROVED, PM_APPROVED, FINANCE_APPROVED,
    -- PARTIALLY_PAID, PAID, REJECTED, CANCELLED
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    current_approval_stage VARCHAR(30) NULL,
    submitted_by_id BIGINT NULL,
    submitted_at DATETIME NULL,
    measurement_notes TEXT NULL,
    remarks TEXT NULL,
    attachment_url VARCHAR(500) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cb_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
    CONSTRAINT fk_cb_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    CONSTRAINT fk_cb_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_cb_submitted_by FOREIGN KEY (submitted_by_id) REFERENCES users(id),
    CONSTRAINT uk_cb_number UNIQUE (bill_number),
    INDEX idx_cb_contractor (contractor_id),
    INDEX idx_cb_project (project_id),
    INDEX idx_cb_status (status),
    INDEX idx_cb_date (bill_date)
);

CREATE TABLE contractor_bill_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bill_id BIGINT NOT NULL,
    work_package_item_id BIGINT NULL,
    description VARCHAR(500) NOT NULL,
    unit VARCHAR(20) NULL,
    quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    previously_billed_quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
    rate DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    measurement_details TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cbi_bill FOREIGN KEY (bill_id) REFERENCES contractor_bills(id),
    CONSTRAINT fk_cbi_wp_item FOREIGN KEY (work_package_item_id) REFERENCES work_package_items(id),
    INDEX idx_cbi_bill (bill_id)
);

-- Approval chain: Site Engineer -> Project Manager -> Finance
CREATE TABLE contractor_bill_approvals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bill_id BIGINT NOT NULL,
    stage VARCHAR(30) NOT NULL,
    sequence INT NOT NULL DEFAULT 1,
    -- PENDING, APPROVED, REJECTED
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    approver_id BIGINT NULL,
    acted_at DATETIME NULL,
    approved_amount DECIMAL(15,2) NULL,
    comments TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_cba_bill FOREIGN KEY (bill_id) REFERENCES contractor_bills(id),
    CONSTRAINT fk_cba_approver FOREIGN KEY (approver_id) REFERENCES users(id),
    INDEX idx_cba_bill (bill_id),
    INDEX idx_cba_status (status)
);

-- ---------------------------------------------------------------------------
-- Contractor payments: link to bill/package + typing and approval
-- ---------------------------------------------------------------------------
ALTER TABLE contractor_payments ADD COLUMN contractor_bill_id BIGINT NULL;
ALTER TABLE contractor_payments ADD COLUMN work_package_id BIGINT NULL;
-- ADVANCE, RUNNING_BILL, FINAL_BILL, RETENTION_RELEASE
ALTER TABLE contractor_payments ADD COLUMN payment_type VARCHAR(30) NOT NULL DEFAULT 'RUNNING_BILL';
ALTER TABLE contractor_payments ADD COLUMN payment_mode VARCHAR(30) NULL;
ALTER TABLE contractor_payments ADD COLUMN transaction_reference VARCHAR(150) NULL;
ALTER TABLE contractor_payments ADD COLUMN tds_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE contractor_payments ADD COLUMN approved_by_id BIGINT NULL;
ALTER TABLE contractor_payments ADD COLUMN approved_at DATETIME NULL;
ALTER TABLE contractor_payments ADD COLUMN paid_by_id BIGINT NULL;
ALTER TABLE contractor_payments ADD COLUMN remarks TEXT NULL;
ALTER TABLE contractor_payments ADD CONSTRAINT fk_ctp_bill FOREIGN KEY (contractor_bill_id) REFERENCES contractor_bills(id);
ALTER TABLE contractor_payments ADD CONSTRAINT fk_ctp_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id);
ALTER TABLE contractor_payments ADD CONSTRAINT fk_ctp_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id);
ALTER TABLE contractor_payments ADD CONSTRAINT fk_ctp_paid_by FOREIGN KEY (paid_by_id) REFERENCES users(id);
-- contractor_id is already indexed by its own foreign key; only status needs a new index.
ALTER TABLE contractor_payments ADD INDEX idx_ctp_status (status);

-- ---------------------------------------------------------------------------
-- Contractor ledger: one immutable row per financial event.
-- Mirrors customer_ledger_entries — running/closing balances are computed, never stored.
-- ---------------------------------------------------------------------------
CREATE TABLE contractor_ledger_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contractor_id BIGINT NOT NULL,
    project_id BIGINT NULL,
    work_package_id BIGINT NULL,
    entry_date DATE NOT NULL,
    -- OPENING, BILL, PAYMENT, ADVANCE, RETENTION_HELD, RETENTION_RELEASED,
    -- MATERIAL_RECOVERY, PENALTY, REVERSAL
    entry_type VARCHAR(30) NOT NULL,
    reference_type VARCHAR(30) NULL,
    reference_id BIGINT NULL,
    reference_number VARCHAR(50) NULL,
    description VARCHAR(500) NULL,
    debit DECIMAL(15,2) NOT NULL DEFAULT 0,
    credit DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    -- fk_conle_* not fk_cle_*: InnoDB foreign key names are database-global, and V9 already
    -- used fk_cle_project / fk_cle_customer for customer_ledger_entries.
    CONSTRAINT fk_conle_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
    CONSTRAINT fk_conle_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_conle_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    INDEX idx_conle_contractor (contractor_id),
    INDEX idx_conle_date (entry_date),
    INDEX idx_conle_ref (reference_type, reference_id)
);

-- ---------------------------------------------------------------------------
-- Attendance: labour deployment per work package per day
-- ---------------------------------------------------------------------------
ALTER TABLE contractor_attendance ADD COLUMN work_package_id BIGINT NULL;
ALTER TABLE contractor_attendance ADD COLUMN project_id BIGINT NULL;
ALTER TABLE contractor_attendance ADD COLUMN workers_count INT NULL;
ALTER TABLE contractor_attendance ADD COLUMN skilled_count INT NULL;
ALTER TABLE contractor_attendance ADD COLUMN unskilled_count INT NULL;
ALTER TABLE contractor_attendance ADD COLUMN supervisor_name VARCHAR(150) NULL;
ALTER TABLE contractor_attendance ADD COLUMN in_time TIME NULL;
ALTER TABLE contractor_attendance ADD COLUMN out_time TIME NULL;
ALTER TABLE contractor_attendance ADD COLUMN remarks TEXT NULL;
ALTER TABLE contractor_attendance ADD COLUMN recorded_by_id BIGINT NULL;
ALTER TABLE contractor_attendance ADD CONSTRAINT fk_cat_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id);
ALTER TABLE contractor_attendance ADD CONSTRAINT fk_cat_project FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE contractor_attendance ADD CONSTRAINT fk_cat_recorded_by FOREIGN KEY (recorded_by_id) REFERENCES users(id);
ALTER TABLE contractor_attendance ADD INDEX idx_cat_date (date);
ALTER TABLE contractor_attendance ADD INDEX idx_cat_package (work_package_id);

-- ---------------------------------------------------------------------------
-- Safety: PPE compliance, checklist, incidents, violations
-- ---------------------------------------------------------------------------
CREATE TABLE contractor_safety_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contractor_id BIGINT NOT NULL,
    work_package_id BIGINT NULL,
    project_id BIGINT NOT NULL,
    record_date DATE NOT NULL,
    -- PPE_CHECK, SAFETY_CHECKLIST, INCIDENT, VIOLATION
    record_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NULL,
    ppe_compliant BIT NOT NULL DEFAULT 1,
    checklist TEXT NULL,
    description TEXT NULL,
    action_taken TEXT NULL,
    penalty_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    photo_url VARCHAR(500) NULL,
    -- OPEN, CLOSED
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    recorded_by_id BIGINT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_csr_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
    CONSTRAINT fk_csr_package FOREIGN KEY (work_package_id) REFERENCES contractor_work_packages(id),
    CONSTRAINT fk_csr_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_csr_recorded_by FOREIGN KEY (recorded_by_id) REFERENCES users(id),
    INDEX idx_csr_contractor (contractor_id),
    INDEX idx_csr_project (project_id),
    INDEX idx_csr_type (record_type)
);

-- ---------------------------------------------------------------------------
-- Contractor <-> project link table gets a status vocabulary aligned with packages
-- ---------------------------------------------------------------------------
ALTER TABLE contractor_projects ADD COLUMN trade VARCHAR(50) NULL;
ALTER TABLE contractor_projects ADD INDEX idx_cp_contractor (contractor_id);
ALTER TABLE contractor_projects ADD INDEX idx_cp_project (project_id);

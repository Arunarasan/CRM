-- Task Completion & Automatic Progress Calculation.
--
-- The Work Item (project_room_items) is the smallest execution unit and the ONLY level a
-- user edits by hand. Room -> Phase -> Project progress is rolled up automatically by
-- ProjectService (incremental: only the affected room, phase and project are recomputed).
--
-- Hierarchy in this schema is Project -> Phase -> Room -> Item. "Floor" is not an entity;
-- it is project_rooms.floor_name, so floor progress is grouped/computed on read, not stored.
-- "Delayed" is likewise derived on read (today > planned_end_date AND not completed), never
-- written into the status column.

-- ---------------------------------------------------------------------------
-- Work Item: progress %, lifecycle dates, assignments, photos, completion lock
-- ---------------------------------------------------------------------------
ALTER TABLE project_room_items ADD COLUMN progress INT NOT NULL DEFAULT 0;
ALTER TABLE project_room_items ADD COLUMN planned_start_date DATE NULL;
ALTER TABLE project_room_items ADD COLUMN planned_end_date DATE NULL;
ALTER TABLE project_room_items ADD COLUMN actual_start_date DATE NULL;
ALTER TABLE project_room_items ADD COLUMN completed_date DATE NULL;
ALTER TABLE project_room_items ADD COLUMN assigned_employee_id BIGINT NULL;
ALTER TABLE project_room_items ADD COLUMN assigned_contractor_id BIGINT NULL;
-- JSON array of uploaded photo URLs (matches the codebase's upload-then-store-URL convention).
ALTER TABLE project_room_items ADD COLUMN photos TEXT NULL;
-- Set true once the item hits 100%/COMPLETED; only a Manager/Admin reopen clears it.
ALTER TABLE project_room_items ADD COLUMN locked BIT NOT NULL DEFAULT 0;

ALTER TABLE project_room_items
    ADD CONSTRAINT fk_pri_employee FOREIGN KEY (assigned_employee_id) REFERENCES users(id);
ALTER TABLE project_room_items
    ADD CONSTRAINT fk_pri_contractor FOREIGN KEY (assigned_contractor_id) REFERENCES contractors(id);
CREATE INDEX idx_pri_employee ON project_room_items (assigned_employee_id);
CREATE INDEX idx_pri_status ON project_room_items (status);

-- ---------------------------------------------------------------------------
-- Room / Phase / Project: completion status + timestamps (all auto-maintained)
-- ---------------------------------------------------------------------------
-- project_rooms had no status column before; it is required for auto room completion.
ALTER TABLE project_rooms ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING';
ALTER TABLE project_rooms ADD COLUMN completed_date DATE NULL;

ALTER TABLE project_phases ADD COLUMN completed_date DATE NULL;

ALTER TABLE projects ADD COLUMN total_duration_days INT NULL;

-- ---------------------------------------------------------------------------
-- Daily Progress Timeline + Audit Log (one immutable row per progress/status change)
-- ---------------------------------------------------------------------------
CREATE TABLE project_item_progress_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    -- ASSIGNED, STARTED, PROGRESS_UPDATED, STATUS_CHANGED, COMPLETED, REOPENED, INSPECTION, etc.
    event_type VARCHAR(50) NOT NULL,
    old_progress INT NULL,
    new_progress INT NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NULL,
    remarks TEXT NULL,
    photos TEXT NULL,
    log_time DATETIME NOT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_pipl_item FOREIGN KEY (item_id) REFERENCES project_room_items(id),
    CONSTRAINT fk_pipl_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_pipl_item (item_id),
    INDEX idx_pipl_time (log_time)
);

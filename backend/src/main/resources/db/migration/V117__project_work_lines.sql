-- Project work tracking by Category → Product.
--
-- A project now carries two shared tasks: "Project Execution" (get every product ready and to the site)
-- and "Installation" (category-wise fitting work, logged day by day). Both are driven by the approved
-- quotation's Category → Product lines:
--
--   project_work_lines       one row per quoted product line (category, product, colour, qty, photo)
--   project_work_line_steps  the steps that line goes through: MATERIAL (auto from purchase orders when a
--                            PO covers the product, else a manual tick), MANUFACTURE, STITCHING, and
--                            DELIVERY (DIRECT supplier → site, or PICKUP team collects → site)
--   project_work_events      step history (who / when / photo / note) for the execution report
--   project_install_categories + project_install_steps
--                            the per-category installation checklist and its % bar
--   project_task_daily_logs  "done today / plan for tomorrow" entries with photos and voice
--
-- Task messages reuse task_comments (text + voice already) and gain a photo and an optional product /
-- category tag. Inventory categories get default work steps and an installation checklist template.

CREATE TABLE project_work_lines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    quotation_item_id BIGINT NULL,
    boq_item_id BIGINT NULL,
    category VARCHAR(150) NOT NULL,
    product_id BIGINT NULL,
    item_name VARCHAR(255) NOT NULL,
    color VARCHAR(100) NULL,
    location VARCHAR(255) NULL,
    quantity DECIMAL(15,3) NULL,
    unit VARCHAR(30) NULL,
    image_url VARCHAR(500) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    active BIT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_work_line_project FOREIGN KEY (project_id) REFERENCES projects (id)
);
CREATE INDEX idx_work_line_project ON project_work_lines (project_id);

CREATE TABLE project_work_line_steps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_line_id BIGINT NOT NULL,
    step_type VARCHAR(20) NOT NULL,              -- MATERIAL, MANUFACTURE, STITCHING, DELIVERY
    sort_order INT NOT NULL DEFAULT 0,
    percent INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, DONE
    delivery_route VARCHAR(10) NULL,             -- DIRECT, PICKUP (DELIVERY step only)
    delivery_stage VARCHAR(20) NULL,             -- DISPATCHED / PICKED_UP / ON_THE_WAY / AT_SITE
    pickup_from VARCHAR(255) NULL,
    note VARCHAR(500) NULL,
    photo_url VARCHAR(500) NULL,
    updated_by_name VARCHAR(150) NULL,
    done_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_work_step_line FOREIGN KEY (work_line_id) REFERENCES project_work_lines (id)
);
CREATE INDEX idx_work_step_line ON project_work_line_steps (work_line_id);

CREATE TABLE project_work_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    work_line_id BIGINT NULL,
    step_id BIGINT NULL,
    install_category_id BIGINT NULL,
    step_type VARCHAR(20) NULL,
    action VARCHAR(40) NOT NULL,
    percent INT NULL,
    note VARCHAR(500) NULL,
    photo_url VARCHAR(500) NULL,
    actor_id BIGINT NULL,
    actor_name VARCHAR(150) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0
);
CREATE INDEX idx_work_event_project ON project_work_events (project_id);
CREATE INDEX idx_work_event_line ON project_work_events (work_line_id);

CREATE TABLE project_install_categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    category VARCHAR(150) NOT NULL,
    manual_percent INT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    active BIT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_install_cat_project FOREIGN KEY (project_id) REFERENCES projects (id)
);
CREATE INDEX idx_install_cat_project ON project_install_categories (project_id);

CREATE TABLE project_install_steps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    install_category_id BIGINT NOT NULL,
    content VARCHAR(255) NOT NULL,
    done BIT(1) NOT NULL DEFAULT 0,
    done_by_name VARCHAR(150) NULL,
    done_at DATETIME NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_install_step_cat FOREIGN KEY (install_category_id) REFERENCES project_install_categories (id)
);
CREATE INDEX idx_install_step_cat ON project_install_steps (install_category_id);

CREATE TABLE project_task_daily_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    log_date DATE NOT NULL,
    work_done TEXT NULL,
    tomorrow_plan TEXT NULL,
    percent_before INT NULL,
    percent_after INT NULL,
    photos TEXT NULL,          -- newline-separated uploaded photo URLs
    audio_url VARCHAR(500) NULL,
    author_id BIGINT NULL,
    author_name VARCHAR(150) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_task_daily_log_task FOREIGN KEY (task_id) REFERENCES tasks (id)
);
CREATE INDEX idx_task_daily_log_task ON project_task_daily_logs (task_id);
CREATE INDEX idx_task_daily_log_project ON project_task_daily_logs (project_id);

-- Team messages: photo + optional product / category tag.
ALTER TABLE task_comments
    ADD COLUMN image_url VARCHAR(500) NULL,
    ADD COLUMN work_line_id BIGINT NULL,
    ADD COLUMN tag_label VARCHAR(255) NULL;

-- Category defaults: which work steps its products need, and its installation checklist.
ALTER TABLE inventory_categories
    ADD COLUMN work_steps VARCHAR(100) NULL,   -- e.g. "MATERIAL,STITCHING,DELIVERY"
    ADD COLUMN install_steps TEXT NULL;        -- one checklist line per row

-- The second shared project task: Installation. It is the closing task now — the team submits it and
-- an admin approves (project → 100% / COMPLETED), so Project Execution closes on its own once every
-- product is at site. V46 already created a TT_PM_INSTALLATION template in the same PROJECT_MAIN phase
-- (soft-deleted by V90, code is unique) — revive and redefine it; insert only where it never existed.
UPDATE task_templates
SET is_deleted = 0,
    deleted_at = NULL,
    name = 'Installation',
    description = 'Category-wise installation at site. Tick the installation checklist, post what was done today and the plan for tomorrow, and keep the team chat with photos and voice notes.',
    order_index = 2,
    assignment_type = 'TEAM',
    completion_rule = 'OWNER_APPROVAL',
    eligible_roles = 'Supervisor,Project',
    priority = 'HIGH',
    due_offset_days = 14,
    due_basis = 'CREATION',
    updated_at = NOW(6)
WHERE code = 'TT_PM_INSTALLATION';

INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority, due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id,
       'Installation', 'TT_PM_INSTALLATION',
       'Category-wise installation at site. Tick the installation checklist, post what was done today and the plan for tomorrow, and keep the team chat with photos and voice notes.',
       2, 'TEAM', 'OWNER_APPROVAL', 'Supervisor,Project', 'HIGH', 14, 'CREATION'
FROM workflow_phases p
JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'PROJECT_MAIN'
WHERE p.code = 'PROJECT_MAIN_TASKS'
  AND NOT EXISTS (SELECT 1 FROM task_templates x WHERE x.code = 'TT_PM_INSTALLATION');

UPDATE task_templates
SET completion_rule = 'ANY_PARTICIPANT',
    description = 'Get every product ready and to the site: material (from purchase orders where they exist), manufacturing, stitching and delivery — direct from the supplier or picked up by the team. Post photos, voice notes and messages for the team.',
    updated_at = NOW(6)
WHERE code = 'TT_PM_EXECUTION';

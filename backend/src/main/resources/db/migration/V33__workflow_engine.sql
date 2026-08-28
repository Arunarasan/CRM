-- Workflow & Task Automation Engine — Increment 1 (foundation).
--
-- Adds a DB-driven workflow template engine that sits ABOVE the existing Task /
-- TaskAssignment substrate (nothing in those tables is rebuilt). Purely additive
-- except for relaxing tasks.project_id to nullable so pre-project (lead-stage)
-- workflow tasks can exist. Every existing task row is preserved and back-filled
-- with source='MANUAL' so current manual/desktop/execution tasks keep working.
--
-- Model:
--   workflow_templates ── workflow_phases ── task_templates ── task_template_dependencies
--   workflow_instances ── workflow_phase_instances
--   tasks (extended) links back to instance / phase-instance / template + subject rows
--
-- Seed: one default LEAD workflow so "create lead → first task auto-generated →
-- complete → next task unlocks" works out of the box. The PROJECT workflow template
-- is seeded in a later increment.

-- ---------------------------------------------------------------- template layer

CREATE TABLE workflow_templates (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    created_at   DATETIME(6),
    created_by   VARCHAR(255),
    deleted_at   DATETIME(6),
    deleted_by   VARCHAR(255),
    is_deleted   BIT          NOT NULL,
    updated_at   DATETIME(6),
    updated_by   VARCHAR(255),
    version      BIGINT,
    name         VARCHAR(150) NOT NULL,
    code         VARCHAR(80)  NOT NULL,
    description  TEXT,
    scope        VARCHAR(20)  NOT NULL,          -- LEAD | PROJECT
    lead_type    VARCHAR(80),
    project_type VARCHAR(80),
    active       BIT          NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    CONSTRAINT uq_workflow_template_code UNIQUE (code)
) ENGINE=InnoDB;

CREATE TABLE workflow_phases (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    created_at  DATETIME(6),
    created_by  VARCHAR(255),
    deleted_at  DATETIME(6),
    deleted_by  VARCHAR(255),
    is_deleted  BIT          NOT NULL,
    updated_at  DATETIME(6),
    updated_by  VARCHAR(255),
    version     BIGINT,
    template_id BIGINT       NOT NULL,
    name        VARCHAR(150) NOT NULL,
    code        VARCHAR(80)  NOT NULL,
    order_index INT          NOT NULL DEFAULT 0,
    required    BIT          NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    CONSTRAINT uq_workflow_phase_code UNIQUE (template_id, code),
    CONSTRAINT fk_workflow_phase_template FOREIGN KEY (template_id) REFERENCES workflow_templates (id)
) ENGINE=InnoDB;

CREATE TABLE task_templates (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    created_at      DATETIME(6),
    created_by      VARCHAR(255),
    deleted_at      DATETIME(6),
    deleted_by      VARCHAR(255),
    is_deleted      BIT          NOT NULL,
    updated_at      DATETIME(6),
    updated_by      VARCHAR(255),
    version         BIGINT,
    phase_id        BIGINT       NOT NULL,
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(100) NOT NULL,
    description     TEXT,
    order_index     INT          NOT NULL DEFAULT 0,
    assignment_type VARCHAR(20)  NOT NULL DEFAULT 'SINGLE_EMPLOYEE',  -- SINGLE_EMPLOYEE | MULTIPLE_EMPLOYEES | TEAM
    completion_rule VARCHAR(30)  NOT NULL DEFAULT 'OWNER_APPROVAL',   -- OWNER_APPROVAL | ALL_PARTICIPANTS | ANY_PARTICIPANT
    eligible_roles  VARCHAR(255),
    eligible_skills VARCHAR(255),
    priority        VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    estimated_hours FLOAT(53),
    due_offset_days INT,
    due_basis       VARCHAR(30)  DEFAULT 'CREATION',                  -- CREATION | PREV_COMPLETION | PHASE_START
    PRIMARY KEY (id),
    CONSTRAINT uq_task_template_code UNIQUE (code),
    CONSTRAINT fk_task_template_phase FOREIGN KEY (phase_id) REFERENCES workflow_phases (id)
) ENGINE=InnoDB;

CREATE TABLE task_template_dependencies (
    task_template_id       BIGINT NOT NULL,
    depends_on_template_id BIGINT NOT NULL,
    PRIMARY KEY (task_template_id, depends_on_template_id),
    CONSTRAINT fk_ttd_task    FOREIGN KEY (task_template_id)       REFERENCES task_templates (id),
    CONSTRAINT fk_ttd_depends FOREIGN KEY (depends_on_template_id) REFERENCES task_templates (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- instance layer

CREATE TABLE workflow_instances (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    created_at   DATETIME(6),
    created_by   VARCHAR(255),
    deleted_at   DATETIME(6),
    deleted_by   VARCHAR(255),
    is_deleted   BIT         NOT NULL,
    updated_at   DATETIME(6),
    updated_by   VARCHAR(255),
    version      BIGINT,
    template_id  BIGINT      NOT NULL,
    scope        VARCHAR(20) NOT NULL,           -- LEAD | PROJECT
    lead_id      BIGINT,
    project_id   BIGINT,
    status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | COMPLETED | CANCELLED
    started_at   DATETIME(6),
    completed_at DATETIME(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_workflow_instance_template FOREIGN KEY (template_id) REFERENCES workflow_templates (id)
) ENGINE=InnoDB;
CREATE INDEX idx_workflow_instance_lead    ON workflow_instances (lead_id);
CREATE INDEX idx_workflow_instance_project ON workflow_instances (project_id);

CREATE TABLE workflow_phase_instances (
    id                   BIGINT      NOT NULL AUTO_INCREMENT,
    created_at           DATETIME(6),
    created_by           VARCHAR(255),
    deleted_at           DATETIME(6),
    deleted_by           VARCHAR(255),
    is_deleted           BIT         NOT NULL,
    updated_at           DATETIME(6),
    updated_by           VARCHAR(255),
    version              BIGINT,
    workflow_instance_id BIGINT      NOT NULL,
    phase_id             BIGINT      NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'PENDING',   -- PENDING | ACTIVE | COMPLETED | SKIPPED
    progress             INT         NOT NULL DEFAULT 0,
    started_at           DATETIME(6),
    completed_at         DATETIME(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_wpi_instance FOREIGN KEY (workflow_instance_id) REFERENCES workflow_instances (id),
    CONSTRAINT fk_wpi_phase    FOREIGN KEY (phase_id)             REFERENCES workflow_phases (id)
) ENGINE=InnoDB;
CREATE INDEX idx_wpi_instance ON workflow_phase_instances (workflow_instance_id);

-- ---------------------------------------------------------------- extend tasks

ALTER TABLE tasks MODIFY COLUMN project_id BIGINT NULL;

ALTER TABLE tasks
    ADD COLUMN source                     VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN completion_rule            VARCHAR(30),
    ADD COLUMN assignment_type            VARCHAR(20),
    ADD COLUMN eligible_roles             VARCHAR(255),
    ADD COLUMN eligible_skills            VARCHAR(255),
    ADD COLUMN task_template_id           BIGINT,
    ADD COLUMN workflow_instance_id       BIGINT,
    ADD COLUMN workflow_phase_instance_id BIGINT,
    ADD COLUMN lead_id                    BIGINT,
    ADD COLUMN customer_id                BIGINT,
    ADD COLUMN site_visit_id              BIGINT,
    ADD COLUMN measurement_id             BIGINT,
    ADD COLUMN boq_id                     BIGINT,
    ADD COLUMN quotation_id               BIGINT;

-- Existing rows already default to MANUAL via the column default; be explicit for safety.
UPDATE tasks SET source = 'MANUAL' WHERE source IS NULL;

CREATE INDEX idx_task_workflow_instance ON tasks (workflow_instance_id);
CREATE INDEX idx_task_lead              ON tasks (lead_id);
CREATE INDEX idx_task_source            ON tasks (source);

-- ---------------------------------------------------------------- seed: default LEAD workflow

INSERT INTO workflow_templates (created_at, is_deleted, version, name, code, description, scope, active)
VALUES (NOW(6), 0, 0, 'Default Lead Workflow', 'LEAD_DEFAULT',
        'Standard lead lifecycle: qualification → site visit → measurement → BOQ → quotation.', 'LEAD', 1);

-- Phases
INSERT INTO workflow_phases (created_at, is_deleted, version, template_id, name, code, order_index, required)
SELECT NOW(6), 0, 0, t.id, x.name, x.code, x.order_index, 1
FROM workflow_templates t
JOIN (
    SELECT 'Lead Qualification' AS name, 'LEAD_QUALIFICATION' AS code, 1 AS order_index
    UNION ALL SELECT 'Site Visit',       'LEAD_SITE_VISIT',   2
    UNION ALL SELECT 'Measurement',      'LEAD_MEASUREMENT',  3
    UNION ALL SELECT 'BOQ',              'LEAD_BOQ',          4
    UNION ALL SELECT 'Quotation',        'LEAD_QUOTATION',    5
) x
WHERE t.code = 'LEAD_DEFAULT';

-- Task templates
INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority, due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id, x.name, x.code, x.description, x.order_index,
       'SINGLE_EMPLOYEE', 'OWNER_APPROVAL', x.eligible_roles, x.priority, x.due_offset_days, 'CREATION'
FROM workflow_phases p
JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
JOIN (
    SELECT 'LEAD_QUALIFICATION' AS phase_code, 'Review New Lead'              AS name, 'TT_REVIEW_LEAD'      AS code, 'Review the newly created lead and its details.'          AS description, 1 AS order_index, 'Sales'              AS eligible_roles, 'HIGH'   AS priority, 0 AS due_offset_days
    UNION ALL SELECT 'LEAD_QUALIFICATION', 'Contact Customer',        'TT_CONTACT_CUSTOMER',   'Reach out to the customer and introduce.',              2, 'Sales',              'HIGH',   1
    UNION ALL SELECT 'LEAD_QUALIFICATION', 'Understand Requirement',  'TT_UNDERSTAND_REQ',     'Capture the customer requirement and scope.',           3, 'Sales',              'MEDIUM', 2
    UNION ALL SELECT 'LEAD_QUALIFICATION', 'Qualify Lead',            'TT_QUALIFY_LEAD',       'Decide whether the lead is qualified to proceed.',      4, 'Sales',              'MEDIUM', 2
    UNION ALL SELECT 'LEAD_SITE_VISIT',    'Schedule Site Visit',     'TT_SCHEDULE_VISIT',     'Arrange a site visit with the customer.',               1, 'Sales,Site',         'MEDIUM', 1
    UNION ALL SELECT 'LEAD_SITE_VISIT',    'Conduct Site Visit',      'TT_CONDUCT_VISIT',      'Visit the site, record observations and photos.',       2, 'Site',               'MEDIUM', 2
    UNION ALL SELECT 'LEAD_MEASUREMENT',   'Measure Site',            'TT_MEASURE_SITE',       'Take site measurements and upload them.',               1, 'Measurement,Site',   'MEDIUM', 1
    UNION ALL SELECT 'LEAD_BOQ',           'Prepare BOQ',             'TT_PREPARE_BOQ',        'Prepare the BOQ from the measurement.',                 1, 'Estimation,Project', 'MEDIUM', 2
    UNION ALL SELECT 'LEAD_QUOTATION',     'Generate Quotation',      'TT_GENERATE_QUOTE',     'Generate the quotation from the finalized BOQ.',        1, 'Sales,Estimation',   'HIGH',   1
    UNION ALL SELECT 'LEAD_QUOTATION',     'Send Quotation',          'TT_SEND_QUOTE',         'Send the quotation to the customer.',                   2, 'Sales',              'HIGH',   1
    UNION ALL SELECT 'LEAD_QUOTATION',     'Quotation Follow-up',     'TT_FOLLOWUP_QUOTE',     'Follow up, negotiate and secure approval.',             3, 'Sales',              'HIGH',   2
) x ON x.phase_code = p.code;

-- Intra-phase dependencies (each unlocks the next within its phase). The derived table comes first
-- so both self-joins onto task_templates can resolve their ON clauses (MySQL evaluates left to right).
INSERT INTO task_template_dependencies (task_template_id, depends_on_template_id)
SELECT a.id, b.id
FROM (
    SELECT 'TT_CONTACT_CUSTOMER' AS code, 'TT_REVIEW_LEAD'     AS dep
    UNION ALL SELECT 'TT_UNDERSTAND_REQ',  'TT_CONTACT_CUSTOMER'
    UNION ALL SELECT 'TT_QUALIFY_LEAD',    'TT_UNDERSTAND_REQ'
    UNION ALL SELECT 'TT_CONDUCT_VISIT',   'TT_SCHEDULE_VISIT'
    UNION ALL SELECT 'TT_SEND_QUOTE',      'TT_GENERATE_QUOTE'
    UNION ALL SELECT 'TT_FOLLOWUP_QUOTE',  'TT_SEND_QUOTE'
) x
JOIN task_templates a ON a.code = x.code
JOIN task_templates b ON b.code = x.dep;

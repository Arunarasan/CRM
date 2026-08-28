-- Workflow chaining (Increment 3): seed the default PROJECT workflow template.
-- Instantiated automatically when a quotation is converted to a project. Provides the coordination
-- tasks (setup → planning → procurement → execution → quality → handover → billing → closure);
-- the concrete execution tasks continue to come from the BOQ (ProjectService.generateFromBoq).
-- Purely a data seed — no schema change (the engine tables were created in V33).

INSERT INTO workflow_templates (created_at, is_deleted, version, name, code, description, scope, active)
VALUES (NOW(6), 0, 0, 'Default Project Workflow', 'PROJECT_DEFAULT',
        'Standard project lifecycle from setup to closure.', 'PROJECT', 1);

-- Phases
INSERT INTO workflow_phases (created_at, is_deleted, version, template_id, name, code, order_index, required)
SELECT NOW(6), 0, 0, t.id, x.name, x.code, x.order_index, 1
FROM workflow_templates t
JOIN (
    SELECT 'Project Setup' AS name, 'PROJECT_SETUP'       AS code, 1 AS order_index
    UNION ALL SELECT 'Planning',     'PROJECT_PLANNING',    2
    UNION ALL SELECT 'Procurement',  'PROJECT_PROCUREMENT', 3
    UNION ALL SELECT 'Execution',    'PROJECT_EXECUTION',   4
    UNION ALL SELECT 'Quality',      'PROJECT_QUALITY',     5
    UNION ALL SELECT 'Handover',     'PROJECT_HANDOVER',    6
    UNION ALL SELECT 'Billing',      'PROJECT_BILLING',     7
    UNION ALL SELECT 'Closure',      'PROJECT_CLOSURE',     8
) x
WHERE t.code = 'PROJECT_DEFAULT';

-- Task templates
INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority, due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id, x.name, x.code, x.description, x.order_index,
       x.assignment_type, 'OWNER_APPROVAL', x.eligible_roles, x.priority, x.due_offset_days, 'CREATION'
FROM workflow_phases p
JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'PROJECT_DEFAULT'
JOIN (
    SELECT 'PROJECT_SETUP'       AS phase_code, 'Confirm Project Scope'            AS name, 'TT_PRJ_CONFIRM_SCOPE' AS code, 'Confirm scope, BOQ and value with the customer.'   AS description, 1 AS order_index, 'SINGLE_EMPLOYEE'    AS assignment_type, 'Project'             AS eligible_roles, 'HIGH'   AS priority, 1 AS due_offset_days
    UNION ALL SELECT 'PROJECT_SETUP',       'Project Kickoff',                 'TT_PRJ_KICKOFF',       'Kick off the project and set dates.',                2, 'SINGLE_EMPLOYEE',    'Project',            'HIGH',   2
    UNION ALL SELECT 'PROJECT_PLANNING',    'Prepare Project Schedule',        'TT_PRJ_SCHEDULE',      'Prepare the phase/room execution schedule.',         1, 'SINGLE_EMPLOYEE',    'Project',            'MEDIUM', 3
    UNION ALL SELECT 'PROJECT_PROCUREMENT', 'Plan & Request Materials',        'TT_PRJ_MATERIAL_PLAN', 'Check inventory and raise material requests.',       1, 'SINGLE_EMPLOYEE',    'Project,Purchase',   'MEDIUM', 3
    UNION ALL SELECT 'PROJECT_EXECUTION',   'Coordinate Site Execution',       'TT_PRJ_COORDINATE',    'Coordinate the execution of the work packages.',     1, 'TEAM',               'Supervisor,Project', 'MEDIUM', 7
    UNION ALL SELECT 'PROJECT_QUALITY',     'Quality Inspection',              'TT_PRJ_QUALITY',       'Inspect workmanship and record defects.',            1, 'SINGLE_EMPLOYEE',    'Supervisor',         'HIGH',   2
    UNION ALL SELECT 'PROJECT_HANDOVER',    'Customer Inspection & Handover',  'TT_PRJ_HANDOVER',      'Customer inspection, punch list and handover.',      1, 'SINGLE_EMPLOYEE',    'Project',            'HIGH',   2
    UNION ALL SELECT 'PROJECT_BILLING',     'Final Billing & Payment',         'TT_PRJ_BILLING',       'Raise final invoice and confirm payment.',           1, 'SINGLE_EMPLOYEE',    'Billing',            'HIGH',   3
    UNION ALL SELECT 'PROJECT_CLOSURE',     'Project Closure',                 'TT_PRJ_CLOSURE',       'Complete closure formalities and archive.',          1, 'SINGLE_EMPLOYEE',    'Project',            'LOW',    2
) x ON x.phase_code = p.code;

-- Intra-phase dependency: kickoff waits on scope confirmation.
INSERT INTO task_template_dependencies (task_template_id, depends_on_template_id)
SELECT a.id, b.id
FROM (SELECT 'TT_PRJ_KICKOFF' AS code, 'TT_PRJ_CONFIRM_SCOPE' AS dep) x
JOIN task_templates a ON a.code = x.code
JOIN task_templates b ON b.code = x.dep;

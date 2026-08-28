-- Auto-create the main project tasks on project creation.
--
-- Adds a new PROJECT-scope workflow template `PROJECT_MAIN` whose single phase holds the seven
-- lifecycle tasks (Plan & Design → Final Billing). Because they share one phase and carry NO
-- template dependencies, instantiating the workflow materializes ALL seven at once (all AVAILABLE),
-- so every new project shows its full main-task list immediately.
--
-- The previous coordination template `PROJECT_DEFAULT` is deactivated (not deleted) so already-
-- converted projects keep their existing workflow instances/tasks intact, while new projects pick
-- up PROJECT_MAIN (startProjectWorkflow selects the only active PROJECT template).
--
-- Every project originates from an approved quotation (QuotationService.convertToProject ->
-- WorkflowTriggerService.onProjectCreated -> startProjectWorkflow), so no code change is needed.
-- Purely a data seed — the engine tables were created in V33. Due offsets are capped at 7 days.

-- New template
INSERT INTO workflow_templates (created_at, is_deleted, version, name, code, description, scope, active)
VALUES (NOW(6), 0, 0, 'Project Main Tasks', 'PROJECT_MAIN',
        'Seven main lifecycle tasks auto-created for every new project.', 'PROJECT', 1);

-- Single phase that carries all the main tasks
INSERT INTO workflow_phases (created_at, is_deleted, version, template_id, name, code, order_index, required)
SELECT NOW(6), 0, 0, t.id, 'Main Tasks', 'PROJECT_MAIN_TASKS', 1, 1
FROM workflow_templates t
WHERE t.code = 'PROJECT_MAIN';

-- The seven main tasks (no dependencies -> all created and AVAILABLE up front)
INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority, due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id, x.name, x.code, x.description, x.order_index,
       x.assignment_type, 'OWNER_APPROVAL', x.eligible_roles, x.priority, x.due_offset_days, 'CREATION'
FROM workflow_phases p
JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'PROJECT_MAIN'
JOIN (
    SELECT 'Plan & Design'           AS name, 'TT_PM_PLAN_DESIGN'  AS code, 'Prepare the project plan and design.'                 AS description, 1 AS order_index, 'SINGLE_EMPLOYEE' AS assignment_type, 'Project,Design'      AS eligible_roles, 'HIGH'   AS priority, 2 AS due_offset_days
    UNION ALL SELECT 'Material Procurement',   'TT_PM_PROCUREMENT', 'Plan, check inventory and procure the required materials.', 2, 'SINGLE_EMPLOYEE', 'Project,Purchase',   'HIGH',   3
    UNION ALL SELECT 'Site Preparation',       'TT_PM_SITE_PREP',   'Prepare the site for execution.',                           3, 'SINGLE_EMPLOYEE', 'Supervisor,Project', 'MEDIUM', 4
    UNION ALL SELECT 'Installation',           'TT_PM_INSTALLATION','Carry out the installation / execution work.',              4, 'TEAM',            'Supervisor,Project', 'MEDIUM', 5
    UNION ALL SELECT 'Quality Check / Testing','TT_PM_QUALITY',     'Inspect workmanship, test and record defects.',             5, 'SINGLE_EMPLOYEE', 'Supervisor',         'HIGH',   6
    UNION ALL SELECT 'Handover',               'TT_PM_HANDOVER',    'Customer inspection, punch list and handover.',             6, 'SINGLE_EMPLOYEE', 'Project',            'HIGH',   7
    UNION ALL SELECT 'Final Billing',          'TT_PM_BILLING',     'Raise the final invoice and confirm payment.',              7, 'SINGLE_EMPLOYEE', 'Billing',            'HIGH',   7
) x;

-- Retire the old coordination template for new projects (existing instances keep referencing it).
UPDATE workflow_templates SET active = 0, updated_at = NOW(6) WHERE code = 'PROJECT_DEFAULT';

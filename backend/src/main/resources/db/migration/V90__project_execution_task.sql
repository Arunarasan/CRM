-- Collapse the seven project "main tasks" into ONE shared "Project Execution" task per project.
--
-- The team wanted a single, collaborative task on the board instead of a pile of per-lifecycle /
-- per-BOQ-item tasks: anyone eligible picks it, the rest Join, and it carries just a progress bar
-- (manual %), a work checklist (seeded from the BOQ items), an activity log and a shared message
-- feed. The BOQ work-items become checklist lines, not separate tasks.
--
-- The seven V46 templates (TT_PM_PLAN_DESIGN … TT_PM_BILLING) are soft-deleted so the workflow
-- engine stops materializing them, and a single TEAM template TT_PM_EXECUTION (no dependencies,
-- ANY_PARTICIPANT completion so no manager-approval gate) takes their place in the same phase.
-- No PROJECT workflow instances exist yet (startProjectWorkflow was never wired), so nothing in the
-- data references the old templates — this is a pure template swap. The creation wiring is added in
-- WorkflowTriggerService.onProjectCreated.

-- Retire the seven lifecycle task templates.
UPDATE task_templates tt
JOIN workflow_phases p        ON p.id = tt.phase_id
JOIN workflow_templates t     ON t.id = p.template_id AND t.code = 'PROJECT_MAIN'
SET tt.is_deleted = 1, tt.updated_at = NOW(6)
WHERE tt.code IN ('TT_PM_PLAN_DESIGN','TT_PM_PROCUREMENT','TT_PM_SITE_PREP',
                  'TT_PM_INSTALLATION','TT_PM_QUALITY','TT_PM_HANDOVER','TT_PM_BILLING');

-- One shared execution task for the whole project.
INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority, due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id,
       'Project Execution', 'TT_PM_EXECUTION',
       'Shared execution task for the whole project. Tick off the work items, adjust the progress bar, and keep the team log — anyone on the team can pick it up and post updates everyone sees.',
       1, 'TEAM', 'ANY_PARTICIPANT', 'Supervisor,Project', 'HIGH', 7, 'CREATION'
FROM workflow_phases p
JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'PROJECT_MAIN'
WHERE p.code = 'PROJECT_MAIN_TASKS'
  AND NOT EXISTS (SELECT 1 FROM task_templates x WHERE x.code = 'TT_PM_EXECUTION' AND x.is_deleted = 0);

-- Make sure PROJECT_MAIN is the active PROJECT template the engine selects.
UPDATE workflow_templates SET active = 1, updated_at = NOW(6) WHERE code = 'PROJECT_MAIN';

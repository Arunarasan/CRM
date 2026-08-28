-- Single-role phase: for now the business runs on ONE "general employee" concept — specialist roles
-- (Engineer, Estimator, Sales, Supervisor) will be established later. Open EVERY lead-workflow task to
-- any employee so one person can drive a lead end-to-end. This deliberately relaxes the role gates set
-- in V37/V38/V40/V41; re-gate per task when the specialist roles are introduced.
--
-- Note: the module-driven behaviour (Measure Site / Site Visit / Prepare BOQ open their real module and
-- can't be hand-completed) is unchanged — that's role-independent. This migration only affects who is
-- ELIGIBLE to pick a task; a paired DataSeeder change grants ROLE_EMPLOYEE the module WRITE permissions.

UPDATE task_templates tt
  JOIN workflow_phases p    ON p.id = tt.phase_id
  JOIN workflow_templates wt ON wt.id = p.template_id AND wt.code = 'LEAD_DEFAULT'
   SET tt.eligible_roles = NULL;

-- Backfill already-generated open (non-COMPLETED/CANCELLED) lead tasks so live pools open up too.
UPDATE tasks t
  JOIN task_templates tt     ON tt.id = t.task_template_id
  JOIN workflow_phases p     ON p.id = tt.phase_id
  JOIN workflow_templates wt ON wt.id = p.template_id AND wt.code = 'LEAD_DEFAULT'
   SET t.eligible_roles = NULL
 WHERE t.status NOT IN ('COMPLETED', 'CANCELLED');

-- Combine "Site Visit" and "Measurement" into a single workflow step for NEW leads.
--
-- Product decision: a site visit and the site measurement are almost always one trip by one person,
-- so the lead workflow now has ONE task — "Site Visit & Measurement" (TT_VISIT_MEASURE) — instead of
-- the separate Schedule/Conduct Visit tasks and the Measure Site task. The SiteVisit and Measurement
-- records are still both created (behind the scenes) so BOQ generation, reports, and carryover keep
-- working unchanged.
--
-- IN-FLIGHT LEADS ARE LEFT ALONE: the old phase/task-template rows are only SOFT-deleted (is_deleted=1),
-- never removed, so already-materialized tasks that still point at them keep resolving. Task/phase
-- generation for new leads filters is_deleted=0 (see WorkflowPhaseRepository / TaskTemplateRepository),
-- so only new leads pick up the combined step; existing leads finish on their current tasks. The
-- workflow trigger service detects which shape a lead is on (presence of the LEAD_MEASUREMENT phase)
-- and advances it accordingly.

-- 1. Rename the Site Visit phase to the combined name (it now carries the single combined task).
UPDATE workflow_phases p
   JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
   SET p.name = 'Site Visit & Measurement'
 WHERE p.code = 'LEAD_SITE_VISIT';

-- 2. Add the single combined, module-driven task into that phase.
--    Gated to the roles that can actually perform a measurement (needs MEASUREMENT_WRITE).
INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority,
                            due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id,
       'Site Visit & Measurement', 'TT_VISIT_MEASURE',
       'Visit the site, record observations/photos, and take the measurements in one trip.',
       1, 'SINGLE_EMPLOYEE', 'OWNER_APPROVAL', 'Engineer,Supervisor', 'MEDIUM', 1, 'CREATION'
  FROM workflow_phases p
  JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
 WHERE p.code = 'LEAD_SITE_VISIT';

-- 3. Retire the three superseded task templates for NEW leads (soft-delete keeps in-flight refs valid).
UPDATE task_templates
   SET is_deleted = 1
 WHERE code IN ('TT_SCHEDULE_VISIT', 'TT_CONDUCT_VISIT', 'TT_MEASURE_SITE');

-- 4. Retire the now-empty Measurement phase for NEW leads (its work moved into the combined task).
UPDATE workflow_phases p
   JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
   SET p.is_deleted = 1
 WHERE p.code = 'LEAD_MEASUREMENT';

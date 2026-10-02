-- Merge the two field steps of the lead workflow into ONE task, matching the single combined Quote
-- page (measure, price, quote and customer approval on one sheet). New leads now run:
--   1. Collect Requirement                 (LEAD_QUALIFICATION)
--   2. Site Visit, Measure & Quote         (LEAD_QUOTATION — one module-driven task)
-- The task stays open while the sheet is worked on and closes when the project is created
-- (WorkflowTriggerService.onProjectCreated advances LEAD_QUOTATION).
--
-- IN-FLIGHT LEADS ARE LEFT ALONE: superseded phase/task-template rows are only SOFT-deleted
-- (is_deleted=1), so already-materialized tasks keep resolving; generation for new leads filters
-- is_deleted=0. For combined leads the LEAD_SITE_VISIT phase is absent, so onMeasurementCompleted's
-- advance of LEAD_SITE_VISIT is a natural no-op (the measurement now completes when the quote is made).

-- 1. The quotation phase carries the merged step.
UPDATE workflow_phases p
   JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
   SET p.name = 'Site Visit, Measure & Quote'
 WHERE p.code = 'LEAD_QUOTATION';

-- 2. The single merged, module-driven task (due on the agreed site-visit date — see TaskGenerationService).
INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority,
                            due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id,
       'Site Visit, Measure & Quote', 'TT_MEASURE_QUOTE',
       'Visit the site, enter rooms, sizes and prices on the quote sheet, share the quote and record the customer''s approval — all on one page.',
       1, 'SINGLE_EMPLOYEE', 'OWNER_APPROVAL', NULL, 'HIGH', 2, 'CREATION'
  FROM workflow_phases p
  JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
 WHERE p.code = 'LEAD_QUOTATION';

-- 3. Retire the two superseded task templates for NEW leads.
UPDATE task_templates
   SET is_deleted = 1
 WHERE code IN ('TT_VISIT_MEASURE', 'TT_BOQ_QUOTE');

-- 4. Retire the now-empty Site Visit & Measurement phase for NEW leads.
UPDATE workflow_phases p
   JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
   SET p.is_deleted = 1
 WHERE p.code = 'LEAD_SITE_VISIT';

-- Combine the BOQ and Quotation lead-workflow steps into ONE task, mirroring the Site Visit &
-- Measurement combine (V44). New leads now run THREE work steps after qualification:
--   1. Collect Requirement       (LEAD_QUALIFICATION)
--   2. Site Visit & Measurement  (LEAD_SITE_VISIT)
--   3. BOQ & Quotation           (LEAD_QUOTATION — one combined, module-driven task)
--
-- IN-FLIGHT LEADS ARE LEFT ALONE: old phase/task-template rows are only SOFT-deleted (is_deleted=1),
-- never removed, so already-materialized tasks keep resolving. Generation for new leads filters
-- is_deleted=0. Phase CODES are kept intact — the combined step keeps the LEAD_QUOTATION code because
-- WorkflowTriggerService advances by code (onProjectCreated → LEAD_QUOTATION closes the workflow).
-- onBoqApproved still targets LEAD_BOQ, which is absent for combined leads, so it's a natural no-op
-- there (BOQ approval is now a mid-step inside the combined task, not a phase advance).

-- 1. Rename the Quotation phase to the combined name (it now carries the single combined task).
UPDATE workflow_phases p
   JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
   SET p.name = 'BOQ & Quotation'
 WHERE p.code = 'LEAD_QUOTATION';

-- 2. Add the single combined, module-driven task into that phase (open to anybody, single-role model).
INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority,
                            due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id,
       'BOQ & Quotation', 'TT_BOQ_QUOTE',
       'Generate the BOQ from the measurement, then raise the quotation — in one step.',
       1, 'SINGLE_EMPLOYEE', 'OWNER_APPROVAL', NULL, 'MEDIUM', 2, 'CREATION'
  FROM workflow_phases p
  JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
 WHERE p.code = 'LEAD_QUOTATION';

-- 3. Retire the two superseded task templates for NEW leads (soft-delete keeps in-flight refs valid).
UPDATE task_templates
   SET is_deleted = 1
 WHERE code IN ('TT_PREPARE_BOQ', 'TT_GENERATE_QUOTE');

-- 4. Retire the now-empty BOQ phase for NEW leads (its work moved into the combined task).
UPDATE workflow_phases p
   JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
   SET p.is_deleted = 1
 WHERE p.code = 'LEAD_BOQ';

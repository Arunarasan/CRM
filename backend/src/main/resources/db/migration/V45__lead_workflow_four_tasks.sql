-- Collapse the default lead workflow to EXACTLY FOUR sequential tasks — one per phase:
--   1. Collect Requirement        (LEAD_QUALIFICATION phase)
--   2. Site Visit & Measurement   (LEAD_SITE_VISIT phase — TT_VISIT_MEASURE, unchanged from V44)
--   3. BOQ Creation               (LEAD_BOQ phase — TT_PREPARE_BOQ, renamed)
--   4. Quotation                  (LEAD_QUOTATION phase — TT_GENERATE_QUOTE, renamed)
--
-- Product decision: the earlier multi-task Qualification stage (Review New Lead → Contact Customer →
-- Understand Requirement → Qualify Lead) and the extra Quotation tasks (Send Quotation, Quotation
-- Follow-up) are retired in favour of a lean four-step lead lifecycle any employee can drive. The four
-- tasks still UNLOCK IN SEQUENCE: each phase activates only once the previous one completes (progressive
-- generation is unchanged) — this migration only changes WHICH task each phase carries.
--
-- IN-FLIGHT LEADS ARE LEFT ALONE: retired task templates are SOFT-deleted (is_deleted=1), never
-- removed, so already-materialized tasks on existing leads keep resolving. Task generation for NEW
-- leads filters is_deleted=0 (TaskTemplateRepository.findByPhaseIdAndIsDeletedFalse...), so only new
-- leads pick up the four-task shape. Phase CODES are kept intact (LEAD_QUALIFICATION / LEAD_SITE_VISIT
-- / LEAD_BOQ / LEAD_QUOTATION) because WorkflowTriggerService advances the workflow by those codes.

-- 1. Qualification phase → single "Collect Requirement" task ---------------------------------------

-- Retire the four qualification task templates for NEW leads (soft-delete keeps in-flight refs valid).
UPDATE task_templates
   SET is_deleted = 1
 WHERE code IN ('TT_REVIEW_LEAD', 'TT_CONTACT_CUSTOMER', 'TT_UNDERSTAND_REQ', 'TT_QUALIFY_LEAD');

-- Rename the phase to reflect its single job (phase code stays LEAD_QUALIFICATION for the triggers).
UPDATE workflow_phases p
   JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
   SET p.name = 'Collect Requirement'
 WHERE p.code = 'LEAD_QUALIFICATION';

-- Add the single "Collect Requirement" task into the qualification phase. Open to anybody
-- (eligible_roles = NULL) so any employee can drive the lead, per the single-role model (V42). It
-- carries the structured REQUIREMENT form (see LeadTaskForms) so completing it writes the captured
-- requirement onto the lead and advances the workflow to the Site Visit & Measurement phase.
INSERT INTO task_templates (created_at, is_deleted, version, phase_id, name, code, description,
                            order_index, assignment_type, completion_rule, eligible_roles, priority,
                            due_offset_days, due_basis)
SELECT NOW(6), 0, 0, p.id,
       'Collect Requirement', 'TT_COLLECT_REQUIREMENT',
       'Contact the customer and capture their requirement and scope for this lead.',
       1, 'SINGLE_EMPLOYEE', 'OWNER_APPROVAL', NULL, 'HIGH', 1, 'CREATION'
  FROM workflow_phases p
  JOIN workflow_templates t ON t.id = p.template_id AND t.code = 'LEAD_DEFAULT'
 WHERE p.code = 'LEAD_QUALIFICATION';

-- 2. BOQ phase → rename the task to "BOQ Creation" (code TT_PREPARE_BOQ unchanged, module-driven) ---
UPDATE task_templates
   SET name = 'BOQ Creation'
 WHERE code = 'TT_PREPARE_BOQ';

-- 3. Quotation phase → single "Quotation" task ----------------------------------------------------

-- Retire the two extra quotation task templates for NEW leads (soft-delete).
UPDATE task_templates
   SET is_deleted = 1
 WHERE code IN ('TT_SEND_QUOTE', 'TT_FOLLOWUP_QUOTE');

-- Rename the remaining quotation task (code TT_GENERATE_QUOTE unchanged, module-driven).
UPDATE task_templates
   SET name = 'Quotation'
 WHERE code = 'TT_GENERATE_QUOTE';

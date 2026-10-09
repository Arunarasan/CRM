-- Retire the leftover "BOQ & Quotation" tasks (TT_BOQ_QUOTE). V107 stopped creating them for new leads,
-- but leads already in flight still carry an open one. Convert each OPEN one in place into the merged
-- "Site Visit, Measure & Quote" task (TT_MEASURE_QUOTE): same lead, assignee, status, dates and history —
-- only the template, name and instructions change, so its button now opens the one combined quote page.
--
-- Both templates live in the same LEAD_QUOTATION phase, and tasks close by their workflow phase instance
-- (WorkflowTriggerService.advanceLeadPhaseOnEvent), so the converted task still closes when the project
-- is created. Completed / cancelled tasks are left as they were, for the record.

UPDATE tasks t
  JOIN task_templates old_tt ON old_tt.id = t.task_template_id AND old_tt.code = 'TT_BOQ_QUOTE'
  JOIN (SELECT tt.id, tt.name, tt.description
          FROM task_templates tt
          JOIN workflow_phases p ON p.id = tt.phase_id AND p.code = 'LEAD_QUOTATION'
          JOIN workflow_templates wt ON wt.id = p.template_id AND wt.code = 'LEAD_DEFAULT'
         WHERE tt.code = 'TT_MEASURE_QUOTE' AND tt.is_deleted = 0
         ORDER BY tt.id
         LIMIT 1) new_tt
   SET t.task_template_id = new_tt.id,
       t.task_name        = new_tt.name,
       t.description      = new_tt.description
 WHERE t.status NOT IN ('COMPLETED', 'CANCELLED');

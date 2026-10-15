-- Retire leftovers of the auto-tasks that are no longer part of the workflow:
--   BOQ & Quotation / Generate Quotation / Send Quotation / Quotation Follow-up (lead), Installation (project).
-- Their templates are already soft-deleted (V45, V74, V107, V119), so nothing new is created; this cancels
-- any still-open instance (and its live assignments) so it leaves every employee's list. Idempotent.

UPDATE task_assignments a
  JOIN tasks t ON t.id = a.task_id
  JOIN task_templates tt ON tt.id = t.task_template_id
   SET a.status = 'CANCELLED'
 WHERE tt.code IN ('TT_BOQ_QUOTE','TT_GENERATE_QUOTE','TT_SEND_QUOTE','TT_FOLLOWUP_QUOTE','TT_PM_INSTALLATION')
   AND t.status NOT IN ('COMPLETED','CANCELLED')
   AND a.status NOT IN ('COMPLETED','CANCELLED','REJECTED');

UPDATE tasks t
  JOIN task_templates tt ON tt.id = t.task_template_id
   SET t.status = 'CANCELLED'
 WHERE tt.code IN ('TT_BOQ_QUOTE','TT_GENERATE_QUOTE','TT_SEND_QUOTE','TT_FOLLOWUP_QUOTE','TT_PM_INSTALLATION')
   AND t.status NOT IN ('COMPLETED','CANCELLED');

-- "Lead Works": one task per lead replaces Collect Requirement + Site Visit, Measure & Quote.
-- The surviving task is the merged TT_MEASURE_QUOTE template (code kept so every existing link, form and
-- guard keeps resolving). It moves into the FIRST phase (LEAD_QUALIFICATION) so it is generated the moment a
-- lead is created, and it closes when the project is created (WorkflowTriggerService.onProjectCreated).
-- Whoever completes it earns the lead incentive; a team shares it (PayrollService).

-- 1. Template: rename, re-describe, move into the first phase, first in order.
UPDATE task_templates mq
  JOIN (SELECT p.id
          FROM workflow_phases p
          JOIN workflow_templates wt ON wt.id = p.template_id AND wt.code = 'LEAD_DEFAULT'
         WHERE p.code = 'LEAD_QUALIFICATION' LIMIT 1) q
   SET mq.phase_id    = q.id,
       mq.name        = 'Lead Works',
       mq.description = 'Collect the requirement, visit the site, measure, price and share the quote, and record the customer''s approval — all on one page.',
       mq.order_index = 0
 WHERE mq.code = 'TT_MEASURE_QUOTE' AND mq.is_deleted = 0;

-- 2. Retire Collect Requirement and the now-empty quotation phase for NEW leads (soft delete only,
--    so tasks already materialized keep resolving).
UPDATE task_templates SET is_deleted = 1 WHERE code = 'TT_COLLECT_REQUIREMENT';

UPDATE workflow_phases p
  JOIN workflow_templates wt ON wt.id = p.template_id AND wt.code = 'LEAD_DEFAULT'
   SET p.is_deleted = 1
 WHERE p.code = 'LEAD_QUOTATION';

-- 3. Leads in flight: the earliest OPEN Collect Requirement task becomes the lead's Lead Works task
--    (same assignee, status, dates, history); any extra open follow-up attempts are cancelled.
UPDATE tasks t
  JOIN task_templates old_tt ON old_tt.id = t.task_template_id AND old_tt.code = 'TT_COLLECT_REQUIREMENT'
  JOIN (SELECT id, name, description FROM task_templates
         WHERE code = 'TT_MEASURE_QUOTE' AND is_deleted = 0 ORDER BY id LIMIT 1) lw
  JOIN (SELECT lead_id, MIN(id) AS keep_id FROM tasks
         WHERE lead_id IS NOT NULL AND is_deleted = 0 AND status NOT IN ('COMPLETED', 'CANCELLED')
           AND task_template_id IN (SELECT id FROM task_templates WHERE code = 'TT_COLLECT_REQUIREMENT')
         GROUP BY lead_id) k ON k.lead_id = t.lead_id AND k.keep_id = t.id
   SET t.task_template_id = lw.id, t.task_name = lw.name, t.description = lw.description
 WHERE t.status NOT IN ('COMPLETED', 'CANCELLED');

UPDATE tasks t
  JOIN task_templates old_tt ON old_tt.id = t.task_template_id AND old_tt.code = 'TT_COLLECT_REQUIREMENT'
   SET t.status = 'CANCELLED'
 WHERE t.status NOT IN ('COMPLETED', 'CANCELLED');

-- 4. Open merged tasks already carry the old name — show them as Lead Works too.
UPDATE tasks t
  JOIN task_templates tt ON tt.id = t.task_template_id AND tt.code = 'TT_MEASURE_QUOTE'
   SET t.task_name = 'Lead Works'
 WHERE t.status NOT IN ('COMPLETED', 'CANCELLED');

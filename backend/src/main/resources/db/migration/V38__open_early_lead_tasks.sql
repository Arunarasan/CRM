-- Open the early (Qualification-phase) lead tasks to any employee, not just Sales.
--
-- Per request: general employees should be able to pick up the first-line lead tasks
-- (Review New Lead, Contact Customer, Understand Requirement, Qualify Lead). Setting
-- eligible_roles = NULL makes each an "open task" — pickable by anyone with pool access
-- (see TaskEligibilityService: no eligible_roles ⇒ open to everyone). The later, clearly
-- sales-owned tasks (Generate/Send/Follow-up Quotation) are deliberately left gated to Sales.
--
-- Data-only (no schema change). Same shape as V37.

-- 1. Template: open the four Qualification tasks
UPDATE task_templates
   SET eligible_roles = NULL
 WHERE code IN ('TT_REVIEW_LEAD', 'TT_CONTACT_CUSTOMER', 'TT_UNDERSTAND_REQ', 'TT_QUALIFY_LEAD');

-- 2. Backfill already-generated open (non-COMPLETED/CANCELLED) tasks so live pools update too.
UPDATE tasks t
  JOIN task_templates tt ON tt.id = t.task_template_id
   SET t.eligible_roles = NULL
 WHERE tt.code IN ('TT_REVIEW_LEAD', 'TT_CONTACT_CUSTOMER', 'TT_UNDERSTAND_REQ', 'TT_QUALIFY_LEAD')
   AND t.status NOT IN ('COMPLETED', 'CANCELLED');

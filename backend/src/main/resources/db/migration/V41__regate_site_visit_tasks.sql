-- Site Visit tasks are now module-driven (done in the Site Visit module, which creates a real
-- SiteVisit record and advances the workflow via onSiteVisitCompleted) — not quick forms. Gate them
-- to the roles that actually conduct site visits so they don't sit in a general employee's pool.
-- V37 had left "Conduct Site Visit" open (NULL); "Schedule Site Visit" was 'Sales,Site' (Site matched
-- nobody). Re-gate both to the site-visit roles.

UPDATE task_templates
   SET eligible_roles = 'Sales,Engineer,Supervisor'
 WHERE code IN ('TT_SCHEDULE_VISIT', 'TT_CONDUCT_VISIT');

-- Backfill already-generated open (non-COMPLETED/CANCELLED) tasks so live pools re-gate too.
UPDATE tasks t
  JOIN task_templates tt ON tt.id = t.task_template_id
   SET t.eligible_roles = 'Sales,Engineer,Supervisor'
 WHERE tt.code IN ('TT_SCHEDULE_VISIT', 'TT_CONDUCT_VISIT')
   AND t.status NOT IN ('COMPLETED', 'CANCELLED');

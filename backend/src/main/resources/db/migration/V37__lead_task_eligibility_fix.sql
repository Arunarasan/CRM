-- Fix the LEAD_DEFAULT task eligibility so the auto-generated pool tasks reach real staff.
--
-- Problem (see WorkflowTriggerService / TaskEligibilityService): the V33 seed gated several lead
-- tasks to capability tokens that no seeded role produces, so the tasks materialized into the pool
-- but were pickable by nobody (only admins bypass the gate):
--   * "Conduct Site Visit" / "Measure Site" required "Site"/"Measurement" — no role yields these.
--   * "Estimation" never matched ROLE_ESTIMATOR ("estimator") under substring matching.
--
-- Fixes (data-only — engine tables unchanged):
--   1. Open Site-Visit and Measurement field tasks to everyone (NULL eligible_roles = open task),
--      per the chosen policy that any employee may pick them up.
--   2. Point estimation tasks at the real role name "Estimator" (the matcher is also now stem-aware,
--      so "estimator" ~ "estimation", but we correct the seed to the canonical value regardless).

-- 1. Site Visit + Measurement → open to all
UPDATE task_templates
   SET eligible_roles = NULL
 WHERE code IN ('TT_CONDUCT_VISIT', 'TT_MEASURE_SITE');

-- 2. Estimation → Estimator (canonical role token)
UPDATE task_templates SET eligible_roles = 'Estimator,Project' WHERE code = 'TT_PREPARE_BOQ';
UPDATE task_templates SET eligible_roles = 'Sales,Estimator'   WHERE code = 'TT_GENERATE_QUOTE';

-- 3. Backfill already-generated lead tasks that are still open (not completed/cancelled), so tasks
--    sitting unpickable in a live pool are corrected too. Generated tasks snapshot eligible_roles
--    from their template at creation time, so they don't inherit the template updates above.
UPDATE tasks t
  JOIN task_templates tt ON tt.id = t.task_template_id
   SET t.eligible_roles = tt.eligible_roles
 WHERE tt.code IN ('TT_CONDUCT_VISIT', 'TT_MEASURE_SITE', 'TT_PREPARE_BOQ', 'TT_GENERATE_QUOTE')
   AND t.status NOT IN ('COMPLETED', 'CANCELLED');

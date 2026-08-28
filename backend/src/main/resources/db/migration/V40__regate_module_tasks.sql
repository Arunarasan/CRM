-- Measurement and BOQ are module-driven tasks (done in the Measurement / BOQ modules, not via a
-- quick form or the generic Complete button). V37 had opened "Measure Site" to everyone, but a plain
-- employee can't actually perform a measurement (needs MEASUREMENT_WRITE) — and completing it by hand
-- would falsely advance the workflow to BOQ with no measurement recorded. Re-gate it to the roles that
-- actually do site measurement. "Prepare BOQ" is already gated to Estimator/Project (V37).

UPDATE task_templates
   SET eligible_roles = 'Engineer,Supervisor'
 WHERE code = 'TT_MEASURE_SITE';

-- Backfill already-generated open (non-COMPLETED/CANCELLED) Measure Site tasks so live pools re-gate too.
UPDATE tasks t
  JOIN task_templates tt ON tt.id = t.task_template_id
   SET t.eligible_roles = 'Engineer,Supervisor'
 WHERE tt.code = 'TT_MEASURE_SITE'
   AND t.status NOT IN ('COMPLETED', 'CANCELLED');

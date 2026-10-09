-- Projects now complete only through the Complete / Handover actions (ProjectService).
-- Before that, the phase rollup auto-completed a project once every phase hit 100%.
-- Those auto-completed projects never got a handover date or a completion certificate
-- (Handover sets the date; Complete stores the certificate when one is given), so put
-- them back to RUNNING. Progress is left as it is.
UPDATE projects
SET status = 'RUNNING',
    actual_completion_date = NULL,
    total_duration_days = NULL
WHERE UPPER(status) = 'COMPLETED'
  AND handover_date IS NULL
  AND (completion_certificate_base64 IS NULL OR completion_certificate_base64 = '');

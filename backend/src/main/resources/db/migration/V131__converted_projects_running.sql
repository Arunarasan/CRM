-- A project converted from a quotation is a running job from the moment it is created
-- (QuotationService.buildProject). Projects converted before that change were left in
-- PLANNING / PENDING / APPROVED waiting for a manual "Start Execution" — move them to RUNNING.
-- Their Execution & Installation task is filled in on startup by ConvertedProjectTaskBackfill.
UPDATE projects
SET status = 'RUNNING',
    start_date = COALESCE(start_date, CURRENT_DATE)
WHERE quotation_id IS NOT NULL
  AND (is_deleted = 0 OR is_deleted IS NULL)
  AND UPPER(status) IN ('PLANNING', 'PENDING', 'APPROVED');

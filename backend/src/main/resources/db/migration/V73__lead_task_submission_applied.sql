-- Collected task data is now applied to the native lead/project only once the task is APPROVED
-- (previously it was written at submit time). `applied` tracks whether a submission's data has been
-- pushed onto the lead yet. Existing rows were already applied under the old behavior → mark them true.
ALTER TABLE lead_task_submissions ADD COLUMN applied BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE lead_task_submissions SET applied = TRUE;

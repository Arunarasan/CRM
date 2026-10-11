-- Execution & Installation is the whole project team's shared task: anyone on the employee portal can
-- see and take it (it was limited to Supervisor / Project roles, so most employees never saw it on
-- older projects). Applies to the templates (new projects) and to tasks already created (old data).
UPDATE task_templates
SET eligible_roles = NULL, updated_at = NOW(6)
WHERE code IN ('TT_PM_EXECUTION', 'TT_PM_INSTALLATION');

UPDATE tasks t
JOIN task_templates tt ON tt.id = t.task_template_id
SET t.eligible_roles = NULL, t.updated_at = NOW(6)
WHERE tt.code IN ('TT_PM_EXECUTION', 'TT_PM_INSTALLATION')
  AND t.status NOT IN ('COMPLETED', 'CANCELLED');

-- Older projects that still carry only the separate "Installation" task: it opens the same combined
-- work screen, so give it the combined name.
UPDATE tasks t
JOIN task_templates tt ON tt.id = t.task_template_id AND tt.code = 'TT_PM_INSTALLATION'
LEFT JOIN (
    SELECT DISTINCT e.project_id
    FROM tasks e
    JOIN task_templates et ON et.id = e.task_template_id AND et.code = 'TT_PM_EXECUTION'
    WHERE e.is_deleted = 0 OR e.is_deleted IS NULL
) has_exec ON has_exec.project_id = t.project_id
SET t.task_name = 'Execution & Installation', t.updated_at = NOW(6)
WHERE t.stage IS NULL
  AND t.project_id IS NOT NULL
  AND t.task_name = 'Installation'
  AND has_exec.project_id IS NULL;

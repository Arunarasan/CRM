-- The shared "Project Execution" task now needs a manager/admin sign-off before the project is marked
-- 100% complete: the employee ticks the work items, sets the progress bar and records how much the
-- customer paid, then submits — the task goes to WAITING_APPROVAL (project shows 99% pending) and only
-- an admin approval finalizes it to 100% and confirms the collected amount.
--
-- Switch its completion rule from ANY_PARTICIPANT to OWNER_APPROVAL so completing submits for approval
-- instead of closing immediately.

UPDATE task_templates
SET completion_rule = 'OWNER_APPROVAL', updated_at = NOW(6)
WHERE code = 'TT_PM_EXECUTION';

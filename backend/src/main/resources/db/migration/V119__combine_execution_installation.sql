-- One project task: "Execution & Installation".
--
-- The project's Project Execution and Installation tasks become a single shared task, the same view the
-- project page shows under Execution: products & steps, installation checklists per category, the daily
-- log and the team chat. Its % is the overall figure (half execution, half installation); the team submits
-- it once both halves reach 100%, and an admin approval completes the project.
--
-- 1. The execution template is renamed and needs owner (admin) approval; the Installation template is
--    retired (soft-deleted) so new projects get only the one task.
-- 2. In-flight projects with an open Installation task are folded into their Execution task: the team,
--    chat and daily logs move over, a finished Execution task is reopened with the Installation task's
--    state, and the Installation task is cancelled. Completed projects are left as they are.

UPDATE task_templates
SET name = 'Execution & Installation',
    description = 'Get every product ready and to the site — material (from purchase orders where they exist), manufacturing, stitching and delivery — then install it category by category. Post what was done today and the plan for tomorrow, record customer payments, and keep the team chat with photos and voice notes.',
    completion_rule = 'OWNER_APPROVAL',
    assignment_type = 'TEAM',
    updated_at = NOW(6)
WHERE code = 'TT_PM_EXECUTION';

UPDATE task_templates
SET is_deleted = 1, deleted_at = NOW(6), updated_at = NOW(6)
WHERE code = 'TT_PM_INSTALLATION' AND is_deleted = 0;

-- Execution / open-Installation pairs, one per project.
CREATE TEMPORARY TABLE tmp_ei_pairs (
    exec_id     BIGINT      NOT NULL PRIMARY KEY,
    inst_id     BIGINT      NOT NULL,
    exec_status VARCHAR(50) NULL,
    inst_status VARCHAR(50) NULL
);

INSERT INTO tmp_ei_pairs (exec_id, inst_id, exec_status, inst_status)
SELECT e.id, i.id, e.status, i.status
FROM tasks e
JOIN task_templates et ON et.id = e.task_template_id AND et.code = 'TT_PM_EXECUTION'
JOIN tasks i ON i.project_id = e.project_id
JOIN task_templates it ON it.id = i.task_template_id AND it.code = 'TT_PM_INSTALLATION'
WHERE e.is_deleted = 0 AND i.is_deleted = 0
  AND e.status <> 'CANCELLED'
  AND i.status NOT IN ('CANCELLED', 'COMPLETED')
  AND i.id = (SELECT MIN(i2.id) FROM tasks i2
              JOIN task_templates it2 ON it2.id = i2.task_template_id AND it2.code = 'TT_PM_INSTALLATION'
              WHERE i2.project_id = e.project_id AND i2.is_deleted = 0
                AND i2.status NOT IN ('CANCELLED', 'COMPLETED'))
  AND e.id = (SELECT MIN(e2.id) FROM tasks e2
              JOIN task_templates et2 ON et2.id = e2.task_template_id AND et2.code = 'TT_PM_EXECUTION'
              WHERE e2.project_id = e.project_id AND e2.is_deleted = 0 AND e2.status <> 'CANCELLED');

-- A finished Execution task takes over the Installation task's live state.
UPDATE tasks e
JOIN tmp_ei_pairs p ON p.exec_id = e.id
SET e.status = p.inst_status, e.completed_date = NULL, e.updated_at = NOW(6)
WHERE e.status IN ('COMPLETED', 'WAITING_APPROVAL');

-- …and its finished team members can work it again.
UPDATE task_assignments a
JOIN tmp_ei_pairs p ON p.exec_id = a.task_id
SET a.status = 'IN_PROGRESS', a.completed_at = NULL, a.updated_at = NOW(6)
WHERE a.status = 'COMPLETED' AND a.is_deleted = 0
  AND p.exec_status IN ('COMPLETED', 'WAITING_APPROVAL')
  AND p.inst_status <> 'WAITING_APPROVAL';

-- Installation team members already on the Execution task keep that assignment (no duplicates).
CREATE TEMPORARY TABLE tmp_ei_dup (id BIGINT NOT NULL PRIMARY KEY);
INSERT INTO tmp_ei_dup (id)
SELECT DISTINCT a.id
FROM task_assignments a
JOIN tmp_ei_pairs p ON p.inst_id = a.task_id
JOIN task_assignments b ON b.task_id = p.exec_id AND b.employee_id = a.employee_id
                       AND b.is_deleted = 0 AND b.status <> 'CANCELLED'
WHERE a.employee_id IS NOT NULL;

UPDATE task_assignments a
JOIN tmp_ei_pairs p ON p.inst_id = a.task_id
LEFT JOIN tmp_ei_dup d ON d.id = a.id
SET a.task_id = p.exec_id, a.updated_at = NOW(6)
WHERE d.id IS NULL;

-- Chat and daily logs follow onto the one task.
UPDATE task_comments c
JOIN tmp_ei_pairs p ON p.inst_id = c.task_id
SET c.task_id = p.exec_id;

UPDATE project_task_daily_logs l
JOIN tmp_ei_pairs p ON p.inst_id = l.task_id
SET l.task_id = p.exec_id;

UPDATE tasks i
JOIN tmp_ei_pairs p ON p.inst_id = i.id
SET i.status = 'CANCELLED', i.updated_at = NOW(6);

DROP TEMPORARY TABLE tmp_ei_dup;
DROP TEMPORARY TABLE tmp_ei_pairs;

-- Open Execution tasks pick up the new name and the admin sign-off. Projects that still carry a finished
-- Installation task keep their names (history).
UPDATE tasks t
JOIN task_templates tt ON tt.id = t.task_template_id AND tt.code = 'TT_PM_EXECUTION'
SET t.task_name = 'Execution & Installation',
    t.completion_rule = 'OWNER_APPROVAL',
    t.updated_at = NOW(6)
WHERE t.is_deleted = 0 AND t.status NOT IN ('COMPLETED', 'CANCELLED');

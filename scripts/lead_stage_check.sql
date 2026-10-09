-- Read-only: each live lead with the signals behind its automatic stage, and the stage it lands in.
-- Mirrors LeadSpecification.journeyStage — first match wins:
-- Lost > Active Projects > Project Completed > Quote Building > Requirement Collected > New.
SELECT x.id, x.name, x.docs, x.meas, x.task_data, x.req_done, x.quotes, x.approved,
       x.live_projects, x.completed_projects, x.cancelled_projects,
       CASE
         WHEN x.marked_lost OR (x.cancelled_projects > 0 AND x.live_projects = 0 AND x.completed_projects = 0) THEN 'Lost'
         WHEN x.live_projects > 0 THEN 'Active Projects'
         WHEN x.completed_projects > 0 THEN 'Project Completed'
         WHEN x.quotes > 0 THEN IF(x.approved > 0, 'Quote Building (approved - convert)', 'Quote Building')
         WHEN x.docs + x.meas + x.task_data + x.req_done > 0 THEN 'Requirement Collected'
         ELSE 'New'
       END AS stage
FROM (
  SELECT l.id, LEFT(l.name, 28) AS name,
         LOWER(COALESCE(l.status, '')) = 'lost' AS marked_lost,
         (SELECT COUNT(*) FROM lead_documents d WHERE d.lead_id = l.id AND COALESCE(d.is_deleted, 0) = 0) AS docs,
         (SELECT COUNT(*) FROM measurements m WHERE m.lead_id = l.id AND COALESCE(m.is_deleted, 0) = 0) AS meas,
         (SELECT COUNT(*) FROM lead_task_submissions s WHERE s.lead_id = l.id) AS task_data,
         (SELECT COUNT(*) FROM tasks t JOIN task_templates tt ON tt.id = t.task_template_id
           WHERE t.lead_id = l.id AND tt.code = 'TT_COLLECT_REQUIREMENT' AND t.status = 'COMPLETED') AS req_done,
         (SELECT COUNT(*) FROM quotations q WHERE q.lead_id = l.id) AS quotes,
         (SELECT COUNT(*) FROM quotations q WHERE q.lead_id = l.id AND q.status IN ('APPROVED', 'CONVERTED')) AS approved,
         (SELECT COUNT(*) FROM projects p WHERE p.lead_id = l.id AND COALESCE(p.is_deleted, 0) = 0
           AND UPPER(COALESCE(p.status, '')) NOT IN ('COMPLETED', 'CANCELLED')) AS live_projects,
         (SELECT COUNT(*) FROM projects p WHERE p.lead_id = l.id AND COALESCE(p.is_deleted, 0) = 0
           AND UPPER(p.status) = 'COMPLETED') AS completed_projects,
         (SELECT COUNT(*) FROM projects p WHERE p.lead_id = l.id AND COALESCE(p.is_deleted, 0) = 0
           AND UPPER(p.status) = 'CANCELLED') AS cancelled_projects
  FROM leads l
  WHERE l.is_deleted = 0
) x
ORDER BY x.id DESC;

-- ============================================================================
-- Sample tasks for eyeballing the new Task board "Type" lanes and the lead
-- profile Lead Journey tab. NOT a Flyway migration — run by hand on a dev DB.
--
-- Every row is tagged [SAMPLE-CHECK] in its description, so the CLEANUP block at
-- the bottom removes exactly these and nothing else.
--
-- Run:
--   mysql --user=root arudra_crm < scripts/sample_tasks_check.sql   (MYSQL_PWD=1234)
-- ============================================================================

SET @now := NOW();

-- ---- Lead Journey (attached to lead #1, which has no tasks yet) --------------
-- 4 sequential workflow steps, unassigned, so you can try Auto / Smart / manual
-- assign and see the LOCKED gate. Open: Leads → (lead #1) → Tasks → Lead Journey.
INSERT INTO tasks (task_name, description, priority, status, source, is_deleted, version, order_index, lead_id, created_at, updated_at) VALUES
 ('Sample - Collect Requirement',         '[SAMPLE-CHECK] Lead step 1 of 4', 'MEDIUM', 'AVAILABLE', 'WORKFLOW', 0, 0, 0, 1, @now, @now),
 ('Sample - Site Visit & Measurement',    '[SAMPLE-CHECK] Lead step 2 of 4', 'MEDIUM', 'LOCKED',    'WORKFLOW', 0, 0, 1, 1, @now, @now),
 ('Sample - BOQ Creation',                '[SAMPLE-CHECK] Lead step 3 of 4', 'MEDIUM', 'LOCKED',    'WORKFLOW', 0, 0, 2, 1, @now, @now),
 ('Sample - Quotation',                   '[SAMPLE-CHECK] Lead step 4 of 4', 'HIGH',   'LOCKED',    'WORKFLOW', 0, 0, 3, 1, @now, @now);

-- ---- One sample per remaining board lane ------------------------------------
-- PROJECT (project link, no BOQ item)
INSERT INTO tasks (task_name, description, priority, status, source, is_deleted, version, project_id, created_at, updated_at) VALUES
 ('Sample - Project Kickoff', '[SAMPLE-CHECK] Project lane', 'MEDIUM', 'PENDING', 'WORKFLOW', 0, 0, 1, @now, @now);

-- FIELD_WORK (generated from a BOQ item — plain id, no FK)
INSERT INTO tasks (task_name, description, priority, status, source, is_deleted, version, project_id, generated_from_boq_item_id, created_at, updated_at) VALUES
 ('Sample - Install False Ceiling', '[SAMPLE-CHECK] Field Work lane', 'HIGH', 'IN_PROGRESS', 'MANUAL', 0, 0, 1, 999001, @now, @now);

-- INSTALLATION (counter-sale invoice link — plain id, no FK)
INSERT INTO tasks (task_name, description, priority, status, source, is_deleted, version, invoice_id, created_at, updated_at) VALUES
 ('Sample - Counter-Sale Installation', '[SAMPLE-CHECK] Installation lane', 'MEDIUM', 'PENDING', 'MANUAL', 0, 0, 999002, @now, @now);

-- SERVICE (service-request source)
INSERT INTO tasks (task_name, description, priority, status, source, is_deleted, version, created_at, updated_at) VALUES
 ('Sample - Service Request Visit', '[SAMPLE-CHECK] Service lane', 'LOW', 'PENDING', 'SERVICE_REQUEST', 0, 0, @now, @now);

-- OTHER (ad-hoc manual task, no links)
INSERT INTO tasks (task_name, description, priority, status, source, is_deleted, version, created_at, updated_at) VALUES
 ('Sample - Ad-hoc Admin Task', '[SAMPLE-CHECK] Other lane', 'LOW', 'PENDING', 'MANUAL', 0, 0, @now, @now);

-- ============================================================================
-- CLEANUP — run this to remove every sample created above:
--   DELETE FROM tasks WHERE description LIKE '[SAMPLE-CHECK]%';
-- ============================================================================

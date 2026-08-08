-- Unified Workforce assignment: employees and contractors become one polymorphic resource on
-- the project side. Assignment identity moves to (resource_type, resource_id):
--   EMPLOYEE   -> users.id
--   CONTRACTOR -> contractors.id
-- No DB FK on resource_id (polymorphic) — existence is validated in WorkforceResourceService.
-- All backfills run BEFORE any column drop, so no assignment data is lost.

-- ---------------------------------------------------------------------------
-- task_assignments: add polymorphic identity, backfill from the employee-only model.
-- employee_id is kept (now nullable) as a denormalized convenience for EMPLOYEE rows, so the
-- mobile employee module and its findByTaskIdAndEmployeeId queries keep working unchanged.
-- ---------------------------------------------------------------------------
ALTER TABLE task_assignments ADD COLUMN resource_type VARCHAR(30) NULL;
ALTER TABLE task_assignments ADD COLUMN resource_id BIGINT NULL;

UPDATE task_assignments
   SET resource_type = 'EMPLOYEE', resource_id = employee_id
 WHERE employee_id IS NOT NULL;

-- Existing rows were all employees; default any stragglers so the column is never null in practice.
UPDATE task_assignments SET resource_type = 'EMPLOYEE' WHERE resource_type IS NULL;

ALTER TABLE task_assignments MODIFY COLUMN employee_id BIGINT NULL;
CREATE INDEX idx_ta_resource ON task_assignments (resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- project_room_items: replace the assignedEmployee/assignedContractor FK pair (added in V16,
-- not yet used in production) with the same polymorphic (resource_type, resource_id).
-- ---------------------------------------------------------------------------
ALTER TABLE project_room_items ADD COLUMN resource_type VARCHAR(30) NULL;
ALTER TABLE project_room_items ADD COLUMN resource_id BIGINT NULL;

UPDATE project_room_items
   SET resource_type = 'EMPLOYEE', resource_id = assigned_employee_id
 WHERE assigned_employee_id IS NOT NULL;
UPDATE project_room_items
   SET resource_type = 'CONTRACTOR', resource_id = assigned_contractor_id
 WHERE assigned_contractor_id IS NOT NULL AND assigned_employee_id IS NULL;

-- Drop the old FK pair and columns (index idx_pri_employee is dropped with its column).
ALTER TABLE project_room_items DROP FOREIGN KEY fk_pri_employee;
ALTER TABLE project_room_items DROP FOREIGN KEY fk_pri_contractor;
DROP INDEX idx_pri_employee ON project_room_items;
ALTER TABLE project_room_items DROP COLUMN assigned_employee_id;
ALTER TABLE project_room_items DROP COLUMN assigned_contractor_id;

CREATE INDEX idx_pri_resource ON project_room_items (resource_type, resource_id);

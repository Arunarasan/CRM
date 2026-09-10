-- Project customer-handover flow.
-- Per-task execution percent + a free "stage" label (Material/Stitching/Making/Works/Installation/custom),
-- and the handover stamp on the project.
ALTER TABLE tasks ADD COLUMN progress INT NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN stage VARCHAR(50) NULL;

ALTER TABLE projects ADD COLUMN handover_date DATE NULL;
ALTER TABLE projects ADD COLUMN handover_notes VARCHAR(500) NULL;

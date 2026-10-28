-- Per-project choice: tasks are staffed by the Smart Assignment engine (AUTO) or picked by hand (MANUAL).
ALTER TABLE projects
    ADD COLUMN task_assignment_mode VARCHAR(10) NOT NULL DEFAULT 'MANUAL';

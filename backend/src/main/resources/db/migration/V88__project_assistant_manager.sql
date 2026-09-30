-- Assign Team now sets the project's two-person leadership pair: Project Manager + Assistant Manager.
-- Adds the assistant-manager slot on the project (nullable FK to users), mirroring project_manager_id.
ALTER TABLE projects ADD COLUMN assistant_manager_id BIGINT NULL;
ALTER TABLE projects ADD CONSTRAINT fk_projects_assistant_manager
    FOREIGN KEY (assistant_manager_id) REFERENCES users (id);

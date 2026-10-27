-- A contractor job no longer has to belong to a project (general / business work).
ALTER TABLE contractor_orders MODIFY project_id BIGINT NULL;

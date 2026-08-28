-- Task Pool hardening (Increment 2): configurable per-employee active-task capacity.
-- Reuses the singleton assignment_settings row (V26) so the existing Smart Assignment settings
-- screen owns this knob too. Default 3 active tasks (owned + participating) per the spec.

ALTER TABLE assignment_settings
    ADD COLUMN max_active_tasks INT NOT NULL DEFAULT 3;

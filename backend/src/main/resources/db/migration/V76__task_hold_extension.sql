-- Lets a worker extend the data-entry hold window when they're still working, so the task isn't
-- auto-released mid-work. When set, hold_extended_at overrides the claim time the countdown is
-- measured from (see EmployeeTaskService.claimTimeOf) — a fresh full hold window from that instant.
ALTER TABLE task_assignments
    ADD COLUMN hold_extended_at DATETIME NULL;

-- "Hold window" for quick data-entry lead tasks (Collect Requirement / Contact-Follow-up /
-- Qualify / Review). When someone picks up or is assigned one of these and hasn't STARTED it
-- within this many minutes, TaskClaimExpiryScheduler releases it back to the shared task board
-- (status → AVAILABLE) so anyone else can pick it up. 0 disables the auto-release.
ALTER TABLE assignment_settings
    ADD COLUMN data_entry_hold_minutes INT NOT NULL DEFAULT 10;

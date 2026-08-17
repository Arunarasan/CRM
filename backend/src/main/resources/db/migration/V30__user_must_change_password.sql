-- BLK-001 fix: support forcing a password change on bootstrap/temporary admin accounts.
-- The prod bootstrap admin (seeded from env vars, never with a hardcoded default) is
-- provisioned with must_change_password = 1 so the client can force a reset on first login.
ALTER TABLE users
    ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0;

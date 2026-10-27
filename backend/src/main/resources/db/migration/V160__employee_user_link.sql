-- Explicit employee <-> login link. Until now the two were tied only by a matching e-mail string,
-- so changing either e-mail silently orphaned the employee's portal access.
ALTER TABLE employees
    ADD COLUMN user_id BIGINT NULL,
    ADD CONSTRAINT uq_employees_user UNIQUE (user_id),
    ADD CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;

-- Backfill from the existing e-mail match (both e-mail columns are unique, so this is one-to-one).
UPDATE employees e
JOIN users u ON LOWER(u.email) = LOWER(e.email)
SET e.user_id = u.id
WHERE e.is_deleted = 0;

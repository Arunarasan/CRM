-- Task time tracking → payroll approval (Increment 5). Extends the (previously unused) task_time_logs
-- table with an approval lifecycle: DRAFT (tracked) → SUBMITTED (employee) → APPROVED / REJECTED
-- (supervisor/admin). Payroll consumes APPROVED records only; no payroll math lives here.

ALTER TABLE task_time_logs
    ADD COLUMN work_date       DATE,
    ADD COLUMN status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN submitted_at    DATETIME(6),
    ADD COLUMN approved_by_id  BIGINT,
    ADD COLUMN approved_at     DATETIME(6),
    ADD COLUMN remarks         VARCHAR(500);

CREATE INDEX idx_ttl_employee_status ON task_time_logs (employee_id, status);
CREATE INDEX idx_ttl_work_date       ON task_time_logs (work_date);

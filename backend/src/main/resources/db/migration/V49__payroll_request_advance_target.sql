-- Extend employee payroll requests so they can also target an advance (repay an advance, or set the
-- monthly recovery plan for an advance) — parallel to the existing loan_id. Additive, nullable.

ALTER TABLE payroll_requests
    ADD COLUMN advance_id BIGINT NULL;

ALTER TABLE payroll_requests
    ADD CONSTRAINT fk_payreq_advance FOREIGN KEY (advance_id) REFERENCES employee_advances(id);

-- Hours-based payslip (one generate flow). Every payslip is now computed from attendance hours; at
-- generate time HR picks HOURLY (hours x rate) or MONTHLY (monthly salary / standard hours x hours
-- worked, capped at the full salary). PF/ESI/PT and the salary structure are no longer used.

-- What a MONTHLY payslip was based on, so the payslip can show "Rs X / 208h x 180h".
ALTER TABLE salary_records ADD COLUMN monthly_salary DECIMAL(15,2) NULL;
ALTER TABLE salary_records ADD COLUMN standard_hours DECIMAL(8,2) NULL;

-- The salary structure is retired: carry each employee's active structure gross into the single
-- "monthly salary" (employees.base_salary) where that isn't set yet, so nobody's pay is lost.
UPDATE employees e
JOIN salary_structures s ON s.employee_id = e.id AND s.active = 1
SET e.base_salary = COALESCE(s.basic, 0) + COALESCE(s.hra, 0) + COALESCE(s.allowances, 0) + COALESCE(s.special_allowance, 0)
WHERE (e.base_salary IS NULL OR e.base_salary = 0);

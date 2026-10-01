-- Working days per month per employee — the standard hours a MONTHLY salary is spread over are
-- standard_daily_hours x working_days_per_month (26 for a 6-day week, ~22 for a 5-day week).
ALTER TABLE employees ADD COLUMN working_days_per_month INT NOT NULL DEFAULT 26;

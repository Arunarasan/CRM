-- Employee Self-Service: hourly wage configuration + attendance time-clock / earnings tracking.
-- Additive only. Wage config lives on the employee (HR-managed, employee read-only); the time-clock
-- fields extend the existing attendance row so clock-in/out/break drives automatic earnings.

-- Hourly wage configuration (HR-managed). hourly_rate NULL = not an hourly-paid employee (earnings 0).
ALTER TABLE employees
    ADD COLUMN hourly_rate           DECIMAL(10,2) NULL,
    ADD COLUMN overtime_multiplier   DECIMAL(5,2)  NOT NULL DEFAULT 1.50,
    ADD COLUMN weekend_multiplier    DECIMAL(5,2)  NOT NULL DEFAULT 1.00,
    ADD COLUMN holiday_multiplier    DECIMAL(5,2)  NOT NULL DEFAULT 2.00,
    ADD COLUMN night_multiplier      DECIMAL(5,2)  NOT NULL DEFAULT 1.00,
    ADD COLUMN standard_daily_hours  DECIMAL(5,2)  NOT NULL DEFAULT 8.00;

-- Time-clock + computed earnings on the daily attendance row.
ALTER TABLE attendance
    ADD COLUMN break_start     TIME          NULL,
    ADD COLUMN break_end       TIME          NULL,
    ADD COLUMN break_minutes   INT           NOT NULL DEFAULT 0,
    ADD COLUMN worked_hours    DECIMAL(6,2)  NULL,
    ADD COLUMN overtime_hours  DECIMAL(6,2)  NOT NULL DEFAULT 0,
    ADD COLUMN day_earnings    DECIMAL(12,2) NULL,
    ADD COLUMN check_in_lat    DECIMAL(10,6) NULL,
    ADD COLUMN check_in_lng    DECIMAL(10,6) NULL,
    ADD COLUMN location_label  VARCHAR(255)  NULL,
    ADD COLUMN device_info     VARCHAR(255)  NULL;

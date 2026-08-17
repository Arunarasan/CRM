-- Progress-linked auto-billing: work-progress milestones automatically raise the matching
-- payment-schedule invoice, and a combined completion tracker surfaces work % + payment %.
--
-- trigger_percentage: the project work % at/above which this stage is auto-invoiced (DUE).
--   NULL means the stage is not progress-driven (billed manually / on some other event).
-- auto_triggered: set once the automation raises this stage's invoice (dedup guard).

ALTER TABLE payment_schedules
    ADD COLUMN trigger_percentage  DECIMAL(5,2) NULL AFTER percentage,
    ADD COLUMN auto_triggered      BIT          NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN auto_triggered_date DATE         NULL AFTER auto_triggered;

-- Backfill sensible progress triggers for the standard 8-stage plan on existing projects.
-- Pre-work stages (advance / design / material) stay NULL — they are not work-progress driven.
UPDATE payment_schedules SET trigger_percentage = 5   WHERE stage = 'WORK_STARTED'       AND trigger_percentage IS NULL;
UPDATE payment_schedules SET trigger_percentage = 50  WHERE stage = 'COMPLETION_50'      AND trigger_percentage IS NULL;
UPDATE payment_schedules SET trigger_percentage = 75  WHERE stage = 'COMPLETION_75'      AND trigger_percentage IS NULL;
UPDATE payment_schedules SET trigger_percentage = 90  WHERE stage = 'PROJECT_COMPLETION' AND trigger_percentage IS NULL;
UPDATE payment_schedules SET trigger_percentage = 100 WHERE stage = 'FINAL_SETTLEMENT'   AND trigger_percentage IS NULL;

-- Per-project automation switch + a one-shot flag so the "fully done & fully paid" alert fires once.
ALTER TABLE projects
    ADD COLUMN auto_billing_enabled BIT NOT NULL DEFAULT 1,
    ADD COLUMN settlement_notified  BIT NOT NULL DEFAULT 0;

-- Feature 2: alert admins when an employee stays clocked in past their shift without clocking out.
-- Dedup flag so each open session is alerted at most once (not re-alerted on every scheduler tick).
ALTER TABLE attendance_sessions
    ADD COLUMN overtime_alert_sent BIT NOT NULL DEFAULT 0;

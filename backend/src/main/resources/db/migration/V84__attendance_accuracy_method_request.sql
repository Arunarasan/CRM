-- Attendance verification follow-ups:
--  1) GPS accuracy margin — store the phone's reported accuracy so the geofence check can forgive
--     drift (an employee counts as inside when distance minus accuracy is within the radius).
--  2) Self-service biometric switch — an employee can request biometric attendance from the portal;
--     the request parks here until an admin approves it (then it becomes their attendance_method).

ALTER TABLE attendance_sessions ADD COLUMN accuracy_meters INT NULL;

ALTER TABLE employees ADD COLUMN attendance_method_requested VARCHAR(20) NULL;
ALTER TABLE employees ADD COLUMN attendance_method_requested_at DATETIME NULL;

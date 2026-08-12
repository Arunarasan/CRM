-- Multiple check-in / check-out per day.
-- An `attendance` row stays the one-per-day aggregate; `attendance_sessions` holds each individual
-- clock-in→clock-out (with its own break tracking). The day's worked hours/earnings are summed
-- across all sessions, so an employee can clock in and out any number of times per day.

CREATE TABLE attendance_sessions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    attendance_id   BIGINT        NOT NULL,
    check_in_time   TIME          NULL,
    check_out_time  TIME          NULL,
    break_start     TIME          NULL,
    break_end       TIME          NULL,
    break_minutes   INT           NOT NULL DEFAULT 0,
    check_in_lat    DECIMAL(10,6) NULL,
    check_in_lng    DECIMAL(10,6) NULL,
    location_label  VARCHAR(255)  NULL,
    device_info     VARCHAR(255)  NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_att_session_attendance FOREIGN KEY (attendance_id) REFERENCES attendance(id),
    INDEX idx_att_session_attendance (attendance_id)
);

-- Backfill: turn each existing day's single check-in/out into its first session so historical
-- worked hours/earnings stay intact once aggregation switches to sessions.
INSERT INTO attendance_sessions
    (attendance_id, check_in_time, check_out_time, break_minutes, check_in_lat, check_in_lng, location_label, device_info, is_deleted, version)
SELECT id, check_in_time, check_out_time, COALESCE(break_minutes, 0), check_in_lat, check_in_lng, location_label, device_info, 0, 0
FROM attendance
WHERE check_in_time IS NOT NULL;

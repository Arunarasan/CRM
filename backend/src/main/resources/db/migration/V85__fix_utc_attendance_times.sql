-- One-off correction of attendance/clock times recorded while the backend ran in UTC.
--
-- Before the Asia/Kolkata timezone fix (commit de11ee4, which went live in production ~19:25 IST on
-- 2026-09-10), the container ran in UTC, so every attendance TIME (check-in/out, break start/end) was
-- stored 5h30m behind the real IST wall-clock. This shifts those UTC-era rows forward by +5:30 so
-- they read correctly in IST.
--
-- SAFETY — only UTC-era rows are shifted:
--   `@tz_cutover` is just below the instant the IST-configured backend went live. Rows created before
--   it were recorded in UTC and are corrected; rows at/after it are already IST and are left untouched
--   (never double-shifted). Backfilled sessions from V27 have a NULL created_at — those are pre-cutover
--   by definition and are included.
--
-- LIMITATION — cross-midnight punches:
--   The shift wraps within a 24h clock (so no invalid >24:00 TIME is produced) but does NOT advance
--   the `date` column. Ordinary daytime punches (IST 09:00–19:00 == UTC 03:30–13:30) never wrap and are
--   corrected exactly. A punch whose UTC time was after 18:30 (past IST midnight) gets the right clock
--   value on the original date. If overnight shifts exist and need rebasing, handle them explicitly.

SET @tz_cutover = '2026-09-10 19:20:00';  -- just before the IST backend went live (~19:25 IST)
SET @shift = 19800;                        -- +5:30, in seconds

UPDATE attendance
SET check_in_time  = IF(check_in_time  IS NULL, NULL, SEC_TO_TIME(MOD(TIME_TO_SEC(check_in_time)  + @shift, 86400))),
    check_out_time = IF(check_out_time IS NULL, NULL, SEC_TO_TIME(MOD(TIME_TO_SEC(check_out_time) + @shift, 86400))),
    break_start    = IF(break_start    IS NULL, NULL, SEC_TO_TIME(MOD(TIME_TO_SEC(break_start)    + @shift, 86400))),
    break_end      = IF(break_end      IS NULL, NULL, SEC_TO_TIME(MOD(TIME_TO_SEC(break_end)      + @shift, 86400)))
WHERE created_at IS NULL OR created_at < @tz_cutover;

UPDATE attendance_sessions
SET check_in_time  = IF(check_in_time  IS NULL, NULL, SEC_TO_TIME(MOD(TIME_TO_SEC(check_in_time)  + @shift, 86400))),
    check_out_time = IF(check_out_time IS NULL, NULL, SEC_TO_TIME(MOD(TIME_TO_SEC(check_out_time) + @shift, 86400))),
    break_start    = IF(break_start    IS NULL, NULL, SEC_TO_TIME(MOD(TIME_TO_SEC(break_start)    + @shift, 86400))),
    break_end      = IF(break_end      IS NULL, NULL, SEC_TO_TIME(MOD(TIME_TO_SEC(break_end)      + @shift, 86400)))
WHERE created_at IS NULL OR created_at < @tz_cutover;

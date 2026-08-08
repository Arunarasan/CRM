-- V4 declared latitude/longitude as DECIMAL(10,7), but the JPA entities use Java Double,
-- which Hibernate maps to DOUBLE (float(53)) — ddl-auto: validate failed on the mismatch.
-- Corrective migration rather than editing V4, since V4 was already applied by Flyway.

ALTER TABLE task_progress_media MODIFY COLUMN latitude DOUBLE NULL;
ALTER TABLE task_progress_media MODIFY COLUMN longitude DOUBLE NULL;

ALTER TABLE task_checkins MODIFY COLUMN check_in_latitude DOUBLE NULL;
ALTER TABLE task_checkins MODIFY COLUMN check_in_longitude DOUBLE NULL;
ALTER TABLE task_checkins MODIFY COLUMN check_out_latitude DOUBLE NULL;
ALTER TABLE task_checkins MODIFY COLUMN check_out_longitude DOUBLE NULL;

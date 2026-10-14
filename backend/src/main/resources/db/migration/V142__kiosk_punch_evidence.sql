-- Evidence recorded by office-kiosk face punches on each attendance session.
ALTER TABLE attendance_sessions ADD COLUMN kiosk_id          BIGINT       NULL;
ALTER TABLE attendance_sessions ADD COLUMN face_distance_in  DOUBLE       NULL;
ALTER TABLE attendance_sessions ADD COLUMN face_distance_out DOUBLE       NULL;
ALTER TABLE attendance_sessions ADD COLUMN selfie_in_url     VARCHAR(500) NULL;
ALTER TABLE attendance_sessions ADD COLUMN selfie_out_url    VARCHAR(500) NULL;
ALTER TABLE attendance_sessions ADD COLUMN liveness_in       VARCHAR(20)  NULL;
ALTER TABLE attendance_sessions ADD COLUMN liveness_out      VARCHAR(20)  NULL;
ALTER TABLE attendance_sessions
    ADD CONSTRAINT fk_att_session_kiosk FOREIGN KEY (kiosk_id) REFERENCES attendance_kiosks(id);

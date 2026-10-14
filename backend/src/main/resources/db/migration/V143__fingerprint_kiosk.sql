-- Fingerprint check-in on the office kiosk (external USB sensor on the kiosk phone).
--
-- Templates are SourceAFIS templates built on the server from the sensor's image; the image itself is
-- never stored. Biometric data: hard-deleted on re-enrol / remove, and only enrolled with consent.
CREATE TABLE employee_fingerprints (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id    BIGINT       NOT NULL,
    finger         INT          NOT NULL,   -- ISO/IEC 19794-2 finger position: 1 right thumb, 2 right index ... 6 left thumb, 7 left index ...
    sample_no      INT          NOT NULL,
    template       LONGBLOB     NOT NULL,
    engine_version VARCHAR(20)  NOT NULL,   -- SourceAFIS version that built it; templates are tied to it
    consent_at     DATETIME     NULL,
    enrolled_by    VARCHAR(255) NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_fingerprint_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    INDEX idx_fingerprint_employee (employee_id)
);

-- What a kiosk accepts: FACE | FINGER | EITHER.
ALTER TABLE attendance_kiosks ADD COLUMN verify_mode VARCHAR(10) NOT NULL DEFAULT 'FACE';

-- Fingerprint match score of a kiosk check-in / check-out (higher is a closer match).
ALTER TABLE attendance_sessions ADD COLUMN finger_score_in  DOUBLE NULL;
ALTER TABLE attendance_sessions ADD COLUMN finger_score_out DOUBLE NULL;

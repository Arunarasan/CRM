-- Face enrollment for kiosk attendance.
--
-- Each enrolled employee has a handful of face templates (a 128-number descriptor computed in the
-- browser, stored as a JSON array) plus one reference photo taken at enrollment. The kiosk matches a
-- live face against these templates. Templates are biometric data: they are hard-deleted on
-- re-enroll / remove, never soft-deleted.
CREATE TABLE employee_face_templates (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id   BIGINT       NOT NULL,
    sample_no     INT          NOT NULL,
    descriptor    TEXT         NOT NULL,
    quality       DOUBLE       NULL,
    photo_url     VARCHAR(500) NULL,
    enrolled_by   VARCHAR(255) NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_face_template_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    INDEX idx_face_template_employee (employee_id)
);

-- Office Kiosk phones for face attendance.
--
-- HR registers a kiosk (a shared phone/tablet at the office). The phone is paired once with a
-- short-lived pairing code and then holds a long random token; only the SHA-256 hash of both the
-- pairing code and the token is stored. Kiosk requests carry the token instead of a user login.
CREATE TABLE attendance_kiosks (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    office_location_id  BIGINT       NULL,
    active              BIT          NOT NULL DEFAULT 1,
    pairing_code_hash   VARCHAR(64)  NULL,
    pairing_expires_at  DATETIME     NULL,
    token_hash          VARCHAR(64)  NULL,
    paired_at           DATETIME     NULL,
    device_info         VARCHAR(255) NULL,
    last_seen_at        DATETIME     NULL,
    last_ip             VARCHAR(64)  NULL,
    created_at   DATETIME     NULL,
    updated_at   DATETIME     NULL,
    created_by   VARCHAR(255) NULL,
    updated_by   VARCHAR(255) NULL,
    deleted_by   VARCHAR(255) NULL,
    deleted_at   DATETIME     NULL,
    is_deleted   BIT          NOT NULL DEFAULT 0,
    version      BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_att_kiosk_location FOREIGN KEY (office_location_id) REFERENCES attendance_locations(id),
    INDEX idx_att_kiosk_pairing (pairing_code_hash),
    INDEX idx_att_kiosk_token (token_hash)
);

-- Employee self-service edits now go through an admin approval queue instead of writing straight
-- to the master record. Each row is one pending change an employee raised from the portal:
--   PROFILE  — proposed phone / emergency contact / profile photo (only the fields the employee set)
--   DOCUMENT — a document the employee wants added to their file
-- On APPROVE the proposed values are copied onto the employee (PROFILE) or an employee_documents row
-- is created (DOCUMENT). REJECT records remarks and changes nothing. Password change stays instant
-- and is deliberately NOT modelled here.

CREATE TABLE profile_change_requests (
    id                        BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id               BIGINT       NOT NULL,
    requested_by              BIGINT       NOT NULL,
    change_type               VARCHAR(20)  NOT NULL,            -- PROFILE, DOCUMENT

    -- PROFILE proposal (all nullable; only the fields the employee changed are set)
    proposed_phone            VARCHAR(20)  NULL,
    proposed_emergency_name   VARCHAR(100) NULL,
    proposed_emergency_phone  VARCHAR(20)  NULL,
    proposed_photo_url        VARCHAR(500) NULL,

    -- DOCUMENT proposal
    doc_name                  VARCHAR(150) NULL,
    doc_type                  VARCHAR(50)  NULL,
    doc_file_url              VARCHAR(500) NULL,

    status                    VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
    review_remarks            VARCHAR(500) NULL,
    reviewed_by               BIGINT       NULL,
    reviewed_at               DATETIME     NULL,

    created_at                DATETIME     NULL,
    updated_at                DATETIME     NULL,
    created_by                VARCHAR(255) NULL,
    updated_by                VARCHAR(255) NULL,
    deleted_by                VARCHAR(255) NULL,
    deleted_at                DATETIME     NULL,
    is_deleted                BIT          NOT NULL DEFAULT 0,
    version                   BIGINT       NULL DEFAULT 0,

    INDEX idx_pcr_employee (employee_id),
    INDEX idx_pcr_status (status),
    CONSTRAINT fk_pcr_employee    FOREIGN KEY (employee_id)  REFERENCES employees (id),
    CONSTRAINT fk_pcr_requested_by FOREIGN KEY (requested_by) REFERENCES users (id),
    CONSTRAINT fk_pcr_reviewed_by FOREIGN KEY (reviewed_by)  REFERENCES users (id)
);

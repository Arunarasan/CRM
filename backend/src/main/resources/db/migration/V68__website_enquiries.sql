-- Website Enquiry inbox: inbound enquiries from the public marketing site (contact form,
-- consultation request, product quote) captured as first-class records. Admin triages them in
-- Website → Enquiries and converts a qualified one into a CRM lead (lead_id links back); every
-- new enquiry also raises an ENQUIRY task (task_id links back).

CREATE TABLE website_enquiries (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel        VARCHAR(30)  NOT NULL DEFAULT 'CONTACT',   -- CONTACT | CONSULTATION | PRODUCT_QUOTE
    source_label   VARCHAR(120) NULL,
    name           VARCHAR(150) NOT NULL,
    phone          VARCHAR(30)  NULL,
    email          VARCHAR(150) NULL,
    city           VARCHAR(120) NULL,
    interest       VARCHAR(200) NULL,
    product_slug   VARCHAR(200) NULL,
    property_type  VARCHAR(80)  NULL,
    area           VARCHAR(60)  NULL,
    budget         VARCHAR(60)  NULL,
    preferred_date VARCHAR(60)  NULL,
    message        TEXT         NULL,
    status         VARCHAR(30)  NOT NULL DEFAULT 'NEW',       -- NEW | IN_PROGRESS | CONVERTED | CLOSED
    lead_id        BIGINT       NULL,
    task_id        BIGINT       NULL,
    created_at     DATETIME     NULL,
    updated_at     DATETIME     NULL,
    created_by     VARCHAR(255) NULL,
    updated_by     VARCHAR(255) NULL,
    deleted_by     VARCHAR(255) NULL,
    deleted_at     DATETIME     NULL,
    is_deleted     BIT          NOT NULL DEFAULT 0,
    version        BIGINT       NULL DEFAULT 0,
    INDEX idx_enquiry_status (status),
    INDEX idx_enquiry_created (created_at)
);

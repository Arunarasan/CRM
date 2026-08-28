-- Phase 2 (website control) — CMS-managed site settings + page content. Moves the site's brand /
-- contact / social settings and its page copy out of the website's hardcoded config and into the DB
-- so the CRM can view/edit them. Seeded idempotently by DataSeeder from the current defaults, so the
-- public site is never empty and simply upgrades to CRM-managed content on the next fetch.

CREATE TABLE site_settings (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    created_at    DATETIME(6),
    updated_at    DATETIME(6),
    created_by    VARCHAR(255),
    updated_by    VARCHAR(255),
    version       BIGINT       NOT NULL DEFAULT 0,
    deleted_by    VARCHAR(255),
    deleted_at    DATETIME(6),
    is_deleted    BIT(1)       NOT NULL DEFAULT b'0',

    setting_key   VARCHAR(100) NOT NULL,
    setting_value TEXT,
    group_name    VARCHAR(60),
    label         VARCHAR(150),
    input_type    VARCHAR(30)  NOT NULL DEFAULT 'text',
    display_order INT          NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    CONSTRAINT uq_site_setting_key UNIQUE (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE content_blocks (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    created_at    DATETIME(6),
    updated_at    DATETIME(6),
    created_by    VARCHAR(255),
    updated_by    VARCHAR(255),
    version       BIGINT       NOT NULL DEFAULT 0,
    deleted_by    VARCHAR(255),
    deleted_at    DATETIME(6),
    is_deleted    BIT(1)       NOT NULL DEFAULT b'0',

    page          VARCHAR(60)  NOT NULL,
    section_key   VARCHAR(80)  NOT NULL,
    title         VARCHAR(250),
    subtitle      VARCHAR(500),
    body          TEXT,
    display_order INT          NOT NULL DEFAULT 0,
    active        BIT(1)       NOT NULL DEFAULT b'1',

    PRIMARY KEY (id),
    CONSTRAINT uq_content_block UNIQUE (page, section_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

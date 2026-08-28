-- Phase 5 — Website catalog. Backs the public site and the future admin CMS. Content is seeded
-- idempotently by DataSeeder (so it exists on every environment and the site is never empty).
-- List-ish fields (benefits, applications, highlights) are stored as newline-delimited TEXT via
-- StringListConverter; richer structures (process, faq, gallery, specifications) as JSON TEXT.

CREATE TABLE shop_categories (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    created_at    DATETIME(6),
    updated_at    DATETIME(6),
    created_by    VARCHAR(255),
    updated_by    VARCHAR(255),
    version       BIGINT       NOT NULL DEFAULT 0,
    deleted_by    VARCHAR(255),
    deleted_at    DATETIME(6),
    is_deleted    BIT(1)       NOT NULL DEFAULT b'0',

    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(120) NOT NULL,
    icon          VARCHAR(50),
    display_order INT          DEFAULT 0,
    active        BIT(1)       NOT NULL DEFAULT b'1',

    PRIMARY KEY (id),
    CONSTRAINT uq_prod_cat_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shop_products (
    id                  BIGINT        NOT NULL AUTO_INCREMENT,
    created_at          DATETIME(6),
    updated_at          DATETIME(6),
    created_by          VARCHAR(255),
    updated_by          VARCHAR(255),
    version             BIGINT        NOT NULL DEFAULT 0,
    deleted_by          VARCHAR(255),
    deleted_at          DATETIME(6),
    is_deleted          BIT(1)        NOT NULL DEFAULT b'0',

    name                VARCHAR(200)  NOT NULL,
    slug                VARCHAR(220)  NOT NULL,
    sku                 VARCHAR(50),
    category_id         BIGINT,
    short_description   VARCHAR(500),
    description         TEXT,
    image_url           VARCHAR(500),
    price               DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_price      DECIMAL(15,2),
    stock               INT           NOT NULL DEFAULT 0,
    rating              DOUBLE        NOT NULL DEFAULT 0,
    review_count        INT           NOT NULL DEFAULT 0,
    featured            BIT(1)        NOT NULL DEFAULT b'0',
    active              BIT(1)        NOT NULL DEFAULT b'1',
    material            VARCHAR(200),
    dimensions          VARCHAR(200),
    gallery_json        TEXT,
    specifications_json TEXT,

    PRIMARY KEY (id),
    CONSTRAINT uq_product_slug UNIQUE (slug),
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES shop_categories (id),
    INDEX idx_product_category (category_id),
    INDEX idx_product_featured (featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE materials (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    created_at   DATETIME(6),
    updated_at   DATETIME(6),
    created_by   VARCHAR(255),
    updated_by   VARCHAR(255),
    version      BIGINT       NOT NULL DEFAULT 0,
    deleted_by   VARCHAR(255),
    deleted_at   DATETIME(6),
    is_deleted   BIT(1)       NOT NULL DEFAULT b'0',

    name         VARCHAR(200) NOT NULL,
    slug         VARCHAR(220) NOT NULL,
    category     VARCHAR(100),
    image_url    VARCHAR(500),
    description  TEXT,
    finish       VARCHAR(100),
    color        VARCHAR(100),
    applications TEXT,
    active       BIT(1)       NOT NULL DEFAULT b'1',
    display_order INT         DEFAULT 0,

    PRIMARY KEY (id),
    CONSTRAINT uq_material_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE services (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    created_at        DATETIME(6),
    updated_at        DATETIME(6),
    created_by        VARCHAR(255),
    updated_by        VARCHAR(255),
    version           BIGINT       NOT NULL DEFAULT 0,
    deleted_by        VARCHAR(255),
    deleted_at        DATETIME(6),
    is_deleted        BIT(1)       NOT NULL DEFAULT b'0',

    title             VARCHAR(200) NOT NULL,
    slug              VARCHAR(220) NOT NULL,
    short_description VARCHAR(500),
    image_url         VARCHAR(500),
    icon              VARCHAR(50),
    overview          TEXT,
    benefits          TEXT,
    materials_list    TEXT,
    process_json      TEXT,
    faq_json          TEXT,
    active            BIT(1)       NOT NULL DEFAULT b'1',
    display_order     INT          DEFAULT 0,

    PRIMARY KEY (id),
    CONSTRAINT uq_service_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE portfolio_projects (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    created_at     DATETIME(6),
    updated_at     DATETIME(6),
    created_by     VARCHAR(255),
    updated_by     VARCHAR(255),
    version        BIGINT       NOT NULL DEFAULT 0,
    deleted_by     VARCHAR(255),
    deleted_at     DATETIME(6),
    is_deleted     BIT(1)       NOT NULL DEFAULT b'0',

    title          VARCHAR(200) NOT NULL,
    slug           VARCHAR(220) NOT NULL,
    category       VARCHAR(100),
    location       VARCHAR(150),
    year           INT,
    cover_image    VARCHAR(500),
    concept        TEXT,
    materials_list TEXT,
    services_list  TEXT,
    highlights     TEXT,
    gallery_json   TEXT,
    testimonial_json TEXT,
    active         BIT(1)       NOT NULL DEFAULT b'1',
    display_order  INT          DEFAULT 0,

    PRIMARY KEY (id),
    CONSTRAINT uq_portfolio_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE hero_slides (
    id                    BIGINT       NOT NULL AUTO_INCREMENT,
    created_at            DATETIME(6),
    updated_at            DATETIME(6),
    created_by            VARCHAR(255),
    updated_by            VARCHAR(255),
    version               BIGINT       NOT NULL DEFAULT 0,
    deleted_by            VARCHAR(255),
    deleted_at            DATETIME(6),
    is_deleted            BIT(1)       NOT NULL DEFAULT b'0',

    image_url             VARCHAR(500),
    eyebrow               VARCHAR(200),
    title                 VARCHAR(200),
    title_accent          VARCHAR(100),
    description           VARCHAR(500),
    primary_button_text   VARCHAR(100),
    primary_button_link   VARCHAR(200),
    secondary_button_text VARCHAR(100),
    secondary_button_link VARCHAR(200),
    display_order         INT          DEFAULT 0,
    active                BIT(1)       NOT NULL DEFAULT b'1',

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE testimonials (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    created_at    DATETIME(6),
    updated_at    DATETIME(6),
    created_by    VARCHAR(255),
    updated_by    VARCHAR(255),
    version       BIGINT       NOT NULL DEFAULT 0,
    deleted_by    VARCHAR(255),
    deleted_at    DATETIME(6),
    is_deleted    BIT(1)       NOT NULL DEFAULT b'0',

    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(100),
    location      VARCHAR(100),
    rating        INT          NOT NULL DEFAULT 5,
    quote         TEXT,
    active        BIT(1)       NOT NULL DEFAULT b'1',
    display_order INT          DEFAULT 0,

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

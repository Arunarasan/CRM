-- Admin-managed catalog of standard measurement items. Employees pick from this when capturing a
-- site measurement (with an "Other" free-text fallback), so item name/category/unit/material stay
-- consistent through the measurement → BOQ flow. Seed the item types the mobile page used to hardcode.

CREATE TABLE measurement_item_catalog (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    created_at       DATETIME(6),
    updated_at       DATETIME(6),
    created_by       VARCHAR(255),
    updated_by       VARCHAR(255),
    version          BIGINT       NOT NULL DEFAULT 0,
    deleted_by       VARCHAR(255),
    deleted_at       DATETIME(6),
    is_deleted       BIT(1)       NOT NULL DEFAULT b'0',

    name             VARCHAR(200) NOT NULL,
    item_type        VARCHAR(50),
    default_unit     VARCHAR(20),
    default_material VARCHAR(100),
    active           BIT(1)       NOT NULL DEFAULT b'1',
    order_index      INT          DEFAULT 0,

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO measurement_item_catalog (created_at, version, is_deleted, active, name, item_type, default_unit, order_index)
VALUES
    (NOW(6), 0, b'0', b'1', 'Wall',     'Wall',     'sqft', 1),
    (NOW(6), 0, b'0', b'1', 'Floor',    'Floor',    'sqft', 2),
    (NOW(6), 0, b'0', b'1', 'Ceiling',  'Ceiling',  'sqft', 3),
    (NOW(6), 0, b'0', b'1', 'Wardrobe', 'Wardrobe', 'sqft', 4),
    (NOW(6), 0, b'0', b'1', 'Kitchen',  'Kitchen',  'rft',  5),
    (NOW(6), 0, b'0', b'1', 'Door',     'Door',     'nos',  6),
    (NOW(6), 0, b'0', b'1', 'Window',   'Window',   'nos',  7);

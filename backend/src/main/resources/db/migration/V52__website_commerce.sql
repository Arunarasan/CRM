-- Phase 5 — Commerce. Server-side cart/wishlist for signed-in customers (guests keep localStorage,
-- merged on login) and persisted orders. Gateway-ready: payment_status/payment_ref only; no card
-- data is ever stored.

CREATE TABLE carts (
    id          BIGINT     NOT NULL AUTO_INCREMENT,
    created_at  DATETIME(6),
    updated_at  DATETIME(6),
    created_by  VARCHAR(255),
    updated_by  VARCHAR(255),
    version     BIGINT     NOT NULL DEFAULT 0,
    deleted_by  VARCHAR(255),
    deleted_at  DATETIME(6),
    is_deleted  BIT(1)     NOT NULL DEFAULT b'0',

    customer_id BIGINT     NOT NULL,

    PRIMARY KEY (id),
    CONSTRAINT uq_cart_customer UNIQUE (customer_id),
    CONSTRAINT fk_cart_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cart_items (
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6),
    updated_at DATETIME(6),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    version    BIGINT        NOT NULL DEFAULT 0,
    deleted_by VARCHAR(255),
    deleted_at DATETIME(6),
    is_deleted BIT(1)        NOT NULL DEFAULT b'0',

    cart_id    BIGINT        NOT NULL,
    product_id BIGINT        NOT NULL,
    qty        INT           NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    CONSTRAINT fk_ci_cart    FOREIGN KEY (cart_id)    REFERENCES carts (id),
    CONSTRAINT fk_ci_product FOREIGN KEY (product_id) REFERENCES shop_products (id),
    INDEX idx_ci_cart (cart_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wishlists (
    id          BIGINT     NOT NULL AUTO_INCREMENT,
    created_at  DATETIME(6),
    updated_at  DATETIME(6),
    created_by  VARCHAR(255),
    updated_by  VARCHAR(255),
    version     BIGINT     NOT NULL DEFAULT 0,
    deleted_by  VARCHAR(255),
    deleted_at  DATETIME(6),
    is_deleted  BIT(1)     NOT NULL DEFAULT b'0',

    customer_id BIGINT     NOT NULL,

    PRIMARY KEY (id),
    CONSTRAINT uq_wishlist_customer UNIQUE (customer_id),
    CONSTRAINT fk_wishlist_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wishlist_items (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    created_at  DATETIME(6),
    updated_at  DATETIME(6),
    created_by  VARCHAR(255),
    updated_by  VARCHAR(255),
    version     BIGINT NOT NULL DEFAULT 0,
    deleted_by  VARCHAR(255),
    deleted_at  DATETIME(6),
    is_deleted  BIT(1) NOT NULL DEFAULT b'0',

    wishlist_id BIGINT NOT NULL,
    product_id  BIGINT NOT NULL,

    PRIMARY KEY (id),
    CONSTRAINT fk_wi_wishlist FOREIGN KEY (wishlist_id) REFERENCES wishlists (id),
    CONSTRAINT fk_wi_product  FOREIGN KEY (product_id)  REFERENCES shop_products (id),
    CONSTRAINT uq_wishlist_item UNIQUE (wishlist_id, product_id),
    INDEX idx_wi_wishlist (wishlist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    created_at       DATETIME(6),
    updated_at       DATETIME(6),
    created_by       VARCHAR(255),
    updated_by       VARCHAR(255),
    version          BIGINT        NOT NULL DEFAULT 0,
    deleted_by       VARCHAR(255),
    deleted_at       DATETIME(6),
    is_deleted       BIT(1)        NOT NULL DEFAULT b'0',

    order_number     VARCHAR(50)   NOT NULL,
    customer_id      BIGINT        NOT NULL,
    status           VARCHAR(30)   NOT NULL DEFAULT 'PENDING',
    subtotal         DECIMAL(15,2) NOT NULL DEFAULT 0,
    delivery_fee     DECIMAL(15,2) NOT NULL DEFAULT 0,
    total            DECIMAL(15,2) NOT NULL DEFAULT 0,
    payment_method   VARCHAR(30),
    payment_status   VARCHAR(30)   NOT NULL DEFAULT 'UNPAID',
    payment_ref      VARCHAR(120),
    contact_name     VARCHAR(150),
    contact_phone    VARCHAR(30),
    contact_email    VARCHAR(150),
    delivery_address TEXT,
    city             VARCHAR(100),
    pincode          VARCHAR(20),
    placed_at        DATETIME(6),

    PRIMARY KEY (id),
    CONSTRAINT uq_order_number UNIQUE (order_number),
    CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    INDEX idx_order_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    created_at   DATETIME(6),
    updated_at   DATETIME(6),
    created_by   VARCHAR(255),
    updated_by   VARCHAR(255),
    version      BIGINT        NOT NULL DEFAULT 0,
    deleted_by   VARCHAR(255),
    deleted_at   DATETIME(6),
    is_deleted   BIT(1)        NOT NULL DEFAULT b'0',

    order_id     BIGINT        NOT NULL,
    product_id   BIGINT,
    product_name VARCHAR(200)  NOT NULL,
    sku          VARCHAR(50),
    unit_price   DECIMAL(15,2) NOT NULL DEFAULT 0,
    qty          INT           NOT NULL DEFAULT 1,
    line_total   DECIMAL(15,2) NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders (id),
    CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES shop_products (id),
    INDEX idx_oi_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

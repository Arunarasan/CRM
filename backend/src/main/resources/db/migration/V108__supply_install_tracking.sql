-- Supply & Install tracker: how much of each project material has been installed at the customer's site.
ALTER TABLE project_material_requirements
    ADD COLUMN installed_qty DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Quote-line name → product links people made by hand, so the auto-linker matches that name next time.
CREATE TABLE product_name_aliases (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alias VARCHAR(255) NOT NULL,
    product_id BIGINT NOT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    version BIGINT NULL DEFAULT 0,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT(1) NOT NULL DEFAULT 0,
    CONSTRAINT uk_product_name_alias UNIQUE (alias),
    CONSTRAINT fk_product_name_alias_product FOREIGN KEY (product_id) REFERENCES products (id)
);

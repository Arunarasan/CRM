-- Enterprise Inventory Management module: richer material master, category hierarchy,
-- damaged/in-transit stock tracking, multi-supplier links, stock transfers, employee
-- material requests, and damage entries. All ALTERs are nullable/default-backed so no
-- existing row is affected; existing tables and APIs keep working unchanged.

ALTER TABLE products ADD COLUMN material_code VARCHAR(30) NULL;
ALTER TABLE products ADD CONSTRAINT uq_products_material_code UNIQUE (material_code);
ALTER TABLE products ADD COLUMN sub_category_id BIGINT NULL;
ALTER TABLE products ADD CONSTRAINT fk_products_sub_category FOREIGN KEY (sub_category_id) REFERENCES inventory_categories(id);
ALTER TABLE products ADD COLUMN model VARCHAR(100) NULL;
ALTER TABLE products ADD COLUMN hsn_code VARCHAR(20) NULL;
ALTER TABLE products ADD COLUMN gst_percent DECIMAL(5,2) NULL;
ALTER TABLE products ADD COLUMN purchase_price DECIMAL(15,2) NULL;
ALTER TABLE products ADD COLUMN max_stock_level INT NULL;
ALTER TABLE products ADD COLUMN reorder_level INT NULL;
ALTER TABLE products ADD COLUMN lead_time_days INT NULL;
ALTER TABLE products ADD COLUMN default_warehouse_id BIGINT NULL;
ALTER TABLE products ADD CONSTRAINT fk_products_default_warehouse FOREIGN KEY (default_warehouse_id) REFERENCES warehouses(id);
ALTER TABLE products ADD COLUMN image_url VARCHAR(500) NULL;
ALTER TABLE products ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

UPDATE products SET material_code = CONCAT('MAT-', LPAD(id, 6, '0')) WHERE material_code IS NULL;

ALTER TABLE inventory_categories ADD COLUMN parent_id BIGINT NULL;
ALTER TABLE inventory_categories ADD CONSTRAINT fk_inv_cat_parent FOREIGN KEY (parent_id) REFERENCES inventory_categories(id);
ALTER TABLE inventory_categories ADD COLUMN code VARCHAR(30) NULL;

ALTER TABLE inventory_items ADD COLUMN damaged_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN in_transit_quantity INT NOT NULL DEFAULT 0;

CREATE TABLE product_suppliers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,
    purchase_price DECIMAL(15,2) NULL,
    lead_time_days INT NULL,
    is_preferred BIT NOT NULL DEFAULT 0,
    last_purchase_date DATE NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_ps_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_ps_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    INDEX idx_ps_product (product_id)
);

CREATE TABLE stock_transfers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transfer_number VARCHAR(30) NOT NULL UNIQUE,
    source_warehouse_id BIGINT NOT NULL,
    destination_warehouse_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    requested_by_id BIGINT NULL,
    approved_by_id BIGINT NULL,
    notes TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_st_source FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_st_dest FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_st_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id),
    CONSTRAINT fk_st_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id),
    INDEX idx_st_status (status)
);

CREATE TABLE stock_transfer_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transfer_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_sti_transfer FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id),
    CONSTRAINT fk_sti_product FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_sti_transfer (transfer_id)
);

CREATE TABLE material_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_number VARCHAR(30) NOT NULL UNIQUE,
    task_id BIGINT NULL,
    project_id BIGINT NULL,
    requested_by_id BIGINT NOT NULL,
    warehouse_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    remarks TEXT NULL,
    approved_by_id BIGINT NULL,
    decided_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_mr_task FOREIGN KEY (task_id) REFERENCES tasks(id),
    CONSTRAINT fk_mr_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_mr_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id),
    CONSTRAINT fk_mr_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_mr_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id),
    INDEX idx_mr_status (status),
    INDEX idx_mr_requested_by (requested_by_id)
);

CREATE TABLE material_request_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    issued_quantity INT NOT NULL DEFAULT 0,
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_mri_request FOREIGN KEY (request_id) REFERENCES material_requests(id),
    CONSTRAINT fk_mri_product FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_mri_request (request_id)
);

CREATE TABLE damage_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    reason TEXT NULL,
    photo_url VARCHAR(500) NULL,
    responsible_person_id BIGINT NULL,
    reported_by_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REPORTED',
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    deleted_by VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    version BIGINT NULL DEFAULT 0,
    CONSTRAINT fk_de_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_de_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_de_responsible FOREIGN KEY (responsible_person_id) REFERENCES users(id),
    CONSTRAINT fk_de_reported_by FOREIGN KEY (reported_by_id) REFERENCES users(id),
    INDEX idx_de_product (product_id)
);

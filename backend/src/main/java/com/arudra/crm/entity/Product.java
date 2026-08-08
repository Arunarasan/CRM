package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "products")
public class Product extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 100, unique = true)
    private String sku;

    @Column(length = 100)
    private String barcode;

    @Column(name = "qr_code", length = 100)
    private String qrCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private InventoryCategory category;

    @Column(length = 50)
    private String unit; // pcs, kg, meters, etc.

    @Column(name = "min_stock_level")
    private Integer minStockLevel = 10;

    @Column(precision = 15, scale = 2)
    private BigDecimal price;

    @Column(name = "cost_price", precision = 15, scale = 2)
    private BigDecimal costPrice;

    @Column(name = "selling_price", precision = 15, scale = 2)
    private BigDecimal sellingPrice;

    @Column(length = 100)
    private String brand;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Supplier supplier;

    /** Auto-generated MAT-%06d, unique. Backfilled for pre-existing rows by V6 migration. */
    @Column(name = "material_code", length = 30, unique = true)
    private String materialCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_category_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private InventoryCategory subCategory;

    @Column(length = 100)
    private String model;

    @Column(name = "hsn_code", length = 20)
    private String hsnCode;

    @Column(name = "gst_percent", precision = 5, scale = 2)
    private BigDecimal gstPercent;

    @Column(name = "purchase_price", precision = 15, scale = 2)
    private BigDecimal purchasePrice;

    @Column(name = "max_stock_level")
    private Integer maxStockLevel;

    @Column(name = "reorder_level")
    private Integer reorderLevel;

    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "default_warehouse_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse defaultWarehouse;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE, INACTIVE
}

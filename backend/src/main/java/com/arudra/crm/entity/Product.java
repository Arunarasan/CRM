package com.arudra.crm.entity;

import com.arudra.crm.util.StringListConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

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

    /** Additional catalogue photos beyond the primary imageUrl (swatches, close-ups, room shots). */
    @Convert(converter = StringListConverter.class)
    @Column(name = "image_urls", columnDefinition = "TEXT")
    private List<String> imageUrls;

    // ----- Fabric / cloth specifications (curtains, upholstery, sheers…) -----

    /** Fibre/material make-up, e.g. "Cotton", "Polyester", "Velvet", "Linen blend". */
    @Column(name = "fabric_composition", length = 150)
    private String fabricComposition;

    /** Usable width of the cloth on the roll, e.g. "54 inch", "108 inch", "140 cm". */
    @Column(name = "fabric_width", length = 60)
    private String fabricWidth;

    /** Fabric weight in grams per square metre. */
    @Column(name = "gsm")
    private Integer gsm;

    /** Weave / print pattern, e.g. "Plain", "Floral", "Geometric", "Jacquard". */
    @Column(length = 120)
    private String pattern;

    /** Primary colour of the material. */
    @Column(length = 80)
    private String color;

    /** Broad colour group for filtering, e.g. "Neutrals", "Blues", "Earthy". */
    @Column(name = "color_family", length = 60)
    private String colorFamily;

    /** Standard cut / panel sizes stocked, e.g. "5 ft", "7 ft", "9 ft", "Custom". */
    @Convert(converter = StringListConverter.class)
    @Column(name = "available_sizes", columnDefinition = "TEXT")
    private List<String> availableSizes;

    // ----- Window suitability & design structure -----

    /** Covering category, e.g. "Curtain", "Roman Blind", "Roller Blind", "Sheer", "Wallpaper". */
    @Column(name = "product_type", length = 80)
    private String productType;

    /** Window shapes this product suits, e.g. "Bay", "Sliding", "French", "Skylight". */
    @Convert(converter = StringListConverter.class)
    @Column(name = "suitable_window_types", columnDefinition = "TEXT")
    private List<String> suitableWindowTypes;

    /** How it is fixed, e.g. "Inside mount", "Outside mount", "Ceiling", "Wall track". */
    @Column(name = "mounting_type", length = 80)
    private String mountingType;

    /** Light control level, e.g. "Sheer", "Semi-opaque", "Room darkening", "Blackout". */
    @Column(length = 60)
    private String opacity;

    /** Rooms the product is recommended for, e.g. "Living room", "Bedroom", "Kitchen". */
    @Convert(converter = StringListConverter.class)
    @Column(name = "suitable_rooms", columnDefinition = "TEXT")
    private List<String> suitableRooms;

    /** Visual style, e.g. "Modern", "Classic", "Minimalist", "Traditional". */
    @Column(name = "design_style", length = 80)
    private String designStyle;

    /** Free-text notes on the design/structure plan (pleats, lining, hardware, install notes). */
    @Column(name = "structure_notes", columnDefinition = "TEXT")
    private String structureNotes;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE, INACTIVE
}

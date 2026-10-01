package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** A bill line inside a {@link Bundle}, plus the work spec the tailor needs (JSON text). */
@Entity
@Table(name = "bundle_items", indexes = {
    @Index(name = "idx_bundle_item_bundle", columnList = "bundle_id")
})
@Getter
@Setter
public class BundleItem extends BaseEntity {

    @Column(name = "bundle_id", nullable = false)
    private Long bundleId;

    @Column(name = "invoice_item_id")
    private Long invoiceItemId;

    @Column(name = "product_id")
    private Long productId;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal quantity = BigDecimal.ONE;

    @Column(length = 30)
    private String unit;

    /** Free-form JSON: {"type":"Curtain","width":..,"height":..,"pleat":..,"lining":..}. */
    @Column(name = "work_spec", columnDefinition = "TEXT")
    private String workSpec;

    @Column(columnDefinition = "TEXT")
    private String notes;

    /** JSON array of reference photo URLs. */
    @Column(name = "photo_urls", columnDefinition = "TEXT")
    private String photoUrls;

    @Column(name = "is_done", nullable = false)
    private Boolean done = false;
}

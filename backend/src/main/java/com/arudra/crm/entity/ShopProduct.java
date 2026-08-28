package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Website shop product. Distinct from the inventory {@link Product} — this is the storefront catalog. */
@Entity
@Table(name = "shop_products")
@Getter
@Setter
public class ShopProduct extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 220, unique = true)
    private String slug;

    @Column(length = 50)
    private String sku;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ShopCategory category;

    @Column(name = "short_description", length = 500)
    private String shortDescription;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "discount_price", precision = 15, scale = 2)
    private BigDecimal discountPrice;

    @Column(nullable = false)
    private Integer stock = 0;

    @Column(nullable = false)
    private Double rating = 0.0;

    @Column(name = "review_count", nullable = false)
    private Integer reviewCount = 0;

    @Column(nullable = false)
    private Boolean featured = false;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(length = 200)
    private String material;

    @Column(length = 200)
    private String dimensions;

    /** JSON array of extra image URLs. */
    @Column(name = "gallery_json", columnDefinition = "TEXT")
    private String galleryJson;

    /** JSON array of {label,value} spec rows. */
    @Column(name = "specifications_json", columnDefinition = "TEXT")
    private String specificationsJson;
}

package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Website shop category (Furniture, Lighting, Décor…). Distinct from inventory categories. */
@Entity
@Table(name = "shop_categories")
@Getter
@Setter
public class ShopCategory extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 120, unique = true)
    private String slug;

    @Column(length = 50)
    private String icon;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(nullable = false)
    private Boolean active = true;
}

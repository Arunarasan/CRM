package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** One quoted product line of a project (Category → Product), tracked through its work steps. */
@Getter
@Setter
@Entity
@Table(name = "project_work_lines")
public class ProjectWorkLine extends BaseEntity {

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "quotation_item_id")
    private Long quotationItemId;

    @Column(name = "boq_item_id")
    private Long boqItemId;

    @Column(nullable = false, length = 150)
    private String category;

    @Column(name = "product_id")
    private Long productId;

    @Column(name = "item_name", nullable = false, length = 255)
    private String itemName;

    @Column(length = 100)
    private String color;

    @Column(length = 255)
    private String location;

    @Column(precision = 15, scale = 3)
    private BigDecimal quantity;

    @Column(length = 30)
    private String unit;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(nullable = false)
    private Boolean active = true;
}

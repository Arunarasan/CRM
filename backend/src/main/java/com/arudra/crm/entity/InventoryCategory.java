package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "inventory_categories")
public class InventoryCategory extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    /** Self-reference for unlimited category depth (null = top-level category). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "parent"})
    private InventoryCategory parent;

    @Column(length = 30)
    private String code;
}

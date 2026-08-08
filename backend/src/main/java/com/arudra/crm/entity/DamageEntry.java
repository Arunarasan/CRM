package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Damaged-stock report: moves quantity out of usable stock into damaged_quantity. */
@Getter
@Setter
@Entity
@Table(name = "damage_entries", indexes = {
    @Index(name = "idx_de_product", columnList = "product_id")
})
public class DamageEntry extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "category", "subCategory", "supplier", "defaultWarehouse"})
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse warehouse;

    @Column(nullable = false)
    private Integer quantity;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsible_person_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User responsiblePerson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User reportedBy;

    @Column(nullable = false, length = 20)
    private String status = "REPORTED"; // REPORTED, WRITTEN_OFF
}

package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "inventory_items", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"product_id", "warehouse_id"})
})
public class InventoryItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @Column(nullable = false)
    private Integer quantity = 0;

    @Column(name = "reserved_quantity", nullable = false)
    private Integer reservedQuantity = 0;

    @Column(name = "damaged_quantity", nullable = false)
    private Integer damagedQuantity = 0;

    @Column(name = "in_transit_quantity", nullable = false)
    private Integer inTransitQuantity = 0;

    @Transient
    public Integer getAvailableQuantity() {
        return quantity - reservedQuantity;
    }
}

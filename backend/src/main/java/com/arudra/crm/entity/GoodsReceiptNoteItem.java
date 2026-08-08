package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "goods_receipt_note_items")
public class GoodsReceiptNoteItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grn_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "purchaseOrder", "warehouse", "receivedByUser", "photos"})
    private GoodsReceiptNote grn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "category", "subCategory", "supplier", "defaultWarehouse"})
    private Product product;

    @Column(name = "received_quantity", nullable = false)
    private Integer receivedQuantity;

    @Column(name = "accepted_quantity", nullable = false)
    private Integer acceptedQuantity;

    @Column(name = "rejected_quantity", nullable = false)
    private Integer rejectedQuantity = 0;

    @Column(name = "damaged_quantity", nullable = false)
    private Integer damagedQuantity = 0;

    /** Per-line quality outcome: PASS, PARTIAL_PASS, REJECT (null = not checked). */
    @Column(name = "qc_status", length = 20)
    private String qcStatus;

    @Column(length = 255)
    private String remarks;
}

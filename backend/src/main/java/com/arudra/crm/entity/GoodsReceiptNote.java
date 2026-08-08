package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "goods_receipt_notes")
public class GoodsReceiptNote extends BaseEntity {

    @Column(name = "grn_number", nullable = false, unique = true, length = 50)
    private String grnNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "warehouse", "boq", "phase", "room", "task", "purchaseRequest"})
    private PurchaseOrder purchaseOrder;

    @Column(nullable = false)
    private LocalDateTime date = LocalDateTime.now();

    /** Free-text receiver name (legacy). Prefer receivedByUser. */
    @Column(name = "received_by", length = 100)
    private String receivedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "received_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User receivedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse warehouse;

    @Column(name = "supplier_invoice_number", length = 50)
    private String supplierInvoiceNumber;

    @Column(name = "vehicle_number", length = 30)
    private String vehicleNumber;

    @Column(nullable = false, length = 50)
    private String status = "DRAFT"; // DRAFT, APPROVED

    /** Quality check outcome for the delivery: PENDING, PASS, PARTIAL_PASS, REJECT */
    @Column(name = "qc_status", nullable = false, length = 20)
    private String qcStatus = "PENDING";

    @Column(name = "qc_reason", columnDefinition = "TEXT")
    private String qcReason;

    @Column(name = "qc_remarks", columnDefinition = "TEXT")
    private String qcRemarks;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "grn", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GrnPhoto> photos = new ArrayList<>();
}

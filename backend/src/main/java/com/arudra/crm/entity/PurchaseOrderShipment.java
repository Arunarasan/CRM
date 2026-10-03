package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** One delivery of a purchase order, identified by the supplier's shipping/tracking ID. */
@Getter
@Setter
@Entity
@Table(name = "purchase_order_shipments")
public class PurchaseOrderShipment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id", nullable = false)
    @JsonIgnore
    private PurchaseOrder purchaseOrder;

    @Column(name = "shipping_id", nullable = false, length = 100)
    private String shippingId;

    @Column(name = "transporter_name", length = 150)
    private String transporterName;

    /** Where this parcel is delivered — customer site, our godown, or a transport office for pickup. */
    @Column(name = "delivery_place", length = 255)
    private String deliveryPlace;

    @Column(name = "dispatch_date")
    private LocalDate dispatchDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(nullable = false, length = 20)
    private String status = "IN_TRANSIT"; // IN_TRANSIT, RECEIVED

    @Column(name = "grn_id")
    private Long grnId;

    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    @Transient
    public Long getPurchaseOrderId() {
        return purchaseOrder != null ? purchaseOrder.getId() : null;
    }
}

package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/** Warehouse-to-warehouse stock transfer with an approval workflow. */
@Getter
@Setter
@Entity
@Table(name = "stock_transfers", indexes = {
    @Index(name = "idx_st_status", columnList = "status")
})
public class StockTransfer extends BaseEntity {

    @Column(name = "transfer_number", nullable = false, unique = true, length = 30)
    private String transferNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_warehouse_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse sourceWarehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_warehouse_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse destinationWarehouse;

    @Column(nullable = false, length = 20)
    private String status = "REQUESTED"; // REQUESTED, APPROVED, IN_TRANSIT, RECEIVED, CANCELLED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User approvedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "transfer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StockTransferItem> items = new ArrayList<>();
}

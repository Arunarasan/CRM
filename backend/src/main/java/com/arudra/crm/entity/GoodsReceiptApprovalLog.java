package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Append-only audit of goods-receipt approvals. One row is written whenever a GRN is approved,
 * from the desktop order page or the employee mobile portal. Fields are denormalised (supplier /
 * warehouse / approver names copied in) so the admin log reads without joins and stays intact even
 * if the source PO or GRN is later changed.
 */
@Getter
@Setter
@Entity
@Table(name = "goods_receipt_approval_logs")
public class GoodsReceiptApprovalLog extends BaseEntity {

    @Column(name = "grn_id")
    private Long grnId;

    @Column(name = "grn_number", length = 50)
    private String grnNumber;

    @Column(name = "purchase_order_id")
    private Long purchaseOrderId;

    @Column(name = "po_number", length = 50)
    private String poNumber;

    @Column(name = "supplier_name", length = 200)
    private String supplierName;

    @Column(name = "warehouse_name", length = 200)
    private String warehouseName;

    @Column(name = "approved_by_id")
    private Long approvedById;

    @Column(name = "approved_by_name", length = 150)
    private String approvedByName;

    @Column(name = "approved_by_role", length = 80)
    private String approvedByRole;

    /** PORTAL (employee mobile) or DESKTOP (order page). */
    @Column(name = "source", length = 20)
    private String source;

    @Column(name = "items_summary", columnDefinition = "TEXT")
    private String itemsSummary;

    @Column(name = "total_accepted_qty")
    private Integer totalAcceptedQty;

    @Column(name = "qc_status", length = 20)
    private String qcStatus;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;
}

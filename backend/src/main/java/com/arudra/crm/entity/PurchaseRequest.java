package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Purchase Request (PR). Two shapes share this table:
 * - Legacy/system low-stock rows: single product+warehouse+quantity on the header (SYSTEM triggered).
 * - Full manual PRs: multi-line {@link PurchaseRequestItem}s with requester, project/BOQ context,
 *   priority and a multi-level {@link PurchaseRequestApproval} chain.
 * Status: PENDING -> APPROVED/REJECTED -> CONVERTED (to PO). Legacy rows go PENDING -> CONVERTED/REJECTED directly.
 */
@Getter
@Setter
@Entity
@Table(name = "purchase_requests", indexes = {
    @Index(name = "idx_pr_status", columnList = "status"),
    @Index(name = "idx_pr_product", columnList = "product_id")
})
public class PurchaseRequest extends BaseEntity {

    @Column(name = "request_number", nullable = false, unique = true, length = 30)
    private String requestNumber;

    /** Legacy single-line shape (system low-stock scan). Null for multi-item manual PRs. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "category", "subCategory", "supplier", "defaultWarehouse"})
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Supplier supplier;

    private Integer quantity;

    @Column(name = "reorder_level_snapshot")
    private Integer reorderLevelSnapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boq_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "quotation", "lead", "customer", "phases"})
    private Boq boq;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User requestedBy;

    @Column(nullable = false, length = 20)
    private String priority = "MEDIUM"; // LOW, MEDIUM, HIGH, URGENT

    @Column(name = "required_date")
    private LocalDate requiredDate;

    @Column(columnDefinition = "TEXT")
    private String reason;

    /** Where the request originated: INVENTORY, PROJECT_MANAGER, SITE_ENGINEER, STORE_KEEPER, EMPLOYEE_REQUEST */
    @Column(nullable = false, length = 30)
    private String source = "INVENTORY";

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED, CONVERTED

    @Column(name = "triggered_by", nullable = false, length = 20)
    private String triggeredBy = "SYSTEM"; // SYSTEM, MANUAL

    /** Total approval levels required; currentLevel counts levels already approved. */
    @Column(name = "approval_levels", nullable = false)
    private Integer approvalLevels = 1;

    @Column(name = "current_level", nullable = false)
    private Integer currentLevel = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User approvedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    /** Set when this PR was raised from an employee field material request. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_request_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "items", "task", "project", "requestedBy", "approvedBy", "warehouse"})
    private MaterialRequest materialRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "converted_purchase_order_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "supplier", "project", "warehouse", "boq", "phase", "room", "task", "purchaseRequest"})
    private PurchaseOrder convertedPurchaseOrder;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "purchaseRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseRequestItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "purchaseRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("level ASC")
    private List<PurchaseRequestApproval> approvals = new ArrayList<>();
}

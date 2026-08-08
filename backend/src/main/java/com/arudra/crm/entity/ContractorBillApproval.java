package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One rung of a contractor bill's approval ladder: Site Engineer → Project Manager → Finance.
 * Rows are created up-front on submission so the pending desk is always queryable.
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_bill_approvals", indexes = {
    @Index(name = "idx_cba_bill", columnList = "bill_id"),
    @Index(name = "idx_cba_status", columnList = "status")
})
public class ContractorBillApproval extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id", nullable = false)
    private ContractorBill bill;

    @Column(nullable = false, length = 30)
    private String stage; // SITE_ENGINEER, PROJECT_MANAGER, FINANCE

    @Column(nullable = false)
    private Integer sequence = 1;

    @Column(nullable = false, length = 30)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles", "password"})
    private User approver;

    @Column(name = "acted_at")
    private LocalDateTime actedAt;

    /** Lets an approver certify a lower amount than claimed without editing the bill. */
    @Column(name = "approved_amount", precision = 15, scale = 2)
    private BigDecimal approvedAmount;

    @Column(columnDefinition = "TEXT")
    private String comments;
}

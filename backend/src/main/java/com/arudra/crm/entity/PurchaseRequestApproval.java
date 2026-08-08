package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** One level of a purchase request's approval chain (level 1 first). */
@Getter
@Setter
@Entity
@Table(name = "purchase_request_approvals")
public class PurchaseRequestApproval extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_request_id", nullable = false)
    private PurchaseRequest purchaseRequest;

    @Column(nullable = false)
    private Integer level;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User approver;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED

    @Column(columnDefinition = "TEXT")
    private String comments;

    @Column(name = "acted_at")
    private LocalDateTime actedAt;
}

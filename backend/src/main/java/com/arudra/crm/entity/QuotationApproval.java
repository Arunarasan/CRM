package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "quotation_approvals")
public class QuotationApproval extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    private Quotation quotation;

    @Column(name = "approval_level", nullable = false, length = 50)
    private String approvalLevel; // SALES, MANAGER, CUSTOMER

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id")
    private User reviewer; // Can be null if it's Customer review

    @Column(length = 50, nullable = false)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED

    @Column(columnDefinition = "TEXT")
    private String comments;
    
    @Column(name = "approval_date")
    private LocalDateTime approvalDate;
}

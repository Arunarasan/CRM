package com.arudra.crm.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "project_customer_approvals", indexes = {
    @Index(name = "idx_pca_project", columnList = "project_id")
})
public class ProjectCustomerApproval extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @NotBlank
    @Column(name = "approval_type", length = 100)
    private String approvalType; // Design Approval, Material Approval, Stage Approval, Completion Approval

    @NotBlank
    @Column(nullable = false, length = 50)
    private String status; // PENDING, APPROVED, REJECTED

    @Column(name = "digital_signature_base64", columnDefinition = "TEXT")
    private String digitalSignatureBase64;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "approval_date")
    private LocalDateTime approvalDate;
}

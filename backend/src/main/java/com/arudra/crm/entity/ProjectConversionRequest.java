package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A field employee's "Customer Agreed" on a lead quote, waiting for an admin to approve it before the
 * project is created. Carries the customer's advance (optional) so it can be recorded on approval.
 */
@Getter
@Setter
@Entity
@Table(name = "project_conversion_requests")
public class ProjectConversionRequest extends BaseEntity {

    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";

    @Column(name = "lead_id", nullable = false)
    private Long leadId;

    @Column(name = "boq_id")
    private Long boqId;

    @Column(name = "quotation_id")
    private Long quotationId;

    @Column(name = "quote_total", precision = 15, scale = 2)
    private BigDecimal quoteTotal;

    @Column(name = "advance_amount", precision = 15, scale = 2)
    private BigDecimal advanceAmount;

    @Column(name = "payment_method", length = 30)
    private String paymentMethod;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    @Column(name = "proof_url", length = 500)
    private String proofUrl;

    @Column(length = 1000)
    private String note;

    @Column(nullable = false, length = 20)
    private String status = PENDING;

    @Column(name = "requested_by_id")
    private Long requestedById;

    @Column(name = "decided_by_id")
    private Long decidedById;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "decision_note", length = 1000)
    private String decisionNote;

    @Column(name = "project_id")
    private Long projectId;
}

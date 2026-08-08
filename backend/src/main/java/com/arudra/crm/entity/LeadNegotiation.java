package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "lead_negotiations")
public class LeadNegotiation extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id", nullable = false)
    private Lead lead;

    @Column(name = "negotiation_date")
    private LocalDateTime negotiationDate;

    @Column(name = "quoted_amount", precision = 15, scale = 2)
    private BigDecimal quotedAmount;

    @Column(name = "negotiated_amount", precision = 15, scale = 2)
    private BigDecimal negotiatedAmount;

    @Column(length = 50)
    private String status; // Pending, Agreed, Rejected

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "negotiated_by")
    private User negotiatedBy;
}

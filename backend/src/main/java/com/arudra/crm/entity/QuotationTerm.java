package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "quotation_terms")
public class QuotationTerm extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quotation_id", nullable = false)
    private Quotation quotation;

    @Column(name = "term_category", nullable = false, length = 100)
    private String termCategory; // Warranty, Installation, Payment, Cancellation, etc.

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;
    
    @Column(name = "is_standard")
    private Boolean isStandard = true;
}

package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One immutable ledger line per financial event on a customer account.
 * Debit increases what the customer owes (invoices, debit notes, paid refunds);
 * credit decreases it (payments, credit notes). Corrections are posted as
 * reversal entries, never by editing history. Running balances are computed.
 */
@Getter
@Setter
@Entity
@Table(name = "customer_ledger_entries", indexes = {
    @Index(name = "idx_cle_customer_date", columnList = "customer_id, entry_date"),
    @Index(name = "idx_cle_reference", columnList = "reference_type, reference_id")
})
public class CustomerLedgerEntry extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "addresses", "documents", "notes", "contactPersons", "tags"})
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation", "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    /** INVOICE, PAYMENT, CREDIT_NOTE, DEBIT_NOTE, REFUND, REVERSAL */
    @Column(name = "entry_type", nullable = false, length = 30)
    private String entryType;

    @Column(name = "reference_type", length = 30)
    private String referenceType; // INVOICE, PAYMENT, NOTE, REFUND

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "reference_number", length = 50)
    private String referenceNumber;

    @Column(length = 500)
    private String description;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal debit = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal credit = BigDecimal.ZERO;
}

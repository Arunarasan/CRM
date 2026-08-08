package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One immutable row per contractor financial event. Mirrors {@link CustomerLedgerEntry}:
 * running and closing balances are computed on read, never stored, and corrections are
 * posted as REVERSAL rows rather than edits.
 *
 * <p>Sign convention (contractor is a payable): a bill CREDITS the contractor (we owe more),
 * a payment DEBITS them (we owe less).
 */
@Getter
@Setter
@Entity
@Table(name = "contractor_ledger_entries", indexes = {
    @Index(name = "idx_cle_contractor", columnList = "contractor_id"),
    @Index(name = "idx_cle_date", columnList = "entry_date"),
    @Index(name = "idx_cle_ref", columnList = "reference_type, reference_id")
})
public class ContractorLedgerEntry extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contractor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user", "notes"})
    private Contractor contractor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "lead", "quotation",
            "siteVisit", "measurement", "boq", "assignedEmployees"})
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_package_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project", "phase", "room", "boq"})
    private ContractorWorkPackage workPackage;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate = LocalDate.now();

    @Column(name = "entry_type", nullable = false, length = 30)
    private String entryType;
    // OPENING, BILL, PAYMENT, ADVANCE, RETENTION_HELD, RETENTION_RELEASED,
    // MATERIAL_RECOVERY, PENALTY, REVERSAL

    @Column(name = "reference_type", length = 30)
    private String referenceType;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "reference_number", length = 50)
    private String referenceNumber;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal debit = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal credit = BigDecimal.ZERO;
}

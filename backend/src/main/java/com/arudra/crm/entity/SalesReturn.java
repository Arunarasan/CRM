package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A customer returning goods from a counter sale or invoice. Restocks inventory and settles the
 * value as a credit note (store credit) or a cash refund. Sibling of {@code PurchaseReturn} but on
 * the sales/customer side.
 */
@Getter
@Setter
@Entity
@Table(name = "sales_returns")
public class SalesReturn extends BaseEntity {

    @Column(name = "return_number", nullable = false, unique = true, length = 50)
    private String returnNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "customer", "project", "quotation", "boq", "paymentSchedule"})
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "addresses", "documents", "notes", "contactPersons", "tags"})
    private Customer customer;

    @Column(nullable = false)
    private LocalDate date = LocalDate.now();

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "sub_total", precision = 15, scale = 2)
    private BigDecimal subTotal = BigDecimal.ZERO;

    @Column(name = "gst_amount", precision = 15, scale = 2)
    private BigDecimal gstAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    /** REFUND (cash out) or CREDIT_NOTE (store credit). */
    @Column(name = "settlement_mode", length = 20)
    private String settlementMode = "CREDIT_NOTE";

    @Column(name = "refund_method", length = 50)
    private String refundMethod;

    @Column(nullable = false)
    private Boolean restocked = true;

    @Column(name = "warehouse_id")
    private Long warehouseId;

    @Column(name = "note_id")
    private Long noteId;

    @Column(name = "refund_id")
    private Long refundId;

    @Column(nullable = false, length = 20)
    private String status = "COMPLETED";
}

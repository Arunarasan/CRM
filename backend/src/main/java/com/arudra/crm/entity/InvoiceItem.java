package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "invoice_items")
public class InvoiceItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @Column(nullable = false, length = 255)
    private String description;

    @Column(name = "hsn_code", length = 20)
    private String hsnCode;

    @Column(length = 30)
    private String unit;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 15, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "gst_rate", precision = 5, scale = 2)
    private BigDecimal gstRate = BigDecimal.ZERO;

    @Column(name = "total_price", precision = 15, scale = 2, nullable = false)
    private BigDecimal totalPrice;
}

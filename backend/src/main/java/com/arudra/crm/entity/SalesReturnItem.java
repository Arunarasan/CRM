package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "sales_return_items")
public class SalesReturnItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_return_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "invoice", "customer"})
    private SalesReturn salesReturn;

    /** The invoice line this return came from (plain id, no FK) — used to cap returnable qty. */
    @Column(name = "invoice_item_id")
    private Long invoiceItemId;

    @Column(name = "product_id")
    private Long productId;

    @Column(length = 255)
    private String description;

    @Column(name = "hsn_code", length = 20)
    private String hsnCode;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 15, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "gst_rate", precision = 5, scale = 2)
    private BigDecimal gstRate = BigDecimal.ZERO;

    @Column(name = "line_total", precision = 15, scale = 2, nullable = false)
    private BigDecimal lineTotal;

    /** GOOD (back to usable stock) or DAMAGED (restocked then moved to the damaged bucket). */
    @Column(name = "item_condition", length = 20)
    private String condition = "GOOD";
}

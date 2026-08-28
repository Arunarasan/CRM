package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** A website shop order placed by a customer. Payment is gateway-driven — no card data stored. */
@Entity
@Table(name = "orders")
@Getter
@Setter
public class Order extends BaseEntity {

    @Column(name = "order_number", nullable = false, length = 50, unique = true)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    /** PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED */
    @Column(nullable = false, length = 30)
    private String status = "PENDING";

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "delivery_fee", nullable = false, precision = 15, scale = 2)
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "payment_method", length = 30)
    private String paymentMethod;

    /** UNPAID | PAID | REFUNDED */
    @Column(name = "payment_status", nullable = false, length = 30)
    private String paymentStatus = "UNPAID";

    @Column(name = "payment_ref", length = 120)
    private String paymentRef;

    @Column(name = "contact_name", length = 150)
    private String contactName;

    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    @Column(name = "contact_email", length = 150)
    private String contactEmail;

    @Column(name = "delivery_address", columnDefinition = "TEXT")
    private String deliveryAddress;

    @Column(length = 100)
    private String city;

    @Column(length = 20)
    private String pincode;

    @Column(name = "placed_at")
    private LocalDateTime placedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
}

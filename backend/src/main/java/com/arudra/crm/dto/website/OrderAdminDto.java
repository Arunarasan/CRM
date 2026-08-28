package com.arudra.crm.dto.website;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * CRM-side views of website shop orders ({@code /api/website/orders}). Curated projections of the
 * {@link com.arudra.crm.entity.Order} aggregate — the admin sees the buyer, the line items, and the
 * money, and can drive the fulfilment status + payment status.
 */
public class OrderAdminDto {

    /** Row in the orders list. */
    public record OrderSummary(
            Long id,
            String orderNumber,
            String customerName,
            String status,
            String paymentStatus,
            String paymentMethod,
            BigDecimal total,
            Integer itemCount,
            LocalDateTime placedAt) {}

    public record OrderItemView(
            Long id,
            Long productId,
            String productName,
            String sku,
            BigDecimal unitPrice,
            Integer qty,
            BigDecimal lineTotal) {}

    /** Full order detail. */
    public record OrderDetail(
            Long id,
            String orderNumber,
            Long customerId,
            String customerName,
            String status,
            String paymentStatus,
            String paymentMethod,
            String paymentRef,
            BigDecimal subtotal,
            BigDecimal deliveryFee,
            BigDecimal total,
            String contactName,
            String contactPhone,
            String contactEmail,
            String deliveryAddress,
            String city,
            String pincode,
            LocalDateTime placedAt,
            List<OrderItemView> items) {}

    /** Move an order along the fulfilment workflow. */
    public record StatusUpdate(String status) {}

    /** Record a payment outcome (gateway ref optional). */
    public record PaymentUpdate(String paymentStatus, String paymentRef) {}
}

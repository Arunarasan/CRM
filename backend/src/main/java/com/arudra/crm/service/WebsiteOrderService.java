package com.arudra.crm.service;

import com.arudra.crm.dto.website.CheckoutRequest;
import com.arudra.crm.dto.website.OrderAdminDto.*;
import com.arudra.crm.entity.Customer;
import com.arudra.crm.entity.Order;
import com.arudra.crm.entity.OrderItem;
import com.arudra.crm.entity.ShopProduct;
import com.arudra.crm.repository.CustomerRepository;
import com.arudra.crm.repository.OrderRepository;
import com.arudra.crm.repository.ShopProductRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The website shop order engine. Two sides, one aggregate:
 *  - {@link #placeOrder} is the public guest checkout — it re-prices every line from
 *    {@code shop_products} (never trusting the client), finds-or-creates the buyer's
 *    {@link Customer}, persists the {@link Order}, and notifies staff.
 *  - the admin methods back {@code /api/website/orders} so the CRM can list, inspect, and drive the
 *    fulfilment + payment status of orders.
 *
 * Delivery pricing mirrors the storefront: free above {@link #FREE_DELIVERY_THRESHOLD}, else
 * {@link #DELIVERY_FEE}.
 */
@Service
public class WebsiteOrderService {

    public static final BigDecimal DELIVERY_FEE = new BigDecimal("1500");
    public static final BigDecimal FREE_DELIVERY_THRESHOLD = new BigDecimal("50000");

    /** Allowed fulfilment states, in order. */
    private static final Set<String> ORDER_STATUSES =
            Set.of("PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED");
    private static final Set<String> PAYMENT_STATUSES = Set.of("UNPAID", "PAID", "REFUNDED");

    private final OrderRepository orderRepository;
    private final ShopProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final NotificationService notificationService;
    private final CustomerNotificationService customerNotificationService;

    public WebsiteOrderService(OrderRepository orderRepository, ShopProductRepository productRepository,
                               CustomerRepository customerRepository, NotificationService notificationService,
                               CustomerNotificationService customerNotificationService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.customerRepository = customerRepository;
        this.notificationService = notificationService;
        this.customerNotificationService = customerNotificationService;
    }

    // =========================================================================================
    // Public guest checkout
    // =========================================================================================

    @Transactional
    public Map<String, Object> placeOrder(CheckoutRequest req) {
        if (req == null || req.items() == null || req.items().isEmpty()) {
            throw new IllegalArgumentException("Your cart is empty.");
        }
        String name = trim(req.name());
        String email = trim(req.email());
        String phone = trim(req.phone());
        if (isBlank(name)) throw new IllegalArgumentException("Please provide your name.");
        if (isBlank(email) && isBlank(phone)) {
            throw new IllegalArgumentException("Please provide an email or phone so we can reach you.");
        }

        Customer customer = findOrCreateCustomer(name, email, phone, req);

        Order order = new Order();
        order.setCustomer(customer);
        order.setStatus("PENDING");
        order.setPaymentStatus("UNPAID");
        order.setPaymentMethod(normalizePaymentMethod(req.paymentMethod()));
        order.setOrderNumber(generateOrderNumber());
        order.setPlacedAt(LocalDateTime.now());
        order.setContactName(name);
        order.setContactPhone(phone);
        order.setContactEmail(email);
        order.setDeliveryAddress(trim(req.address()));
        order.setCity(trim(req.city()));
        order.setPincode(trim(req.pincode()));

        BigDecimal subtotal = BigDecimal.ZERO;
        for (CheckoutRequest.Item line : req.items()) {
            if (line.productId() == null) continue;
            int qty = line.qty() == null || line.qty() < 1 ? 1 : line.qty();
            ShopProduct product = productRepository.findByIdAndIsDeletedFalse(line.productId())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "A product in your cart is no longer available."));
            if (Boolean.FALSE.equals(product.getActive())) {
                throw new IllegalArgumentException("\"" + product.getName() + "\" is no longer available.");
            }
            BigDecimal unitPrice = product.getDiscountPrice() != null
                    ? product.getDiscountPrice() : product.getPrice();
            if (unitPrice == null) unitPrice = BigDecimal.ZERO;
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(qty));

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProduct(product);
            item.setProductName(product.getName());
            item.setSku(product.getSku());
            item.setUnitPrice(unitPrice);
            item.setQty(qty);
            item.setLineTotal(lineTotal);
            order.getItems().add(item);

            subtotal = subtotal.add(lineTotal);
        }
        if (order.getItems().isEmpty()) {
            throw new IllegalArgumentException("None of the items in your cart are available.");
        }

        BigDecimal delivery = deliveryFeeFor(subtotal);
        order.setSubtotal(subtotal);
        order.setDeliveryFee(delivery);
        order.setTotal(subtotal.add(delivery));

        Order saved = orderRepository.save(order);

        // Alert staff and acknowledge the buyer.
        notificationService.dispatchToAdmins(
                "New website order",
                saved.getOrderNumber() + " · " + customer.getName() + " · ₹" + saved.getTotal(),
                "ORDER", "/website/orders", null);
        customerNotificationService.notify(customer, "ORDER",
                "Order received",
                "We've received your order " + saved.getOrderNumber()
                        + ". Our team will confirm the details shortly.",
                "/portal/orders");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", saved.getId());
        out.put("orderNumber", saved.getOrderNumber());
        out.put("subtotal", saved.getSubtotal());
        out.put("deliveryFee", saved.getDeliveryFee());
        out.put("total", saved.getTotal());
        out.put("status", saved.getStatus());
        return out;
    }

    private Customer findOrCreateCustomer(String name, String email, String phone, CheckoutRequest req) {
        Customer existing = null;
        if (!isBlank(email)) {
            existing = customerRepository
                    .findFirstByEmailIgnoreCaseAndIsDeletedFalseOrderByIdAsc(email).orElse(null);
        }
        if (existing == null && !isBlank(phone)) {
            existing = customerRepository
                    .findFirstByPhoneAndIsDeletedFalseOrderByIdAsc(phone).orElse(null);
        }
        if (existing != null) return existing;

        Customer c = new Customer();
        c.setName(name);
        if (!isBlank(email)) c.setEmail(email);
        if (!isBlank(phone)) c.setPhone(phone);
        c.setCity(trim(req.city()));
        c.setPincode(trim(req.pincode()));
        c.setBillingAddress(trim(req.address()));
        c.setCustomerType("Individual");
        c.setStatus("Active");
        c.setCustomerSince(LocalDate.now());
        c.setCustomerCode("CUST-" + System.currentTimeMillis());
        return customerRepository.save(c);
    }

    private BigDecimal deliveryFeeFor(BigDecimal subtotal) {
        if (subtotal.signum() <= 0) return BigDecimal.ZERO;
        return subtotal.compareTo(FREE_DELIVERY_THRESHOLD) >= 0 ? BigDecimal.ZERO : DELIVERY_FEE;
    }

    private String normalizePaymentMethod(String method) {
        if (isBlank(method)) return "PENDING";
        return method.trim().toUpperCase();
    }

    private String generateOrderNumber() {
        // Brand-prefixed, unique, human-readable. Collisions at this scale are not a concern.
        return "JBD" + System.currentTimeMillis();
    }

    // =========================================================================================
    // CRM admin — /api/website/orders
    // =========================================================================================

    @Transactional(readOnly = true)
    public List<OrderSummary> list(String status) {
        List<Order> orders = isBlank(status)
                ? orderRepository.findByIsDeletedFalseOrderByCreatedAtDesc()
                : orderRepository.findByStatusAndIsDeletedFalseOrderByCreatedAtDesc(status.trim().toUpperCase());
        List<OrderSummary> out = new ArrayList<>();
        for (Order o : orders) out.add(toSummary(o));
        return out;
    }

    @Transactional(readOnly = true)
    public OrderDetail get(Long id) {
        return toDetail(load(id));
    }

    @Transactional
    public OrderDetail updateStatus(Long id, String status) {
        if (isBlank(status) || !ORDER_STATUSES.contains(status.trim().toUpperCase())) {
            throw new IllegalArgumentException("Unknown order status: " + status);
        }
        Order o = load(id);
        String next = status.trim().toUpperCase();
        o.setStatus(next);
        Order saved = orderRepository.save(o);
        if (saved.getCustomer() != null) {
            customerNotificationService.notify(saved.getCustomer(), "ORDER",
                    "Order " + saved.getOrderNumber() + " updated",
                    "Your order is now " + humanize(next) + ".",
                    "/portal/orders");
        }
        return toDetail(saved);
    }

    @Transactional
    public OrderDetail updatePayment(Long id, String paymentStatus, String paymentRef) {
        if (isBlank(paymentStatus) || !PAYMENT_STATUSES.contains(paymentStatus.trim().toUpperCase())) {
            throw new IllegalArgumentException("Unknown payment status: " + paymentStatus);
        }
        Order o = load(id);
        o.setPaymentStatus(paymentStatus.trim().toUpperCase());
        if (paymentRef != null) o.setPaymentRef(trim(paymentRef));
        return toDetail(orderRepository.save(o));
    }

    private Order load(Long id) {
        return orderRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Order not found: " + id));
    }

    private OrderSummary toSummary(Order o) {
        return new OrderSummary(
                o.getId(), o.getOrderNumber(),
                o.getCustomer() != null ? o.getCustomer().getName() : o.getContactName(),
                o.getStatus(), o.getPaymentStatus(), o.getPaymentMethod(),
                o.getTotal(), o.getItems() == null ? 0 : o.getItems().size(), o.getPlacedAt());
    }

    private OrderDetail toDetail(Order o) {
        List<OrderItemView> items = new ArrayList<>();
        if (o.getItems() != null) {
            for (OrderItem it : o.getItems()) {
                items.add(new OrderItemView(
                        it.getId(),
                        it.getProduct() != null ? it.getProduct().getId() : null,
                        it.getProductName(), it.getSku(),
                        it.getUnitPrice(), it.getQty(), it.getLineTotal()));
            }
        }
        return new OrderDetail(
                o.getId(), o.getOrderNumber(),
                o.getCustomer() != null ? o.getCustomer().getId() : null,
                o.getCustomer() != null ? o.getCustomer().getName() : o.getContactName(),
                o.getStatus(), o.getPaymentStatus(), o.getPaymentMethod(), o.getPaymentRef(),
                o.getSubtotal(), o.getDeliveryFee(), o.getTotal(),
                o.getContactName(), o.getContactPhone(), o.getContactEmail(),
                o.getDeliveryAddress(), o.getCity(), o.getPincode(),
                o.getPlacedAt(), items);
    }

    private static String humanize(String status) {
        String s = status.toLowerCase().replace('_', ' ');
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Procurement analytics: summary, supplier performance, deliveries, outstanding, trends, material costs. */
@Service
public class PurchaseReportService {

    @Autowired private PurchaseOrderRepository poRepository;
    @Autowired private PurchaseOrderItemRepository poiRepository;
    @Autowired private GoodsReceiptNoteRepository grnRepository;
    @Autowired private PurchaseBillRepository billRepository;
    @Autowired private PurchasePaymentRepository paymentRepository;
    @Autowired private PurchaseRequestRepository purchaseRequestRepository;
    @Autowired private SupplierRepository supplierRepository;
    @Autowired private InventoryItemRepository inventoryItemRepository;
    @Autowired private ProductSupplierService productSupplierService;

    private boolean inRange(LocalDate date, LocalDate from, LocalDate to) {
        if (date == null) return false;
        if (from != null && date.isBefore(from)) return false;
        if (to != null && date.isAfter(to)) return false;
        return true;
    }

    /** Purchase summary: order counts and value by status for a period. */
    public Map<String, Object> purchaseSummary(LocalDate from, LocalDate to) {
        List<PurchaseOrder> orders = poRepository.findAll().stream()
                .filter(po -> inRange(po.getDate(), from, to))
                .toList();

        Map<String, Long> countByStatus = new LinkedHashMap<>();
        Map<String, BigDecimal> valueByStatus = new LinkedHashMap<>();
        BigDecimal totalValue = BigDecimal.ZERO;
        for (PurchaseOrder po : orders) {
            countByStatus.merge(po.getStatus(), 1L, Long::sum);
            BigDecimal amount = po.getTotalAmount() != null ? po.getTotalAmount() : BigDecimal.ZERO;
            valueByStatus.merge(po.getStatus(), amount, BigDecimal::add);
            if (!"CANCELLED".equals(po.getStatus()) && !"REJECTED".equals(po.getStatus())) {
                totalValue = totalValue.add(amount);
            }
        }

        // Paid vs pending across the period's (non-cancelled) orders: pending = ordered − paid.
        BigDecimal totalPaid = BigDecimal.ZERO;
        for (PurchaseOrder po : orders) {
            if ("CANCELLED".equals(po.getStatus()) || "REJECTED".equals(po.getStatus())) continue;
            totalPaid = totalPaid.add(paymentRepository.findByPurchaseOrderId(po.getId()).stream()
                    .map(PurchasePayment::getAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add));
        }
        BigDecimal totalPending = totalValue.subtract(totalPaid).max(BigDecimal.ZERO);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalOrders", orders.size());
        result.put("totalPurchaseValue", totalValue);
        result.put("totalPaid", totalPaid);
        result.put("totalPending", totalPending);
        result.put("countByStatus", countByStatus);
        result.put("valueByStatus", valueByStatus);
        result.put("totalRequests", purchaseRequestRepository.count());
        result.put("pendingRequests", purchaseRequestRepository.countByStatus("PENDING"));
        return result;
    }

    /**
     * Plain-language "Purchasing Home" overview — answers the owner's four questions in one call:
     * how much was ordered/landed/paid/still-to-pay (totals + per-supplier ledger), what stock needs
     * buying from suppliers now (below reorder level), and what's ordered but not yet landed (open POs).
     * Landed value = Σ(receivedQuantity × unitPrice) on PO items — the value physically received.
     */
    public Map<String, Object> overview() {
        List<Map<String, Object>> suppliers = new ArrayList<>();
        BigDecimal totOrdered = BigDecimal.ZERO, totLanded = BigDecimal.ZERO,
                   totPaid = BigDecimal.ZERO, totToPay = BigDecimal.ZERO;

        for (Supplier supplier : supplierRepository.findAllByOrderByNameAsc()) {
            List<PurchaseOrder> orders = poRepository.findBySupplierIdOrderByIdDesc(supplier.getId());
            if (orders.isEmpty()) continue;

            BigDecimal ordered = BigDecimal.ZERO, landed = BigDecimal.ZERO;
            for (PurchaseOrder po : orders) {
                if ("CANCELLED".equals(po.getStatus()) || "REJECTED".equals(po.getStatus())) continue;
                if (po.getTotalAmount() != null) ordered = ordered.add(po.getTotalAmount());
                for (PurchaseOrderItem it : poiRepository.findByPurchaseOrderId(po.getId())) {
                    if (it.getReceivedQuantity() != null && it.getReceivedQuantity() > 0 && it.getUnitPrice() != null) {
                        landed = landed.add(it.getUnitPrice().multiply(BigDecimal.valueOf(it.getReceivedQuantity())));
                    }
                }
            }
            BigDecimal paid = paymentRepository.findBySupplierIdOrderByPaymentDateDesc(supplier.getId()).stream()
                    .map(PurchasePayment::getAmount).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            // Pending consistently = ordered − paid (order-first model), clamped at 0; overpayment is
            // supplier-account credit, not a negative "still to pay". Matches order/profile/report screens.
            BigDecimal toPay = ordered.subtract(paid).max(BigDecimal.ZERO);
            BigDecimal yetToLand = ordered.subtract(landed).max(BigDecimal.ZERO);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("supplierId", supplier.getId());
            row.put("supplierName", supplier.getName());
            row.put("ordered", ordered);
            row.put("landed", landed);
            row.put("paid", paid);
            row.put("toPay", toPay);
            row.put("yetToLand", yetToLand);
            suppliers.add(row);

            totOrdered = totOrdered.add(ordered);
            totLanded = totLanded.add(landed);
            totPaid = totPaid.add(paid);
            totToPay = totToPay.add(toPay);
        }
        suppliers.sort((a, b) -> ((BigDecimal) b.get("toPay")).compareTo((BigDecimal) a.get("toPay")));

        // Buy now — inventory at/below reorder level, with a suggested (preferred) supplier.
        List<Map<String, Object>> buyNow = new ArrayList<>();
        for (InventoryItem item : inventoryItemRepository.findAll()) {
            Product p = item.getProduct();
            Integer reorder = p.getReorderLevel();
            if (reorder == null || reorder <= 0 || item.getAvailableQuantity() > reorder) continue;
            Supplier pref = productSupplierService.getPreferredSupplier(p.getId()).orElse(null);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("productId", p.getId());
            row.put("productName", p.getName());
            row.put("unit", p.getUnit());
            row.put("currentStock", item.getAvailableQuantity());
            row.put("reorderLevel", reorder);
            row.put("warehouseName", item.getWarehouse() != null ? item.getWarehouse().getName() : null);
            row.put("suggestedSupplierId", pref != null ? pref.getId() : null);
            row.put("suggestedSupplierName", pref != null ? pref.getName() : null);
            buyNow.add(row);
        }

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("ordered", totOrdered);
        totals.put("landed", totLanded);
        totals.put("paid", totPaid);
        totals.put("toPay", totToPay);
        totals.put("yetToLand", totOrdered.subtract(totLanded).max(BigDecimal.ZERO));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totals", totals);
        result.put("suppliers", suppliers);
        result.put("buyNow", buyNow);
        result.put("incoming", pendingDeliveries()); // open POs still expecting material
        return result;
    }

    /** Per-supplier: volume, value, on-time delivery %, outstanding balance, rating. */
    public List<Map<String, Object>> supplierPerformance() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Supplier supplier : supplierRepository.findAllByOrderByNameAsc()) {
            List<PurchaseOrder> orders = poRepository.findBySupplierIdOrderByIdDesc(supplier.getId());
            if (orders.isEmpty()) continue;

            BigDecimal totalValue = orders.stream()
                    .filter(po -> !"CANCELLED".equals(po.getStatus()) && !"REJECTED".equals(po.getStatus()))
                    .map(PurchaseOrder::getTotalAmount).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // On-time from actual goods-receipt dates vs expected date (any received, non-cancelled PO).
            int delivered = 0, onTime = 0, late = 0, delayDays = 0;
            for (PurchaseOrder po : orders) {
                if (po.getExpectedDeliveryDate() == null
                        || "CANCELLED".equals(po.getStatus()) || "REJECTED".equals(po.getStatus())) continue;
                Optional<LocalDate> firstReceipt = grnRepository.findByPurchaseOrderId(po.getId()).stream()
                        .filter(g -> g.getDate() != null).map(g -> g.getDate().toLocalDate()).min(Comparator.naturalOrder());
                if (firstReceipt.isEmpty()) continue;
                delivered++;
                if (!firstReceipt.get().isAfter(po.getExpectedDeliveryDate())) onTime++;
                else { late++; delayDays += (int) java.time.temporal.ChronoUnit.DAYS.between(po.getExpectedDeliveryDate(), firstReceipt.get()); }
            }

            BigDecimal paid = paymentRepository.findBySupplierIdOrderByPaymentDateDesc(supplier.getId()).stream()
                    .map(PurchasePayment::getAmount).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal pending = totalValue.subtract(paid).max(BigDecimal.ZERO);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("supplierId", supplier.getId());
            row.put("supplierName", supplier.getName());
            row.put("rating", supplier.getPerformanceRating());
            row.put("totalOrders", orders.size());
            row.put("totalValue", totalValue);
            row.put("paid", paid);
            row.put("pending", pending);
            row.put("deliveredOrders", delivered);
            row.put("onTimeOrders", onTime);
            row.put("lateOrders", late);
            row.put("avgDelayDays", late > 0 ? Math.round((float) delayDays / late) : 0);
            row.put("onTimeDeliveryPercent", delivered > 0 ? Math.round(onTime * 100.0 / delivered) : null);
            rows.add(row);
        }
        rows.sort((a, b) -> ((BigDecimal) b.get("totalValue")).compareTo((BigDecimal) a.get("totalValue")));
        return rows;
    }

    /** Open POs still expecting material, with overdue-day counts. */
    public List<Map<String, Object>> pendingDeliveries() {
        List<Map<String, Object>> rows = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (PurchaseOrder po : poRepository.findByStatusIn(PurchaseService.OPEN_PO_STATUSES)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("poId", po.getId());
            row.put("poNumber", po.getPoNumber());
            row.put("supplierName", po.getSupplier() != null ? po.getSupplier().getName() : null);
            row.put("status", po.getStatus());
            row.put("expectedDeliveryDate", po.getExpectedDeliveryDate());
            row.put("totalAmount", po.getTotalAmount());
            row.put("daysOverdue", po.getExpectedDeliveryDate() != null && po.getExpectedDeliveryDate().isBefore(today)
                    ? java.time.temporal.ChronoUnit.DAYS.between(po.getExpectedDeliveryDate(), today) : 0);
            rows.add(row);
        }
        rows.sort((a, b) -> Long.compare((long) b.get("daysOverdue"), (long) a.get("daysOverdue")));
        return rows;
    }

    /** Unpaid/partially paid supplier invoices with balances. */
    public List<Map<String, Object>> outstandingPayments() {
        List<Map<String, Object>> rows = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (PurchaseBill bill : billRepository.findByStatusInOrderByDueDateAsc(List.of("UNPAID", "PARTIAL"))) {
            BigDecimal paid = paymentRepository.findByPurchaseBillId(bill.getId()).stream()
                    .map(PurchasePayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("billId", bill.getId());
            row.put("billNumber", bill.getBillNumber());
            row.put("supplierName", bill.getSupplier() != null ? bill.getSupplier().getName() : null);
            row.put("poNumber", bill.getPurchaseOrder() != null ? bill.getPurchaseOrder().getPoNumber() : null);
            row.put("totalAmount", bill.getTotalAmount());
            row.put("paidAmount", paid);
            row.put("balance", bill.getTotalAmount().subtract(paid));
            row.put("dueDate", bill.getDueDate());
            row.put("overdue", bill.getDueDate() != null && bill.getDueDate().isBefore(today));
            rows.add(row);
        }
        return rows;
    }

    /** Monthly purchase totals for the trailing 12 months. */
    public List<Map<String, Object>> purchaseTrends() {
        YearMonth start = YearMonth.now().minusMonths(11);
        Map<YearMonth, BigDecimal> valueByMonth = new TreeMap<>();
        Map<YearMonth, Long> countByMonth = new TreeMap<>();
        for (int i = 0; i < 12; i++) {
            valueByMonth.put(start.plusMonths(i), BigDecimal.ZERO);
            countByMonth.put(start.plusMonths(i), 0L);
        }
        for (PurchaseOrder po : poRepository.findAll()) {
            if (po.getDate() == null || "CANCELLED".equals(po.getStatus()) || "REJECTED".equals(po.getStatus())) continue;
            YearMonth month = YearMonth.from(po.getDate());
            if (!valueByMonth.containsKey(month)) continue;
            valueByMonth.merge(month, po.getTotalAmount() != null ? po.getTotalAmount() : BigDecimal.ZERO, BigDecimal::add);
            countByMonth.merge(month, 1L, Long::sum);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM yyyy");
        for (YearMonth month : valueByMonth.keySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", month.atDay(1).format(fmt));
            row.put("orders", countByMonth.get(month));
            row.put("value", valueByMonth.get(month));
            rows.add(row);
        }
        return rows;
    }

    /** Per-material purchase stats: quantity bought, avg/min/max/last price. */
    public List<Map<String, Object>> materialCostAnalysis() {
        Map<Long, List<PurchaseOrderItem>> byProduct = new LinkedHashMap<>();
        for (PurchaseOrderItem item : poiRepository.findAll()) {
            PurchaseOrder po = item.getPurchaseOrder();
            if (po == null || "CANCELLED".equals(po.getStatus()) || "REJECTED".equals(po.getStatus())) continue;
            byProduct.computeIfAbsent(item.getProduct().getId(), k -> new ArrayList<>()).add(item);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (List<PurchaseOrderItem> items : byProduct.values()) {
            Product product = items.get(0).getProduct();
            int totalQty = items.stream().mapToInt(PurchaseOrderItem::getQuantity).sum();
            BigDecimal totalValue = items.stream().map(PurchaseOrderItem::getTotalPrice)
                    .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
            List<BigDecimal> prices = items.stream().map(PurchaseOrderItem::getUnitPrice)
                    .filter(Objects::nonNull).toList();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("productId", product.getId());
            row.put("productName", product.getName());
            row.put("materialCode", product.getMaterialCode());
            row.put("unit", product.getUnit());
            row.put("totalQuantity", totalQty);
            row.put("totalValue", totalValue);
            row.put("averagePrice", totalQty > 0
                    ? totalValue.divide(BigDecimal.valueOf(totalQty), 2, RoundingMode.HALF_UP) : null);
            row.put("minPrice", prices.stream().min(Comparator.naturalOrder()).orElse(null));
            row.put("maxPrice", prices.stream().max(Comparator.naturalOrder()).orElse(null));
            row.put("lastPrice", prices.isEmpty() ? null : prices.get(prices.size() - 1));
            rows.add(row);
        }
        rows.sort((a, b) -> ((BigDecimal) b.get("totalValue")).compareTo((BigDecimal) a.get("totalValue")));
        return rows;
    }

    /** All procurement activity tied to one project: POs, billed, paid. */
    public Map<String, Object> projectPurchaseReport(Long projectId) {
        List<PurchaseOrder> orders = poRepository.findByProjectIdOrderByIdDesc(projectId);
        BigDecimal ordered = BigDecimal.ZERO, billed = BigDecimal.ZERO, paid = BigDecimal.ZERO;
        List<Map<String, Object>> orderRows = new ArrayList<>();
        for (PurchaseOrder po : orders) {
            if (!"CANCELLED".equals(po.getStatus()) && !"REJECTED".equals(po.getStatus()) && po.getTotalAmount() != null) {
                ordered = ordered.add(po.getTotalAmount());
            }
            for (PurchaseBill bill : billRepository.findByPurchaseOrderId(po.getId())) {
                billed = billed.add(bill.getTotalAmount() != null ? bill.getTotalAmount() : BigDecimal.ZERO);
                paid = paid.add(paymentRepository.findByPurchaseBillId(bill.getId()).stream()
                        .map(PurchasePayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("poId", po.getId());
            row.put("poNumber", po.getPoNumber());
            row.put("supplierName", po.getSupplier() != null ? po.getSupplier().getName() : null);
            row.put("status", po.getStatus());
            row.put("date", po.getDate());
            row.put("totalAmount", po.getTotalAmount());
            orderRows.add(row);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("projectId", projectId);
        result.put("totalOrders", orders.size());
        result.put("totalOrderedValue", ordered);
        result.put("totalBilled", billed);
        result.put("totalPaid", paid);
        result.put("outstanding", billed.subtract(paid));
        result.put("orders", orderRows);
        return result;
    }
}

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

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalOrders", orders.size());
        result.put("totalPurchaseValue", totalValue);
        result.put("countByStatus", countByStatus);
        result.put("valueByStatus", valueByStatus);
        result.put("totalRequests", purchaseRequestRepository.count());
        result.put("pendingRequests", purchaseRequestRepository.countByStatus("PENDING"));
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

            int completed = 0, onTime = 0;
            for (PurchaseOrder po : orders) {
                if (!"COMPLETED".equals(po.getStatus()) || po.getExpectedDeliveryDate() == null) continue;
                completed++;
                Optional<LocalDate> firstReceipt = grnRepository.findByPurchaseOrderId(po.getId()).stream()
                        .map(g -> g.getDate().toLocalDate()).min(Comparator.naturalOrder());
                if (firstReceipt.isPresent() && !firstReceipt.get().isAfter(po.getExpectedDeliveryDate())) onTime++;
            }

            BigDecimal billed = billRepository.findBySupplierId(supplier.getId()).stream()
                    .map(PurchaseBill::getTotalAmount).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal paid = paymentRepository.findBySupplierIdOrderByPaymentDateDesc(supplier.getId()).stream()
                    .map(PurchasePayment::getAmount).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("supplierId", supplier.getId());
            row.put("supplierName", supplier.getName());
            row.put("rating", supplier.getPerformanceRating());
            row.put("totalOrders", orders.size());
            row.put("totalValue", totalValue);
            row.put("completedOrders", completed);
            row.put("onTimeDeliveryPercent", completed > 0 ? Math.round(onTime * 100.0 / completed) : null);
            row.put("outstandingBalance", billed.subtract(paid));
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

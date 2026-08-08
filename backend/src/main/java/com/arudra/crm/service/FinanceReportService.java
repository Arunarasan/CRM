package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Finance dashboard aggregates and the report suite (revenue, P&L, GST, cash flow…). */
@Service
public class FinanceReportService {

    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private InvoiceItemRepository invoiceItemRepository;
    @Autowired private CustomerPaymentRepository paymentRepository;
    @Autowired private ProjectExpenseRepository expenseRepository;
    @Autowired private PurchasePaymentRepository purchasePaymentRepository;
    @Autowired private ContractorPaymentRepository contractorPaymentRepository;
    @Autowired private SalaryRecordRepository salaryRecordRepository;
    @Autowired private PurchaseBillRepository purchaseBillRepository;
    @Autowired private PaymentScheduleRepository scheduleRepository;

    private static final List<String> NOT_REVENUE = List.of("DRAFT", "CANCELLED");

    // =====================================================================
    // Dashboard
    // =====================================================================

    public Map<String, Object> getDashboard() {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());

        BigDecimal todaysCollection = paymentRepository.sumConfirmedBetween(today, today);
        BigDecimal monthCollection = paymentRepository.sumConfirmedBetween(monthStart, monthEnd);
        BigDecimal monthInvoiced = invoiceRepository.sumInvoicedBetween(monthStart, monthEnd);
        BigDecimal outstanding = invoiceRepository.sumBalanceDueByStatuses(FinanceService.OPEN_INVOICE_STATUSES);
        BigDecimal overdueAmount = invoiceRepository.sumOverdueBalance(FinanceService.OPEN_INVOICE_STATUSES, today);
        long pendingInvoices = invoiceRepository.countByStatusIn(FinanceService.OPEN_INVOICE_STATUSES);
        BigDecimal monthExpenses = expenseRepository.totalBetween(monthStart, monthEnd);

        List<Map<String, Object>> upcoming = new ArrayList<>();
        for (Invoice i : invoiceRepository.findByStatusInAndDueDateBetween(
                FinanceService.OPEN_INVOICE_STATUSES, today, today.plusDays(7))) {
            if (Boolean.TRUE.equals(i.getIsDeleted())) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("invoiceId", i.getId());
            m.put("invoiceNumber", i.getInvoiceNumber());
            m.put("customerName", i.getCustomer().getName());
            m.put("dueDate", i.getDueDate());
            m.put("balanceDue", i.getBalanceDue());
            upcoming.add(m);
        }

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("todaysCollection", todaysCollection);
        dashboard.put("monthCollection", monthCollection);
        dashboard.put("monthRevenue", monthInvoiced);
        dashboard.put("totalOutstanding", outstanding);
        dashboard.put("overdueAmount", overdueAmount);
        dashboard.put("pendingInvoices", pendingInvoices);
        dashboard.put("monthExpenses", monthExpenses);
        dashboard.put("monthProfit", monthInvoiced.subtract(monthExpenses));
        dashboard.put("upcomingDues", upcoming);
        dashboard.put("pendingApprovalPayments",
                paymentRepository.findByStatusAndIsDeletedFalseOrderByIdDesc("PENDING_APPROVAL").size());
        dashboard.put("cashFlow", getCashFlow(today.minusMonths(5).withDayOfMonth(1), monthEnd).get("months"));
        dashboard.put("recentPayments", paymentRepository.findAllByOrderByPaymentDateDesc(PageRequest.of(0, 5)).getContent());
        dashboard.put("recentInvoices", invoiceRepository.findAllByOrderByDateDesc(PageRequest.of(0, 5)).getContent());
        return dashboard;
    }

    // =====================================================================
    // Reports
    // =====================================================================

    /** Month-bucketed invoiced vs collected. */
    public Map<String, Object> getRevenueReport(LocalDate from, LocalDate to) {
        Map<String, Map<String, Object>> months = monthBuckets(from, to, "invoiced", "collected");
        for (Invoice i : invoiceRepository.findByDateBetweenAndStatusNotInAndIsDeletedFalse(from, to, NOT_REVENUE)) {
            addToBucket(months, i.getDate(), "invoiced", i.getTotalAmount());
        }
        for (CustomerPayment p : paymentRepository.findByStatusAndPaymentDateBetweenAndIsDeletedFalse("CONFIRMED", from, to)) {
            addToBucket(months, p.getPaymentDate(), "collected", p.getAmount());
        }
        return report(from, to, months);
    }

    /** Expense totals by category plus month buckets. */
    public Map<String, Object> getExpenseReport(LocalDate from, LocalDate to) {
        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (Object[] row : expenseRepository.totalsByCategoryBetween(from, to)) {
            byCategory.put((String) row[0], (BigDecimal) row[1]);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("byCategory", byCategory);
        result.put("total", byCategory.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));
        return result;
    }

    /** Simple P&L: revenue (invoiced), project expenses, payroll, net. */
    public Map<String, Object> getProfitAndLoss(LocalDate from, LocalDate to) {
        BigDecimal revenue = invoiceRepository.sumInvoicedBetween(from, to);
        BigDecimal projectExpenses = expenseRepository.totalBetween(from, to);
        BigDecimal payroll = BigDecimal.ZERO;
        for (SalaryRecord s : salaryRecordRepository.findByStatusAndPaymentDateBetween("PAID", from, to)) {
            if (s.getNetSalary() != null) payroll = payroll.add(s.getNetSalary());
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("revenue", revenue);
        result.put("projectExpenses", projectExpenses);
        result.put("payroll", payroll);
        result.put("totalExpenses", projectExpenses.add(payroll));
        result.put("netProfit", revenue.subtract(projectExpenses).subtract(payroll));
        return result;
    }

    /** Output-tax summary (CGST/SGST/IGST) plus HSN-wise breakup. */
    public Map<String, Object> getGstReport(LocalDate from, LocalDate to) {
        BigDecimal taxable = BigDecimal.ZERO, cgst = BigDecimal.ZERO, sgst = BigDecimal.ZERO, igst = BigDecimal.ZERO;
        int invoices = 0;
        for (Invoice i : invoiceRepository.findByDateBetweenAndStatusNotInAndIsDeletedFalse(from, to, NOT_REVENUE)) {
            taxable = taxable.add(i.getSubTotal() == null ? BigDecimal.ZERO : i.getSubTotal())
                    .subtract(i.getDiscountAmount() == null ? BigDecimal.ZERO : i.getDiscountAmount());
            cgst = cgst.add(nz(i.getCgstAmount()));
            sgst = sgst.add(nz(i.getSgstAmount()));
            igst = igst.add(nz(i.getIgstAmount()));
            invoices++;
        }
        List<Map<String, Object>> hsnRows = new ArrayList<>();
        for (Object[] row : invoiceItemRepository.hsnSummaryBetween(from, to)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("hsnCode", row[0]);
            m.put("gstRate", row[1]);
            m.put("taxableValue", row[2]);
            m.put("taxAmount", row[3]);
            hsnRows.add(m);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("invoiceCount", invoices);
        result.put("taxableValue", taxable);
        result.put("cgst", cgst);
        result.put("sgst", sgst);
        result.put("igst", igst);
        result.put("totalTax", cgst.add(sgst).add(igst));
        result.put("hsnSummary", hsnRows);
        return result;
    }

    /**
     * Cash movement by month: customer collections in; supplier payments,
     * contractor payments and payroll out.
     */
    public Map<String, Object> getCashFlow(LocalDate from, LocalDate to) {
        Map<String, Map<String, Object>> months = monthBuckets(from, to, "moneyIn", "moneyOut");
        for (CustomerPayment p : paymentRepository.findByStatusAndPaymentDateBetweenAndIsDeletedFalse("CONFIRMED", from, to)) {
            addToBucket(months, p.getPaymentDate(), "moneyIn", p.getAmount());
        }
        for (PurchasePayment p : purchasePaymentRepository.findByPaymentDateBetween(from, to)) {
            if (Boolean.TRUE.equals(p.getIsDeleted())) continue;
            addToBucket(months, p.getPaymentDate(), "moneyOut", p.getAmount());
        }
        for (ContractorPayment p : contractorPaymentRepository.findByStatusAndPaymentDateBetween("PAID", from, to)) {
            if (Boolean.TRUE.equals(p.getIsDeleted())) continue;
            addToBucket(months, p.getPaymentDate(), "moneyOut", p.getAmount());
        }
        for (SalaryRecord s : salaryRecordRepository.findByStatusAndPaymentDateBetween("PAID", from, to)) {
            if (Boolean.TRUE.equals(s.getIsDeleted()) || s.getNetSalary() == null) continue;
            addToBucket(months, s.getPaymentDate(), "moneyOut", s.getNetSalary());
        }
        for (Map<String, Object> bucket : months.values()) {
            BigDecimal in = (BigDecimal) bucket.get("moneyIn");
            BigDecimal out = (BigDecimal) bucket.get("moneyOut");
            bucket.put("net", in.subtract(out));
        }
        return report(from, to, months);
    }

    /** Monthly purchase spend (bills) vs sales (invoices). */
    public Map<String, Object> getPurchaseVsSales(LocalDate from, LocalDate to) {
        Map<String, Map<String, Object>> months = monthBuckets(from, to, "sales", "purchases");
        for (Invoice i : invoiceRepository.findByDateBetweenAndStatusNotInAndIsDeletedFalse(from, to, NOT_REVENUE)) {
            addToBucket(months, i.getDate(), "sales", i.getTotalAmount());
        }
        for (PurchaseBill b : purchaseBillRepository.findAll()) {
            if (Boolean.TRUE.equals(b.getIsDeleted()) || b.getDate() == null) continue;
            if (b.getDate().isBefore(from) || b.getDate().isAfter(to)) continue;
            addToBucket(months, b.getDate(), "purchases", b.getTotalAmount());
        }
        return report(from, to, months);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private Map<String, Map<String, Object>> monthBuckets(LocalDate from, LocalDate to, String... keys) {
        Map<String, Map<String, Object>> months = new LinkedHashMap<>();
        YearMonth cursor = YearMonth.from(from);
        YearMonth end = YearMonth.from(to);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM");
        while (!cursor.isAfter(end)) {
            Map<String, Object> bucket = new LinkedHashMap<>();
            bucket.put("month", cursor.format(fmt));
            for (String key : keys) bucket.put(key, BigDecimal.ZERO);
            months.put(cursor.format(fmt), bucket);
            cursor = cursor.plusMonths(1);
        }
        return months;
    }

    private void addToBucket(Map<String, Map<String, Object>> months, LocalDate date, String key, BigDecimal amount) {
        if (date == null || amount == null) return;
        Map<String, Object> bucket = months.get(YearMonth.from(date).format(DateTimeFormatter.ofPattern("yyyy-MM")));
        if (bucket == null) return;
        bucket.put(key, ((BigDecimal) bucket.get(key)).add(amount));
    }

    private Map<String, Object> report(LocalDate from, LocalDate to, Map<String, Map<String, Object>> months) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("months", new ArrayList<>(months.values()));
        return result;
    }

    private BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}

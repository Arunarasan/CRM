package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    @Autowired private CompanyTransactionRepository companyTransactionRepository;

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
        BigDecimal monthExpenses = expenseTotalsBySource(monthStart, monthEnd)
                .values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

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

    /**
     * Consolidated expense report on a cash basis: every expense record the company actually pays —
     * supplier (goods) payments, contractor payments, payroll, manual project costs and company
     * overhead ("other charges") — broken down by source and, for overhead, by category.
     */
    public Map<String, Object> getExpenseReport(LocalDate from, LocalDate to) {
        Map<String, BigDecimal> bySource = expenseTotalsBySource(from, to);
        BigDecimal total = bySource.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> overheadByCategory = new LinkedHashMap<>();
        for (Object[] row : companyTransactionRepository.totalsByCategoryBetween("EXPENSE", from, to)) {
            overheadByCategory.put((String) row[0], (BigDecimal) row[1]);
        }
        Map<String, BigDecimal> projectByCategory = new LinkedHashMap<>();
        for (Object[] row : expenseRepository.totalsByCategoryBetween(from, to)) {
            projectByCategory.put((String) row[0], (BigDecimal) row[1]);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("bySource", bySource);
        result.put("overheadByCategory", overheadByCategory);
        result.put("projectByCategory", projectByCategory);
        result.put("total", total);
        return result;
    }

    /**
     * Cash-basis P&L: money in (customer collections + other income) vs money out (all expense
     * records), with the expense breakdown by source and the accrual context (invoiced / outstanding)
     * alongside for reference.
     */
    public Map<String, Object> getProfitAndLoss(LocalDate from, LocalDate to) {
        BigDecimal collections = nz(paymentRepository.sumConfirmedBetween(from, to));
        BigDecimal otherIncome = nz(companyTransactionRepository.totalBetween("INCOME", from, to));
        BigDecimal totalIncome = collections.add(otherIncome);

        Map<String, BigDecimal> bySource = expenseTotalsBySource(from, to);
        BigDecimal totalExpenses = bySource.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("collections", collections);
        result.put("otherIncome", otherIncome);
        result.put("totalIncome", totalIncome);
        // Accrual context for reference — revenue billed regardless of collection.
        result.put("invoiced", nz(invoiceRepository.sumInvoicedBetween(from, to)));
        result.put("expensesBySource", bySource);
        // Back-compat named lines some callers/screens still read.
        result.put("payroll", bySource.getOrDefault("PAYROLL", BigDecimal.ZERO));
        result.put("projectExpenses", bySource.getOrDefault("PROJECT_EXPENSES", BigDecimal.ZERO));
        result.put("totalExpenses", totalExpenses);
        result.put("netProfit", totalIncome.subtract(totalExpenses));
        return result;
    }

    /**
     * Every expense the company pays in the window, grouped by originating source (cash basis).
     * Supplier/contractor use PAYMENTS (not bills) and project expenses are limited to MANUAL rows,
     * so nothing is double-counted against the modules that own those payments.
     */
    private Map<String, BigDecimal> expenseTotalsBySource(LocalDate from, LocalDate to) {
        BigDecimal supplier = BigDecimal.ZERO;
        for (PurchasePayment p : purchasePaymentRepository.findByPaymentDateBetween(from, to)) {
            if (Boolean.TRUE.equals(p.getIsDeleted()) || p.getAmount() == null) continue;
            supplier = supplier.add(p.getAmount());
        }
        BigDecimal contractor = BigDecimal.ZERO;
        for (ContractorPayment p : contractorPaymentRepository.findByStatusAndPaymentDateBetween("PAID", from, to)) {
            if (Boolean.TRUE.equals(p.getIsDeleted()) || p.getAmount() == null) continue;
            contractor = contractor.add(p.getAmount());
        }
        BigDecimal payroll = BigDecimal.ZERO;
        for (SalaryRecord s : salaryRecordRepository.findByStatusAndPaymentDateBetween("PAID", from, to)) {
            if (Boolean.TRUE.equals(s.getIsDeleted()) || s.getNetSalary() == null) continue;
            payroll = payroll.add(s.getNetSalary());
        }
        BigDecimal projectManual = BigDecimal.ZERO;
        for (ProjectExpense e : expenseRepository.findBySourceAndExpenseDateBetweenAndIsDeletedFalse("MANUAL", from, to)) {
            if (e.getAmount() != null) projectManual = projectManual.add(e.getAmount());
        }
        BigDecimal overhead = nz(companyTransactionRepository.totalBetween("EXPENSE", from, to));

        Map<String, BigDecimal> bySource = new LinkedHashMap<>();
        bySource.put("SUPPLIER_PAYMENTS", supplier);
        bySource.put("CONTRACTOR_PAYMENTS", contractor);
        bySource.put("PAYROLL", payroll);
        bySource.put("PROJECT_EXPENSES", projectManual);
        bySource.put("COMPANY_OVERHEAD", overhead);
        return bySource;
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
    // Cash Book — unified money-in / money-out register across every source
    // =====================================================================

    /**
     * The consolidated Cash Book: every actual cash movement in the window pulled from all modules —
     * customer collections and other income IN; supplier, contractor, payroll, manual project costs
     * and company overhead OUT. {@code direction} (IN/OUT), {@code source} and {@code search} filter
     * the returned rows; the summary totals always reflect the full window so the cards stay stable.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getCashbook(LocalDate from, LocalDate to, String direction, String source, String search) {
        List<Map<String, Object>> all = new ArrayList<>();

        // ---- Money IN ----
        for (CustomerPayment p : paymentRepository.findByStatusAndPaymentDateBetweenAndIsDeletedFalse("CONFIRMED", from, to)) {
            all.add(row(p.getId(), p.getPaymentDate(), "IN", "CUSTOMER_PAYMENT", "Customer Collection",
                    p.getCustomer() != null ? p.getCustomer().getName() : null,
                    p.getPaymentNumber(), p.getPaymentMethod(), null, p.getAmount()));
        }
        for (CompanyTransaction t : companyTransactionRepository.findByDirectionAndTxnDateBetweenAndIsDeletedFalse("INCOME", from, to)) {
            all.add(row(t.getId(), t.getTxnDate(), "IN", "COMPANY_INCOME", t.getCategory(),
                    t.getPartyName(), t.getReferenceNumber() != null ? t.getReferenceNumber() : t.getTxnNumber(),
                    t.getPaymentMethod(), t.getDescription(), t.getAmount()));
        }

        // ---- Money OUT ----
        for (PurchasePayment p : purchasePaymentRepository.findByPaymentDateBetween(from, to)) {
            if (Boolean.TRUE.equals(p.getIsDeleted())) continue;
            all.add(row(p.getId(), p.getPaymentDate(), "OUT", "SUPPLIER_PAYMENT", p.getPaymentType(),
                    p.getSupplier() != null ? p.getSupplier().getName() : null,
                    p.getReferenceNumber(), p.getPaymentMethod(), null, p.getAmount()));
        }
        for (ContractorPayment p : contractorPaymentRepository.findByStatusAndPaymentDateBetween("PAID", from, to)) {
            if (Boolean.TRUE.equals(p.getIsDeleted())) continue;
            all.add(row(p.getId(), p.getPaymentDate(), "OUT", "CONTRACTOR_PAYMENT", p.getPaymentType(),
                    p.getContractor() != null ? p.getContractor().getName() : null,
                    p.getReferenceNumber(), p.getPaymentMode(), null, p.getAmount()));
        }
        for (SalaryRecord s : salaryRecordRepository.findByStatusAndPaymentDateBetween("PAID", from, to)) {
            if (Boolean.TRUE.equals(s.getIsDeleted())) continue;
            all.add(row(s.getId(), s.getPaymentDate(), "OUT", "PAYROLL", "Salary",
                    employeeName(s), s.getPayslipNumber(), null, null, s.getNetSalary()));
        }
        for (ProjectExpense e : expenseRepository.findBySourceAndExpenseDateBetweenAndIsDeletedFalse("MANUAL", from, to)) {
            all.add(row(e.getId(), e.getExpenseDate(), "OUT", "PROJECT_EXPENSE", e.getCategory(),
                    e.getVendor(), null, e.getPaymentMethod(), e.getDescription(), e.getAmount()));
        }
        for (CompanyTransaction t : companyTransactionRepository.findByDirectionAndTxnDateBetweenAndIsDeletedFalse("EXPENSE", from, to)) {
            all.add(row(t.getId(), t.getTxnDate(), "OUT", "COMPANY_EXPENSE", t.getCategory(),
                    t.getPartyName(), t.getReferenceNumber() != null ? t.getReferenceNumber() : t.getTxnNumber(),
                    t.getPaymentMethod(), t.getDescription(), t.getAmount()));
        }

        // ---- Summary over the whole window (independent of the row filters) ----
        BigDecimal totalIn = BigDecimal.ZERO, totalOut = BigDecimal.ZERO;
        Map<String, BigDecimal> bySource = new LinkedHashMap<>();
        for (Map<String, Object> r : all) {
            BigDecimal amt = (BigDecimal) r.get("amount");
            if (amt == null) continue;
            if ("IN".equals(r.get("direction"))) totalIn = totalIn.add(amt);
            else totalOut = totalOut.add(amt);
            String src = (String) r.get("source");
            bySource.merge(src, amt, BigDecimal::add);
        }

        // ---- Row filters ----
        String q = (search == null || search.isBlank()) ? null : search.trim().toLowerCase();
        List<Map<String, Object>> entries = new ArrayList<>();
        for (Map<String, Object> r : all) {
            if (direction != null && !direction.isBlank() && !direction.equalsIgnoreCase((String) r.get("direction"))) continue;
            if (source != null && !source.isBlank() && !source.equals(r.get("source"))) continue;
            if (q != null && !rowMatches(r, q)) continue;
            entries.add(r);
        }
        entries.sort((a, b) -> {
            LocalDate da = (LocalDate) a.get("date"), db = (LocalDate) b.get("date");
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return db.compareTo(da);
        });

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("totalIn", totalIn);
        result.put("totalOut", totalOut);
        result.put("net", totalIn.subtract(totalOut));
        result.put("bySource", bySource);
        result.put("count", entries.size());
        result.put("entries", entries);
        return result;
    }

    private Map<String, Object> row(Long id, LocalDate date, String direction, String source, String category,
                                    String party, String reference, String method, String description, BigDecimal amount) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id);
        r.put("date", date);
        r.put("direction", direction);
        r.put("source", source);
        r.put("category", category);
        r.put("party", party);
        r.put("reference", reference);
        r.put("method", method);
        r.put("description", description);
        r.put("amount", amount == null ? BigDecimal.ZERO : amount);
        return r;
    }

    private boolean rowMatches(Map<String, Object> r, String q) {
        for (String key : List.of("party", "reference", "description", "category")) {
            Object v = r.get(key);
            if (v != null && v.toString().toLowerCase().contains(q)) return true;
        }
        return false;
    }

    private String employeeName(SalaryRecord s) {
        if (s.getEmployee() == null) return null;
        String first = s.getEmployee().getFirstName();
        String last = s.getEmployee().getLastName();
        String name = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
        return name.isEmpty() ? null : name;
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

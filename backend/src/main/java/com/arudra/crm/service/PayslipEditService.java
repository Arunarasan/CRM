package com.arudra.crm.service;

import com.arudra.crm.entity.PayslipLineItem;
import com.arudra.crm.entity.SalaryRecord;
import com.arudra.crm.repository.PayslipLineItemRepository;
import com.arudra.crm.repository.SalaryRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Editable payslip builder. Lets an admin add/edit/remove NAMED line items (extra earnings such as
 * lead/project task-completion incentive, customer-feedback incentive, company incentive, allowances,
 * ad-hoc bonuses; or deductions) on top of an already-generated {@link SalaryRecord}. Gross/net are
 * recomputed from the record's own component fields plus the line-item sums, so repeated edits never
 * double-count. Only editable while the payslip is not yet PAID.
 */
@Service
public class PayslipEditService {

    @Autowired private SalaryRecordRepository salaryRepository;
    @Autowired private PayslipLineItemRepository lineItemRepository;
    @Autowired private PayrollService payrollService;

    /** Preset labels the admin UI offers; free text is allowed too. */
    public static final List<String> EARNING_PRESETS = List.of(
            "Lead task incentive", "Project completion incentive", "Customer feedback incentive",
            "Company incentive", "Bonus", "Other allowance");
    public static final List<String> DEDUCTION_PRESETS = List.of(
            "Penalty", "Advance repay (extra)", "Loan repay (extra)", "Other deduction");

    public Map<String, Object> get(Long employeeId, int month, int year) {
        SalaryRecord rec = salaryRepository.findByEmployeeIdAndMonthAndYear(employeeId, month, year).orElse(null);
        return view(rec);
    }

    @Transactional
    public Map<String, Object> addItem(Long salaryRecordId, String category, String label, BigDecimal amount) {
        SalaryRecord rec = editable(salaryRecordId);
        String cat = normalizeCategory(category);
        PayslipLineItem item = new PayslipLineItem();
        item.setSalaryRecord(rec);
        item.setCategory(cat);
        item.setLabel(label == null || label.isBlank() ? (cat.equals("EARNING") ? "Earning" : "Deduction") : label.trim());
        item.setAmount(nz(amount).max(BigDecimal.ZERO));
        item.setSource("MANUAL");
        lineItemRepository.save(item);
        recompute(rec);
        return view(rec);
    }

    @Transactional
    public Map<String, Object> updateItem(Long itemId, String label, BigDecimal amount) {
        PayslipLineItem item = lineItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Line item not found."));
        SalaryRecord rec = editable(item.getSalaryRecord().getId());
        if (label != null && !label.isBlank()) item.setLabel(label.trim());
        if (amount != null) item.setAmount(amount.max(BigDecimal.ZERO));
        lineItemRepository.save(item);
        recompute(rec);
        return view(rec);
    }

    @Transactional
    public Map<String, Object> deleteItem(Long itemId) {
        PayslipLineItem item = lineItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Line item not found."));
        SalaryRecord rec = editable(item.getSalaryRecord().getId());
        item.setIsDeleted(true);
        item.setDeletedAt(LocalDateTime.now());
        lineItemRepository.save(item);
        recompute(rec);
        return view(rec);
    }

    /**
     * HR edits the payslip's own amounts and details (anything sent; fields left out are unchanged),
     * then gross / deductions / net recompute. "repayment" (what's taken toward money they owe) moves the
     * real advance/loan balances, oldest debt first.
     */
    @Transactional
    public Map<String, Object> updateComponents(Long salaryRecordId, Map<String, Object> body) {
        SalaryRecord r = editable(salaryRecordId);
        // Earnings
        r.setRegularEarnings(money(body, "regularEarnings", r.getRegularEarnings()));
        r.setOvertimeAmount(money(body, "overtimeAmount", r.getOvertimeAmount()));
        r.setBasic(money(body, "basic", r.getBasic()));
        r.setHra(money(body, "hra", r.getHra()));
        r.setAllowances(money(body, "allowances", r.getAllowances()));
        r.setProjectBonus(money(body, "projectBonus", r.getProjectBonus()));
        r.setManualBonus(money(body, "manualBonus", r.getManualBonus()));
        // `bonus` is project + manual; older payslips may only carry `bonus`, so keep any remainder.
        BigDecimal split = nz(r.getProjectBonus()).add(nz(r.getManualBonus()));
        if (body.containsKey("projectBonus") || body.containsKey("manualBonus") || split.signum() > 0) r.setBonus(split);
        r.setIncentive(money(body, "incentive", r.getIncentive()));
        r.setOtherEarnings(money(body, "otherEarnings", r.getOtherEarnings()));
        // Deductions — other_deductions = manual deduction + any other (request) deductions.
        r.setPfAmount(money(body, "pfAmount", r.getPfAmount()));
        r.setEsiAmount(money(body, "esiAmount", r.getEsiAmount()));
        r.setProfessionalTax(money(body, "professionalTax", r.getProfessionalTax()));
        r.setLeaveDeduction(money(body, "leaveDeduction", r.getLeaveDeduction()));
        BigDecimal oldManual = nz(r.getManualDeduction());
        BigDecimal otherExtra = nz(r.getOtherDeductions()).subtract(oldManual).max(BigDecimal.ZERO);
        r.setManualDeduction(money(body, "manualDeduction", oldManual));
        otherExtra = money(body, "otherDeductionsExtra", otherExtra);
        r.setOtherDeductions(nz(r.getManualDeduction()).add(otherExtra));
        // "Repayment of what they owe" — moves real advance/loan balances, oldest debt first.
        if (body.containsKey("repayment")) {
            BigDecimal current = nz(r.getAdvanceRecovery()).add(nz(r.getLoanRecovery()));
            BigDecimal wanted = money(body, "repayment", current);
            if (wanted.compareTo(current) != 0) payrollService.setRepayment(r, wanted);
        }
        // Details shown on the payslip
        r.setWorkedHours(money(body, "workedHours", r.getWorkedHours()));
        r.setOvertimeHours(money(body, "overtimeHours", r.getOvertimeHours()));
        if (body.get("attendanceDays") != null) r.setAttendanceDays(money(body, "attendanceDays", null).intValue());
        if (body.containsKey("paidDays")) r.setPaidDays(money(body, "paidDays", r.getPaidDays()));
        if (body.containsKey("lopDays")) r.setLopDays(money(body, "lopDays", r.getLopDays()));
        if (body.containsKey("remarks")) {
            Object v = body.get("remarks");
            r.setRemarks(v == null || v.toString().isBlank() ? null : v.toString().trim());
        }
        recompute(r);
        return view(r);
    }

    /** A non-negative amount from the body, or {@code current} when the key wasn't sent. */
    private static BigDecimal money(Map<String, Object> body, String key, BigDecimal current) {
        if (!body.containsKey(key)) return current;
        Object v = body.get(key);
        if (v == null || v.toString().isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(v.toString().trim()).max(BigDecimal.ZERO);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Enter a valid number for " + key + ".");
        }
    }

    // --- core --------------------------------------------------------------

    /** Recompute gross/net from the component fields + Σ line items, and save. Idempotent. */
    private void recompute(SalaryRecord r) {
        applyTotals(r, lineItemRepository.findBySalaryRecordIdAndIsDeletedFalseOrderByIdAsc(r.getId()));
        salaryRepository.save(r);
    }

    /** Sets gross / total deductions / net on {@code r} = its component fields + the given line items. */
    public static void applyTotals(SalaryRecord r, List<PayslipLineItem> items) {
        BigDecimal earnAdd = BigDecimal.ZERO, dedAdd = BigDecimal.ZERO;
        for (PayslipLineItem it : items) {
            if ("DEDUCTION".equals(it.getCategory())) dedAdd = dedAdd.add(nz(it.getAmount()));
            else earnAdd = earnAdd.add(nz(it.getAmount()));
        }
        BigDecimal baseGross = nz(r.getBasic()).add(nz(r.getRegularEarnings())).add(nz(r.getOvertimeAmount()))
                .add(nz(r.getHra())).add(nz(r.getAllowances())).add(nz(r.getBonus())).add(nz(r.getIncentive()))
                .add(nz(r.getOtherEarnings()));
        BigDecimal baseDed = nz(r.getPfAmount()).add(nz(r.getEsiAmount())).add(nz(r.getProfessionalTax()))
                .add(nz(r.getAdvanceRecovery())).add(nz(r.getLoanRecovery())).add(nz(r.getLeaveDeduction()))
                .add(nz(r.getOtherDeductions()));
        BigDecimal gross = baseGross.add(earnAdd);
        BigDecimal totalDed = baseDed.add(dedAdd);
        r.setGrossEarnings(gross);
        r.setTotalDeductions(totalDed);
        r.setDeductions(totalDed);
        r.setNetSalary(gross.subtract(totalDed));
    }

    private SalaryRecord editable(Long salaryRecordId) {
        SalaryRecord r = salaryRepository.findById(salaryRecordId)
                .orElseThrow(() -> new IllegalArgumentException("Payslip not found."));
        if ("PAID".equalsIgnoreCase(r.getStatus()))
            throw new IllegalStateException("This payslip is already paid and can't be edited.");
        return r;
    }

    private Map<String, Object> view(SalaryRecord rec) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("record", rec);
        m.put("lineItems", rec == null ? List.of()
                : lineItemRepository.findBySalaryRecordIdAndIsDeletedFalseOrderByIdAsc(rec.getId()));
        if (rec != null && rec.getEmployee() != null) {
            m.put("owedBalance", payrollService.owedBalance(rec.getEmployee().getId())); // left after this payslip
            m.put("pendingRequests", payrollService.pendingRequests(rec.getEmployee().getId()));
        }
        m.put("earningPresets", EARNING_PRESETS);
        m.put("deductionPresets", DEDUCTION_PRESETS);
        return m;
    }

    private static String normalizeCategory(String c) {
        return "DEDUCTION".equalsIgnoreCase(c) ? "DEDUCTION" : "EARNING";
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
}

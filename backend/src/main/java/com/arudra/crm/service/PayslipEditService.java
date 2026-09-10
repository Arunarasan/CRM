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

    // --- core --------------------------------------------------------------

    /** Recompute gross/net = stable auto base (from component fields) + Σ line items. Idempotent. */
    private void recompute(SalaryRecord r) {
        List<PayslipLineItem> items = lineItemRepository.findBySalaryRecordIdAndIsDeletedFalseOrderByIdAsc(r.getId());
        BigDecimal earnAdd = BigDecimal.ZERO, dedAdd = BigDecimal.ZERO;
        for (PayslipLineItem it : items) {
            if ("DEDUCTION".equals(it.getCategory())) dedAdd = dedAdd.add(nz(it.getAmount()));
            else earnAdd = earnAdd.add(nz(it.getAmount()));
        }
        // Auto base from the record's own component fields (unchanged by line-item edits).
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
        salaryRepository.save(r);
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
        m.put("earningPresets", EARNING_PRESETS);
        m.put("deductionPresets", DEDUCTION_PRESETS);
        return m;
    }

    private static String normalizeCategory(String c) {
        return "DEDUCTION".equalsIgnoreCase(c) ? "DEDUCTION" : "EARNING";
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
}

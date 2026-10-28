package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeCelebration;
import com.arudra.crm.entity.PayslipLineItem;
import com.arudra.crm.entity.SalaryRecord;
import com.arudra.crm.repository.PayslipLineItemRepository;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.EmployeeCelebrationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The employee portal's "Gifts": a celebration card each time money is given. Cards are created by the
 * payment steps (bonus approved/paid, payslip approved/paid, allowance approved) in the same transaction, so a
 * rolled-back payment leaves no card, and a card that can't be made never blocks the payment itself.
 */
@Service
public class EmployeeCelebrationService {

    private static final Logger log = LoggerFactory.getLogger(EmployeeCelebrationService.class);

    public static final String BONUS = "BONUS", INCENTIVE = "INCENTIVE", ALLOWANCE = "ALLOWANCE", SALARY = "SALARY";

    private final EmployeeCelebrationRepository repo;
    private final PayslipSettingsService settings;
    private final PayslipLineItemRepository lineItems;

    public EmployeeCelebrationService(EmployeeCelebrationRepository repo, PayslipSettingsService settings,
                                      PayslipLineItemRepository lineItems) {
        this.repo = repo;
        this.settings = settings;
        this.lineItems = lineItems;
    }

    /** A gift for each automatic incentive line on a payslip HR approved or paid (leads, projects, attendance, performance). */
    @Transactional
    public void payslipIncentives(SalaryRecord rec) {
        if (rec == null || rec.getEmployee() == null) return;
        PayslipSettingsService.Builtin review = settings.get().getBuiltins().get(PayslipSettingsService.REVIEW_REWARD);
        String reviewLabel = review == null || review.getLabel() == null ? "Google reviews" : review.getLabel();
        for (PayslipLineItem it : lineItems.findBySalaryRecordIdAndIsDeletedFalseOrderByIdAsc(rec.getId())) {
            // Review rewards are bonuses (celebrated when approved); allowances are celebrated with their request.
            if (!"AUTO".equals(it.getSource()) || !"EARNING".equals(it.getCategory())
                    || it.getLabel().startsWith(reviewLabel)) continue;
            give(rec.getEmployee(), INCENTIVE, "PAYSLIP_LINE", it.getId(), it.getLabel(), it.getAmount(), null);
        }
    }

    /** The "salary paid" gift. */
    @Transactional
    public void salaryPaid(SalaryRecord rec) {
        if (rec == null) return;
        give(rec.getEmployee(), SALARY, "SALARY", rec.getId(),
                "Salary for " + String.format("%02d/%d", rec.getMonth(), rec.getYear()), rec.getNetSalary(), null);
    }

    /** Adds a card once per (employee, source). Does nothing when switched off for that kind or the amount is zero. */
    @Transactional
    public void give(Employee employee, String kind, String sourceType, Long sourceId, String title,
                     BigDecimal amount, String note) {
        try {
            if (employee == null || sourceId == null || amount == null || amount.signum() <= 0) return;
            PayslipSettingsService.Celebrations c = settings.get().getCelebrations();
            if (!c.isEnabled() || !c.allows(kind)) return;
            if (repo.existsByEmployeeIdAndSourceTypeAndSourceId(employee.getId(), sourceType, sourceId)) return;
            EmployeeCelebration e = new EmployeeCelebration();
            e.setEmployeeId(employee.getId());
            e.setKind(kind);
            e.setTitle(title.length() > 200 ? title.substring(0, 200) : title);
            e.setNote(note == null || note.isBlank() ? null : note.trim());
            e.setAmount(amount);
            e.setSourceType(sourceType);
            e.setSourceId(sourceId);
            e.setRewardDate(LocalDate.now());
            repo.save(e);
        } catch (RuntimeException ex) {
            log.warn("Could not create gift card ({} {}): {}", sourceType, sourceId, ex.getMessage());
        }
    }

    /** The employee's cards, newest first, with the unopened count and this month's total. */
    @Transactional(readOnly = true)
    public Map<String, Object> mine(Long employeeId) {
        List<EmployeeCelebration> items = repo.findByEmployeeIdAndIsDeletedFalseOrderByRewardDateDescIdDesc(employeeId);
        LocalDate now = LocalDate.now();
        BigDecimal monthTotal = BigDecimal.ZERO;
        int unopened = 0;
        for (EmployeeCelebration c : items) {
            if (!c.isOpened()) unopened++;
            // Salary is the regular pay, so "rewards this month" counts only the extras.
            if (!SALARY.equals(c.getKind()) && c.getRewardDate().getYear() == now.getYear()
                    && c.getRewardDate().getMonthValue() == now.getMonthValue()) monthTotal = monthTotal.add(c.getAmount());
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("unopened", unopened);
        out.put("monthTotal", monthTotal);
        return out;
    }

    @Transactional
    public void open(Long employeeId, Long id) {
        EmployeeCelebration c = repo.findByIdAndEmployeeIdAndIsDeletedFalse(id, employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Gift not found: " + id));
        if (!c.isOpened()) {
            c.setOpened(true);
            repo.save(c);
        }
    }

    @Transactional
    public void openAll(Long employeeId) {
        for (EmployeeCelebration c : repo.findByEmployeeIdAndOpenedFalseAndIsDeletedFalse(employeeId)) {
            c.setOpened(true);
            repo.save(c);
        }
    }
}

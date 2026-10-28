package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.repository.EmployeeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.Map;

/**
 * Generates the month's payslips on the day HR chose (Payslip settings › Auto-generate). Runs hourly and
 * acts once per period: on or after the chosen day, if that period hasn't been done yet — so a server that
 * was down on the day catches up. Payslips are created PENDING (a draft HR still reviews and approves) and
 * the run only fills in employees who have none, so it can never overwrite or duplicate anything.
 */
@Component
public class PayslipAutoGenerateScheduler {

    private static final Logger log = LoggerFactory.getLogger(PayslipAutoGenerateScheduler.class);

    @Autowired private PayslipSettingsService settingsService;
    @Autowired private PayrollService payrollService;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private NotificationService notificationService;

    @Scheduled(cron = "0 10 * * * *")
    public void run() {
        try {
            runIfDue(LocalDate.now());
        } catch (Exception e) {
            log.error("Payslip auto-generate failed: {}", e.getMessage(), e);
        }
    }

    /** Package-visible for tests and the "Run now" button. Returns the summary, or null if nothing was due. */
    String runIfDue(LocalDate today) {
        PayslipSettingsService.Auto auto = settingsService.get().getAuto();
        if (!auto.isEnabled() || today.getDayOfMonth() < auto.getDayOfMonth()) return null;
        YearMonth target = "CURRENT".equals(auto.getPeriod()) ? YearMonth.from(today) : YearMonth.from(today).minusMonths(1);
        if (target.toString().equals(auto.getLastRunPeriod())) return null;
        return generate(target, auto);
    }

    /** Runs the generation for {@code ym} now, regardless of schedule, and records it as done. */
    public String generate(YearMonth ym, PayslipSettingsService.Auto auto) {
        Map<Long, String> choices = new HashMap<>();
        if (!"AUTO".equals(auto.getBasis())) {
            for (Employee e : employeeRepository.findByPayrollEnabledTrueAndIsDeletedFalse()) {
                choices.put(e.getId(), auto.getBasis());
            }
        }
        Map<String, Object> res = payrollService.generatePayslips(ym.getMonthValue(), ym.getYear(), choices);
        int errors = ((java.util.List<?>) res.get("errors")).size();
        String summary = res.get("generated") + " generated, " + res.get("skipped") + " skipped"
                + (errors > 0 ? ", " + errors + " failed" : "") + " for " + ym;
        settingsService.recordRun(ym.toString(), summary);
        log.info("Payslip auto-generate: {}", summary);
        if (auto.isNotifyHr()) {
            notificationService.dispatchToAdmins("Payslips auto-generated",
                    summary + ". They are drafts — review, approve and pay in Payroll.",
                    "SALARY", "/workforce/payroll", null);
        }
        return summary;
    }
}

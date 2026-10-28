package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** The attendance bonus hours tests: pays when at least one test passes, withholds when none does. */
class AttendanceBonusHoursTest {

    private PayrollService service;
    private final Map<String, String> settings = new HashMap<>();
    private List<Attendance> days;
    private PayslipLineItemRepository lineRepo;

    @BeforeEach
    void setUp() {
        service = new PayrollService();
        SiteSettingRepository siteRepo = mock(SiteSettingRepository.class);
        when(siteRepo.findBySettingKeyAndIsDeletedFalse(anyString())).thenAnswer(i -> {
            String v = settings.get(i.getArgument(0));
            if (v == null) return Optional.empty();
            SiteSetting s = new SiteSetting(); s.setSettingValue(v); return Optional.of(s);
        });
        AttendanceRepository attRepo = mock(AttendanceRepository.class);
        when(attRepo.findByEmployeeIdAndDateBetween(any(), any(), any())).thenAnswer(i -> days);
        lineRepo = mock(PayslipLineItemRepository.class);
        ReflectionTestUtils.setField(service, "siteSettingRepository", siteRepo);
        ReflectionTestUtils.setField(service, "attendanceRepository", attRepo);
        ReflectionTestUtils.setField(service, "lineItemRepository", lineRepo);
        settings.put("payroll.attendance_bonus_amount", "500");
        settings.put("payroll.attendance_day_hours", "7");
        settings.put("payroll.attendance_min_days", "3");
        settings.put("payroll.attendance_avg_hours", "7");
    }

    private void hours(double... h) {
        days = new ArrayList<>();
        for (double x : h) {
            Attendance a = new Attendance();
            a.setStatus("PRESENT");
            a.setWorkedHours(BigDecimal.valueOf(x));
            days.add(a);
        }
    }

    private BigDecimal run() {
        Employee e = new Employee(); e.setId(1L);
        SalaryRecord rec = new SalaryRecord();
        return ReflectionTestUtils.invokeMethod(service, "addAttendanceBonusLine", e, rec, YearMonth.of(2026, 9));
    }

    @Test void perDayTestPassesAlone() { hours(7, 7, 7, 2); assertEquals(0, run().compareTo(new BigDecimal("500"))); }   // avg 5.75 fails, 3 days ok
    @Test void averageTestPassesAlone() { hours(10, 10, 6); assertEquals(0, run().compareTo(new BigDecimal("500"))); }   // only 2 days ≥7, avg 8.7
    @Test void neitherPassesNoBonus() { hours(7, 6, 6, 5); assertEquals(0, run().signum()); }
    @Test void hoursTestsOffBehavesAsBefore() {
        settings.put("payroll.attendance_min_days", "0"); settings.put("payroll.attendance_avg_hours", "0");
        hours(1, 1); assertEquals(0, run().compareTo(new BigDecimal("500")));
    }
}

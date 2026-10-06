package com.arudra.crm.service;

import com.arudra.crm.entity.AttendanceShift;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.*;

class AttendanceShiftCalculatorTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 6);

    private static AttendanceShift general() {
        AttendanceShift s = new AttendanceShift();
        s.setName("General Shift");
        s.setStartTime(LocalTime.of(9, 0));
        s.setEndTime(LocalTime.of(18, 0));
        s.setGracePeriodMinutes(15);
        s.setBreakMinutes(60);
        s.setWorkingHours(new BigDecimal("8.00"));
        s.setOvertimeEnabled(true);
        s.setHalfDayThresholdMinutes(240);
        s.setWeekOffDays("SATURDAY,SUNDAY");
        return s;
    }

    private static AttendanceShiftCalculator.ShiftSpec spec() {
        return AttendanceShiftCalculator.ShiftSpec.of(general());
    }

    @Test
    void lateIsMeasuredFromTheEndOfGrace() {
        // Spec example: shift 09:00, grace 15, check-in 09:23 → late 8 minutes.
        assertEquals(8, AttendanceShiftCalculator.lateMinutes(spec(), DAY, DAY.atTime(9, 23)));
        assertEquals(0, AttendanceShiftCalculator.lateMinutes(spec(), DAY, DAY.atTime(9, 15)));
        assertEquals(0, AttendanceShiftCalculator.lateMinutes(spec(), DAY, DAY.atTime(8, 50)));
        assertEquals("LATE", AttendanceShiftCalculator.checkInStatus(spec(), DAY, DAY.atTime(9, 16)));
        assertEquals("PRESENT", AttendanceShiftCalculator.checkInStatus(spec(), DAY, DAY.atTime(9, 5)));
    }

    @Test
    void normalDayHasNoOvertimeAndKeepsGrossWorkingMinutes() {
        // 09:05 → 18:02 is 8h 57m gross, 7h 57m after the unpaid break → no overtime.
        var f = AttendanceShiftCalculator.complete(spec(), DAY, DAY.atTime(9, 5), DAY.atTime(18, 2), 537);
        assertEquals(537, f.workingMinutes());
        assertEquals("8h 57m", AttendanceShiftCalculator.formatMinutes(f.workingMinutes()));
        assertEquals(0, f.lateMinutes());
        assertEquals(0, f.earlyDepartureMinutes());
        assertEquals(0, f.overtimeMinutes());
        assertEquals(60, f.unpaidBreakMinutes());
        assertEquals("PRESENT", f.status());
    }

    @Test
    void overtimeBeyondNetShiftHours() {
        // 08:55 → 19:30 = 635 gross − 60 break = 575 net − 480 = 95 overtime.
        var f = AttendanceShiftCalculator.complete(spec(), DAY, DAY.atTime(8, 55), DAY.atTime(19, 30), 635);
        assertEquals(95, f.overtimeMinutes());
        assertEquals("PRESENT", f.status());
    }

    @Test
    void overtimeDisabledShiftNeverAccruesOvertime() {
        AttendanceShift s = general();
        s.setOvertimeEnabled(false);
        var f = AttendanceShiftCalculator.complete(AttendanceShiftCalculator.ShiftSpec.of(s), DAY,
                DAY.atTime(8, 0), DAY.atTime(21, 0), 780);
        assertEquals(0, f.overtimeMinutes());
    }

    @Test
    void earlyDepartureAndLateStatus() {
        var f = AttendanceShiftCalculator.complete(spec(), DAY, DAY.atTime(9, 22), DAY.atTime(17, 30), 488);
        assertEquals(7, f.lateMinutes());
        assertEquals(30, f.earlyDepartureMinutes());
        assertEquals("LATE", f.status());
    }

    @Test
    void shortDayIsHalfDayWithoutBreakDeduction() {
        var f = AttendanceShiftCalculator.complete(spec(), DAY, DAY.atTime(9, 0), DAY.atTime(12, 30), 210);
        assertEquals("HALF_DAY", f.status());
        assertEquals(0, f.unpaidBreakMinutes());
        assertEquals(0, f.overtimeMinutes());
    }

    @Test
    void overnightShiftEndsNextDay() {
        AttendanceShift night = general();
        night.setStartTime(LocalTime.of(22, 0));
        night.setEndTime(LocalTime.of(6, 0));
        var spec = AttendanceShiftCalculator.ShiftSpec.of(night);
        assertTrue(spec.overnight());
        assertEquals(DAY.plusDays(1).atTime(6, 0), spec.endOn(DAY));
        assertEquals(480, AttendanceShiftCalculator.spanMinutes(night.getStartTime(), night.getEndTime()));
        assertEquals(475, AttendanceShiftCalculator.minutesBetween(LocalTime.of(22, 5), LocalTime.of(6, 0)));
        var f = AttendanceShiftCalculator.complete(spec, DAY, DAY.atTime(22, 5), DAY.plusDays(1).atTime(5, 40), 455);
        assertEquals(20, f.earlyDepartureMinutes());
        assertEquals(0, f.lateMinutes());
    }

    @Test
    void netWorkingHoursAndWeekOff() {
        assertEquals(new BigDecimal("8.00"), AttendanceShiftCalculator.netWorkingHours(LocalTime.of(9, 0), LocalTime.of(18, 0), 60));
        assertTrue(AttendanceShiftCalculator.isWeekOff(general(), LocalDate.of(2026, 10, 10))); // Saturday
        assertFalse(AttendanceShiftCalculator.isWeekOff(general(), DAY));                       // Tuesday
        assertEquals(java.util.Set.of(DayOfWeek.SUNDAY), AttendanceShiftCalculator.weekOffDays(" sunday , bogus"));
        assertTrue(AttendanceShiftCalculator.isWeekOff(null, LocalDate.of(2026, 10, 11)));      // default: Sunday
    }

    @Test
    void noShiftMeansNoShiftRules() {
        var f = AttendanceShiftCalculator.complete(null, DAY, DAY.atTime(11, 0), DAY.atTime(12, 0), 60);
        assertEquals(60, f.workingMinutes());
        assertEquals(0, f.lateMinutes());
        assertEquals("PRESENT", f.status());
    }
}

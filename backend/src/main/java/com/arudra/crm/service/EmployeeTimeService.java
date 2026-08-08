package com.arudra.crm.service;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.AttendanceRepository;
import com.arudra.crm.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The self-service time-clock + hourly-earnings engine. Every operation is scoped to the
 * {@link Employee} behind the signed-in {@link User} (resolved by email) — an employee can only
 * clock and read their own time. Hourly rate and multipliers are read-only here: they are set by
 * HR on the employee master and never accepted from the portal.
 */
@Service
public class EmployeeTimeService {

    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AttendanceRepository attendanceRepository;

    // --- scoping -----------------------------------------------------------

    public Employee requireEmployee(User currentUser) {
        if (currentUser == null) throw new IllegalStateException("Not authenticated.");
        return employeeRepository.findByEmailIgnoreCaseAndIsDeletedFalse(currentUser.getEmail())
                .orElseThrow(() -> new IllegalStateException("This login is not linked to an employee record."));
    }

    private Attendance todayRow(Long employeeId) {
        return attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, LocalDate.now()).orElse(null);
    }

    // --- clock actions -----------------------------------------------------

    @LogActivity(module = "ATTENDANCE", action = "CLOCK_IN")
    @Transactional
    public Attendance clockIn(User user, BigDecimal lat, BigDecimal lng, String locationLabel, String deviceInfo) {
        Employee employee = requireEmployee(user);
        Attendance att = todayRow(employee.getId());
        if (att != null && att.getCheckInTime() != null) {
            throw new IllegalStateException("Already clocked in today.");
        }
        if (att == null) {
            att = new Attendance();
            att.setEmployee(employee);
            att.setDate(LocalDate.now());
        }
        att.setStatus("PRESENT");
        att.setCheckInTime(LocalTime.now().withNano(0));
        att.setCheckInLat(lat);
        att.setCheckInLng(lng);
        att.setLocationLabel(locationLabel);
        att.setDeviceInfo(deviceInfo);
        recompute(att, employee, LocalTime.now());
        return attendanceRepository.save(att);
    }

    @LogActivity(module = "ATTENDANCE", action = "CLOCK_OUT")
    @Transactional
    public Attendance clockOut(User user) {
        Employee employee = requireEmployee(user);
        Attendance att = requireOpen(employee.getId());
        if (att.getBreakStart() != null) { // auto-close a still-open break
            closeBreak(att, LocalTime.now());
        }
        att.setCheckOutTime(LocalTime.now().withNano(0));
        recompute(att, employee, att.getCheckOutTime());
        return attendanceRepository.save(att);
    }

    @LogActivity(module = "ATTENDANCE", action = "BREAK_START")
    @Transactional
    public Attendance startBreak(User user) {
        Employee employee = requireEmployee(user);
        Attendance att = requireOpen(employee.getId());
        if (att.getBreakStart() != null) throw new IllegalStateException("A break is already running.");
        att.setBreakStart(LocalTime.now().withNano(0));
        att.setBreakEnd(null);
        return attendanceRepository.save(att);
    }

    @LogActivity(module = "ATTENDANCE", action = "BREAK_END")
    @Transactional
    public Attendance endBreak(User user) {
        Employee employee = requireEmployee(user);
        Attendance att = requireOpen(employee.getId());
        if (att.getBreakStart() == null) throw new IllegalStateException("No break is currently running.");
        closeBreak(att, LocalTime.now());
        recompute(att, employee, LocalTime.now());
        return attendanceRepository.save(att);
    }

    private void closeBreak(Attendance att, LocalTime now) {
        long mins = Math.max(0, Duration.between(att.getBreakStart(), now).toMinutes());
        att.setBreakMinutes((att.getBreakMinutes() == null ? 0 : att.getBreakMinutes()) + (int) mins);
        att.setBreakEnd(now.withNano(0));
        att.setBreakStart(null);
    }

    private Attendance requireOpen(Long employeeId) {
        Attendance att = todayRow(employeeId);
        if (att == null || att.getCheckInTime() == null) throw new IllegalStateException("You are not clocked in.");
        if (att.getCheckOutTime() != null) throw new IllegalStateException("You have already clocked out today.");
        return att;
    }

    // --- earnings / status -------------------------------------------------

    /** Live clock status + earnings snapshot for the dashboard. */
    public Map<String, Object> getStatus(User user) {
        Employee employee = requireEmployee(user);
        Attendance today = todayRow(employee.getId());
        LocalTime asOf = LocalTime.now();

        Map<String, Object> m = new LinkedHashMap<>();
        boolean clockedIn = today != null && today.getCheckInTime() != null && today.getCheckOutTime() == null;
        boolean onBreak = clockedIn && today.getBreakStart() != null;
        m.put("clockedIn", clockedIn);
        m.put("onBreak", onBreak);
        m.put("checkInTime", today == null ? null : today.getCheckInTime());
        m.put("checkOutTime", today == null ? null : today.getCheckOutTime());
        m.put("breakMinutes", today == null ? 0 : today.getBreakMinutes());
        m.put("hourlyRate", employee.getHourlyRate());

        // Live figures for today (recompute against 'now' without persisting)
        BigDecimal[] live = today == null ? new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO}
                : computeFigures(today, employee, asOf);
        m.put("todayHours", live[0]);
        m.put("todayOvertime", live[1]);
        m.put("todayEarnings", live[2]);
        m.put("weekEarnings", earningsBetween(employee, startOfWeek(LocalDate.now()), LocalDate.now(), asOf));
        m.put("monthEarnings", earningsBetween(employee, LocalDate.now().withDayOfMonth(1), LocalDate.now(), asOf));
        return m;
    }

    public Map<String, Object> getEarnings(User user) {
        return getStatus(user); // same snapshot; kept as a distinct endpoint for clarity
    }

    private BigDecimal earningsBetween(Employee employee, LocalDate from, LocalDate to, LocalTime asOf) {
        BigDecimal total = BigDecimal.ZERO;
        for (Attendance a : attendanceRepository.findByEmployeeIdAndDateBetween(employee.getId(), from, to)) {
            LocalTime at = a.getDate().equals(LocalDate.now()) ? asOf : (a.getCheckOutTime() != null ? a.getCheckOutTime() : asOf);
            total = total.add(computeFigures(a, employee, at)[2]);
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    // --- timesheet ---------------------------------------------------------

    public Map<String, Object> getTimesheet(User user, String period) {
        Employee employee = requireEmployee(user);
        LocalDate today = LocalDate.now();
        LocalDate from, to;
        switch (period == null ? "MONTHLY" : period.toUpperCase()) {
            case "DAILY" -> { from = today; to = today; }
            case "WEEKLY" -> { from = startOfWeek(today); to = today; }
            default -> { from = today.withDayOfMonth(1); to = today; }
        }
        List<Attendance> rows = attendanceRepository.findByEmployeeIdAndDateBetween(employee.getId(), from, to);
        rows.sort((a, b) -> b.getDate().compareTo(a.getDate()));

        List<Map<String, Object>> lines = new ArrayList<>();
        BigDecimal totalHours = BigDecimal.ZERO, totalOt = BigDecimal.ZERO, totalEarn = BigDecimal.ZERO;
        for (Attendance a : rows) {
            LocalTime at = a.getCheckOutTime() != null ? a.getCheckOutTime() : LocalTime.now();
            BigDecimal[] f = computeFigures(a, employee, at);
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("date", a.getDate());
            line.put("status", a.getStatus());
            line.put("checkIn", a.getCheckInTime());
            line.put("checkOut", a.getCheckOutTime());
            line.put("breakMinutes", a.getBreakMinutes());
            line.put("hours", f[0]);
            line.put("overtime", f[1]);
            line.put("earnings", f[2]);
            lines.add(line);
            totalHours = totalHours.add(f[0]);
            totalOt = totalOt.add(f[1]);
            totalEarn = totalEarn.add(f[2]);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", period == null ? "MONTHLY" : period.toUpperCase());
        out.put("from", from);
        out.put("to", to);
        out.put("hourlyRate", employee.getHourlyRate());
        out.put("lines", lines);
        out.put("totalHours", totalHours.setScale(2, RoundingMode.HALF_UP));
        out.put("totalOvertime", totalOt.setScale(2, RoundingMode.HALF_UP));
        out.put("totalEarnings", totalEarn.setScale(2, RoundingMode.HALF_UP));
        return out;
    }

    // --- computation core --------------------------------------------------

    /** Persists computed hours/overtime/earnings onto the row (used on clock-out / break-end). */
    private void recompute(Attendance att, Employee employee, LocalTime asOf) {
        BigDecimal[] f = computeFigures(att, employee, asOf);
        att.setWorkedHours(f[0]);
        att.setOvertimeHours(f[1]);
        att.setDayEarnings(f[2]);
    }

    /**
     * Returns [workedHours, overtimeHours, earnings] for a day — regular + overtime earnings summed.
     */
    private BigDecimal[] computeFigures(Attendance att, Employee employee, LocalTime asOf) {
        BigDecimal[] b = computeBreakdown(att, employee, asOf);
        return new BigDecimal[]{ b[0], b[1], b[2].add(b[3]).setScale(2, RoundingMode.HALF_UP) };
    }

    /**
     * Returns [workedHours, overtimeHours, regularEarnings, overtimeEarnings] for a day. If not clocked
     * out, computes live against {@code asOf}. Break time (accumulated + any open break up to asOf) is
     * deducted. Overtime = hours beyond the employee's standard daily hours, paid at the overtime rate;
     * weekend days pay regular hours at the weekend rate. Explicit per-hour rates (V25) override the
     * multiplier when set; an optional {@code maxDailyHours} caps payable hours.
     */
    private BigDecimal[] computeBreakdown(Attendance att, Employee employee, LocalTime asOf) {
        BigDecimal zero = BigDecimal.ZERO;
        if (att == null || att.getCheckInTime() == null) return new BigDecimal[]{zero, zero, zero, zero};
        LocalTime end = att.getCheckOutTime() != null ? att.getCheckOutTime() : asOf;
        if (end.isBefore(att.getCheckInTime())) end = att.getCheckInTime();

        long grossMin = Duration.between(att.getCheckInTime(), end).toMinutes();
        int breakMin = att.getBreakMinutes() == null ? 0 : att.getBreakMinutes();
        if (att.getCheckOutTime() == null && att.getBreakStart() != null) { // add the still-open break
            breakMin += Math.max(0, Duration.between(att.getBreakStart(), end).toMinutes());
        }
        long payableMin = Math.max(0, grossMin - breakMin);
        BigDecimal workedHours = BigDecimal.valueOf(payableMin).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        if (employee.getMaxDailyHours() != null && workedHours.compareTo(employee.getMaxDailyHours()) > 0) {
            workedHours = employee.getMaxDailyHours(); // safety cap
        }

        BigDecimal std = nz(employee.getStandardDailyHours(), new BigDecimal("8"));
        BigDecimal overtime = workedHours.subtract(std).max(zero).setScale(2, RoundingMode.HALF_UP);
        BigDecimal regular = workedHours.subtract(overtime).max(zero);

        if (employee.getHourlyRate() == null) return new BigDecimal[]{workedHours, overtime, zero, zero};

        boolean weekend = att.getDate().getDayOfWeek() == DayOfWeek.SATURDAY
                || att.getDate().getDayOfWeek() == DayOfWeek.SUNDAY;
        BigDecimal regularEarnings = regular.multiply(regularRate(employee, weekend)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal overtimeEarnings = overtime.multiply(overtimeRate(employee)).setScale(2, RoundingMode.HALF_UP);
        return new BigDecimal[]{workedHours, overtime, regularEarnings, overtimeEarnings};
    }

    /** Regular per-hour rate — explicit weekend_rate on weekends, else hourly_rate × weekend multiplier. */
    static BigDecimal regularRate(Employee e, boolean weekend) {
        BigDecimal base = nz(e.getHourlyRate(), BigDecimal.ZERO);
        if (!weekend) return base;
        return e.getWeekendRate() != null ? e.getWeekendRate()
                : base.multiply(nz(e.getWeekendMultiplier(), BigDecimal.ONE));
    }

    /** Overtime per-hour rate — explicit overtime_rate, else hourly_rate × overtime multiplier. */
    static BigDecimal overtimeRate(Employee e) {
        BigDecimal base = nz(e.getHourlyRate(), BigDecimal.ZERO);
        return e.getOvertimeRate() != null ? e.getOvertimeRate()
                : base.multiply(nz(e.getOvertimeMultiplier(), new BigDecimal("1.5")));
    }

    /**
     * Aggregate an employee's persisted attendance across a date range into a payroll-ready summary:
     * worked/regular/overtime hours, regular/overtime earnings, and days present. Used by the hourly
     * payroll run. Recomputes each day from the wage config so explicit V25 rates are always applied.
     */
    public Map<String, Object> hourlySummary(Employee employee, LocalDate from, LocalDate to) {
        BigDecimal worked = BigDecimal.ZERO, ot = BigDecimal.ZERO, regHrs = BigDecimal.ZERO;
        BigDecimal regEarn = BigDecimal.ZERO, otEarn = BigDecimal.ZERO;
        int days = 0;
        for (Attendance a : attendanceRepository.findByEmployeeIdAndDateBetween(employee.getId(), from, to)) {
            LocalTime at = a.getCheckOutTime() != null ? a.getCheckOutTime() : LocalTime.now();
            BigDecimal[] b = computeBreakdown(a, employee, at);
            if (b[0].signum() <= 0) continue;
            worked = worked.add(b[0]);
            ot = ot.add(b[1]);
            regHrs = regHrs.add(b[0].subtract(b[1]).max(BigDecimal.ZERO));
            regEarn = regEarn.add(b[2]);
            otEarn = otEarn.add(b[3]);
            days++;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("workedHours", worked.setScale(2, RoundingMode.HALF_UP));
        m.put("regularHours", regHrs.setScale(2, RoundingMode.HALF_UP));
        m.put("overtimeHours", ot.setScale(2, RoundingMode.HALF_UP));
        m.put("regularEarnings", regEarn.setScale(2, RoundingMode.HALF_UP));
        m.put("overtimeEarnings", otEarn.setScale(2, RoundingMode.HALF_UP));
        m.put("attendanceDays", days);
        return m;
    }

    private static BigDecimal nz(BigDecimal v, BigDecimal d) { return v == null ? d : v; }

    private static LocalDate startOfWeek(LocalDate d) {
        return d.with(WeekFields.of(Locale.getDefault()).dayOfWeek(), 1);
    }
}

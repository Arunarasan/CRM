package com.arudra.crm.service;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.AttendanceSession;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.AttendanceRepository;
import com.arudra.crm.repository.AttendanceSessionRepository;
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
 * clock and read their own time. Hourly rate and multipliers are read-only here.
 *
 * An employee may clock in and out MANY times a day: each clock-in→clock-out is an
 * {@link AttendanceSession}, and the day's worked hours/overtime/earnings are summed across all a
 * day's sessions ({@link #computeBreakdown}). The one-per-day {@link Attendance} row is kept as the
 * day aggregate (first check-in / last check-out / totals) for reporting.
 */
@Service
public class EmployeeTimeService {

    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AttendanceRepository attendanceRepository;
    @Autowired private AttendanceSessionRepository sessionRepository;

    // --- scoping -----------------------------------------------------------

    public Employee requireEmployee(User currentUser) {
        if (currentUser == null) throw new IllegalStateException("Not authenticated.");
        return employeeRepository.findByEmailIgnoreCaseAndIsDeletedFalse(currentUser.getEmail())
                .orElseThrow(() -> new IllegalStateException("This login is not linked to an employee record."));
    }

    private Attendance todayRow(Long employeeId) {
        return attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, LocalDate.now()).orElse(null);
    }

    private List<AttendanceSession> sessionsOf(Attendance att) {
        return att == null ? List.of() : sessionRepository.findByAttendanceIdOrderByIdAsc(att.getId());
    }

    /** The session that's been clocked in but not yet clocked out, if any. */
    private AttendanceSession openSession(Attendance att) {
        for (AttendanceSession s : sessionsOf(att)) {
            if (s.getCheckOutTime() == null) return s;
        }
        return null;
    }

    // --- clock actions -----------------------------------------------------

    @LogActivity(module = "ATTENDANCE", action = "CLOCK_IN")
    @Transactional
    public Attendance clockIn(User user, BigDecimal lat, BigDecimal lng, String locationLabel, String deviceInfo) {
        Employee employee = requireEmployee(user);
        Attendance att = todayRow(employee.getId());
        if (att == null) {
            att = new Attendance();
            att.setEmployee(employee);
            att.setDate(LocalDate.now());
            att.setStatus("PRESENT");
            att = attendanceRepository.save(att); // need the id before attaching a session
        }
        if (openSession(att) != null) {
            throw new IllegalStateException("You're already clocked in. Clock out before clocking in again.");
        }
        AttendanceSession s = new AttendanceSession();
        s.setAttendance(att);
        s.setCheckInTime(LocalTime.now().withNano(0));
        s.setCheckInLat(lat);
        s.setCheckInLng(lng);
        s.setLocationLabel(locationLabel);
        s.setDeviceInfo(deviceInfo);
        sessionRepository.save(s);

        att.setStatus("PRESENT");
        syncAggregate(att, employee);
        return attendanceRepository.save(att);
    }

    @LogActivity(module = "ATTENDANCE", action = "CLOCK_OUT")
    @Transactional
    public Attendance clockOut(User user) {
        Employee employee = requireEmployee(user);
        Attendance att = todayRow(employee.getId());
        AttendanceSession s = att == null ? null : openSession(att);
        if (s == null) throw new IllegalStateException("You are not clocked in.");
        if (s.getBreakStart() != null) closeBreak(s, LocalTime.now()); // auto-close a still-open break
        s.setCheckOutTime(LocalTime.now().withNano(0));
        sessionRepository.save(s);

        syncAggregate(att, employee);
        return attendanceRepository.save(att);
    }

    @LogActivity(module = "ATTENDANCE", action = "BREAK_START")
    @Transactional
    public Attendance startBreak(User user) {
        Employee employee = requireEmployee(user);
        Attendance att = todayRow(employee.getId());
        AttendanceSession s = att == null ? null : openSession(att);
        if (s == null) throw new IllegalStateException("You are not clocked in.");
        if (s.getBreakStart() != null) throw new IllegalStateException("A break is already running.");
        s.setBreakStart(LocalTime.now().withNano(0));
        s.setBreakEnd(null);
        sessionRepository.save(s);
        return att;
    }

    @LogActivity(module = "ATTENDANCE", action = "BREAK_END")
    @Transactional
    public Attendance endBreak(User user) {
        Employee employee = requireEmployee(user);
        Attendance att = todayRow(employee.getId());
        AttendanceSession s = att == null ? null : openSession(att);
        if (s == null) throw new IllegalStateException("You are not clocked in.");
        if (s.getBreakStart() == null) throw new IllegalStateException("No break is currently running.");
        closeBreak(s, LocalTime.now());
        sessionRepository.save(s);
        syncAggregate(att, employee);
        return attendanceRepository.save(att);
    }

    private void closeBreak(AttendanceSession s, LocalTime now) {
        long mins = Math.max(0, Duration.between(s.getBreakStart(), now).toMinutes());
        s.setBreakMinutes((s.getBreakMinutes() == null ? 0 : s.getBreakMinutes()) + (int) mins);
        s.setBreakEnd(now.withNano(0));
        s.setBreakStart(null);
    }

    /** Refreshes the day aggregate row from its sessions: first check-in, last check-out, totals. */
    private void syncAggregate(Attendance att, Employee employee) {
        List<AttendanceSession> sessions = sessionsOf(att);
        boolean anyOpen = sessions.stream().anyMatch(s -> s.getCheckOutTime() == null);
        att.setCheckInTime(sessions.isEmpty() ? null : sessions.get(0).getCheckInTime());
        att.setCheckOutTime(anyOpen || sessions.isEmpty() ? null : sessions.get(sessions.size() - 1).getCheckOutTime());
        att.setBreakMinutes(sessions.stream().mapToInt(s -> s.getBreakMinutes() == null ? 0 : s.getBreakMinutes()).sum());
        BigDecimal[] f = computeFigures(att, employee, LocalTime.now());
        att.setWorkedHours(f[0]);
        att.setOvertimeHours(f[1]);
        att.setDayEarnings(f[2]);
    }

    // --- earnings / status -------------------------------------------------

    /** Live clock status + earnings snapshot for the dashboard. */
    public Map<String, Object> getStatus(User user) {
        Employee employee = requireEmployee(user);
        Attendance today = todayRow(employee.getId());
        List<AttendanceSession> sessions = sessionsOf(today);
        AttendanceSession open = today == null ? null : openSession(today);
        AttendanceSession last = sessions.isEmpty() ? null : sessions.get(sessions.size() - 1);
        LocalTime asOf = LocalTime.now();

        Map<String, Object> m = new LinkedHashMap<>();
        boolean clockedIn = open != null;
        boolean onBreak = clockedIn && open.getBreakStart() != null;
        m.put("clockedIn", clockedIn);
        m.put("onBreak", onBreak);
        m.put("checkInTime", open != null ? open.getCheckInTime() : (last != null ? last.getCheckInTime() : null));
        m.put("checkOutTime", clockedIn ? null : (last != null ? last.getCheckOutTime() : null));
        m.put("breakMinutes", sessions.stream().mapToInt(s -> s.getBreakMinutes() == null ? 0 : s.getBreakMinutes()).sum());
        m.put("sessionsToday", sessions.size());
        m.put("hourlyRate", employee.getHourlyRate());

        BigDecimal[] live = today == null ? new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO}
                : computeFigures(today, employee, asOf);
        m.put("todayHours", live[0]);
        m.put("todayOvertime", live[1]);
        m.put("todayEarnings", live[2]);
        m.put("weekEarnings", earningsBetween(employee, startOfWeek(LocalDate.now()), LocalDate.now(), asOf));
        m.put("monthEarnings", earningsBetween(employee, LocalDate.now().withDayOfMonth(1), LocalDate.now(), asOf));

        // Motivational daily target: a full standard day at the regular rate — the money the
        // running earnings bar fills toward on the home screen.
        BigDecimal std = nz(employee.getStandardDailyHours(), new BigDecimal("8"));
        m.put("standardDailyHours", std);
        m.put("dailyTargetEarnings", employee.getHourlyRate() == null ? null
                : std.multiply(regularRate(employee, false)).setScale(2, RoundingMode.HALF_UP));

        // Today's individual clock-in→clock-out sessions, so the home screen can list them.
        List<Map<String, Object>> sessionList = new ArrayList<>();
        for (AttendanceSession s : sessions) {
            Map<String, Object> sm = new LinkedHashMap<>();
            sm.put("checkInTime", s.getCheckInTime());
            sm.put("checkOutTime", s.getCheckOutTime());
            sm.put("breakMinutes", s.getBreakMinutes() == null ? 0 : s.getBreakMinutes());
            sm.put("onBreak", s.getCheckOutTime() == null && s.getBreakStart() != null);
            sm.put("running", s.getCheckOutTime() == null);
            sessionList.add(sm);
        }
        m.put("sessions", sessionList);
        return m;
    }

    public Map<String, Object> getEarnings(User user) {
        return getStatus(user); // same snapshot; kept as a distinct endpoint for clarity
    }

    private BigDecimal earningsBetween(Employee employee, LocalDate from, LocalDate to, LocalTime asOf) {
        BigDecimal total = BigDecimal.ZERO;
        for (Attendance a : attendanceRepository.findByEmployeeIdAndDateBetween(employee.getId(), from, to)) {
            total = total.add(computeFigures(a, employee, asOf)[2]); // closed sessions ignore asOf
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
            BigDecimal[] f = computeFigures(a, employee, LocalTime.now()); // closed sessions ignore asOf

            Map<String, Object> line = new LinkedHashMap<>();
            line.put("date", a.getDate());
            line.put("status", a.getStatus());
            line.put("checkIn", a.getCheckInTime());
            line.put("checkOut", a.getCheckOutTime());
            line.put("sessions", sessionRepository.findByAttendanceIdOrderByIdAsc(a.getId()).size());
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

    private BigDecimal[] computeFigures(Attendance att, Employee employee, LocalTime asOf) {
        BigDecimal[] b = computeBreakdown(att, employee, asOf);
        return new BigDecimal[]{ b[0], b[1], b[2].add(b[3]).setScale(2, RoundingMode.HALF_UP) };
    }

    /**
     * Returns [workedHours, overtimeHours, regularEarnings, overtimeEarnings] for a day, summed across
     * ALL the day's sessions (falling back to the aggregate row's own in/out if a legacy day has no
     * sessions). Overtime is computed on the DAILY total (beyond the employee's standard daily hours),
     * not per session, so short sessions that together exceed 8h still earn overtime.
     */
    private BigDecimal[] computeBreakdown(Attendance att, Employee employee, LocalTime asOf) {
        BigDecimal zero = BigDecimal.ZERO;
        if (att == null) return new BigDecimal[]{zero, zero, zero, zero};

        List<AttendanceSession> sessions = sessionsOf(att);
        long payableMin;
        if (sessions.isEmpty()) {
            payableMin = payableMinutes(att.getCheckInTime(), att.getCheckOutTime(), att.getBreakStart(),
                    att.getBreakMinutes(), asOf);
        } else {
            long sum = 0;
            for (AttendanceSession s : sessions) {
                sum += payableMinutes(s.getCheckInTime(), s.getCheckOutTime(), s.getBreakStart(), s.getBreakMinutes(), asOf);
            }
            payableMin = sum;
        }
        if (payableMin <= 0) return new BigDecimal[]{zero, zero, zero, zero};

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

    /** Payable minutes of a single session: (out|asOf − in) minus break (accumulated + any open break). */
    private static long payableMinutes(LocalTime in, LocalTime out, LocalTime openBreakStart, Integer breakMinutes, LocalTime asOf) {
        if (in == null) return 0;
        LocalTime end = out != null ? out : asOf;
        if (end.isBefore(in)) end = in;
        long gross = Duration.between(in, end).toMinutes();
        int brk = breakMinutes == null ? 0 : breakMinutes;
        if (out == null && openBreakStart != null) {
            brk += Math.max(0, Duration.between(openBreakStart, end).toMinutes());
        }
        return Math.max(0, gross - brk);
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
     * worked/regular/overtime hours, regular/overtime earnings, and days present. Recomputes each day
     * from the wage config (and its sessions) so explicit V25 rates are always applied.
     */
    public Map<String, Object> hourlySummary(Employee employee, LocalDate from, LocalDate to) {
        BigDecimal worked = BigDecimal.ZERO, ot = BigDecimal.ZERO, regHrs = BigDecimal.ZERO;
        BigDecimal regEarn = BigDecimal.ZERO, otEarn = BigDecimal.ZERO;
        int days = 0;
        for (Attendance a : attendanceRepository.findByEmployeeIdAndDateBetween(employee.getId(), from, to)) {
            BigDecimal[] b = computeBreakdown(a, employee, LocalTime.now()); // closed sessions ignore asOf

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

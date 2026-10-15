package com.arudra.crm.service;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.AttendanceSession;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.User;
import com.arudra.crm.entity.UserDevice;
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
    @Autowired private AttendanceVerificationService verificationService;
    @Autowired private com.arudra.crm.repository.UserDeviceRepository userDeviceRepository;
    @Autowired private com.arudra.crm.config.DeviceBindingSettings deviceBindingSettings;
    @Autowired private com.arudra.crm.repository.EmployeeWebauthnCredentialRepository webauthnCredentialRepository;

    // --- scoping -----------------------------------------------------------

    public Employee requireEmployee(User currentUser) {
        if (currentUser == null) throw new IllegalStateException("Not authenticated.");
        return employeeRepository.findByEmailIgnoreCaseAndIsDeletedFalse(currentUser.getEmail())
                .orElseThrow(() -> new IllegalStateException("This login is not linked to an employee record."));
    }

    private Attendance todayRow(Long employeeId) {
        return attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, LocalDate.now()).orElse(null);
    }

    /** How long after its check-in a session left open from yesterday still counts as a live overnight shift. */
    private static final long OVERNIGHT_SHIFT_HOURS = 16;

    /**
     * The day row clock actions apply to: yesterday's row while an overnight shift that started there is
     * still open (so the employee can take breaks and clock out after midnight), otherwise today's row.
     * A session open longer than {@link #OVERNIGHT_SHIFT_HOURS} is treated as forgotten, not live.
     */
    private Attendance activeRow(Long employeeId) {
        Attendance today = todayRow(employeeId);
        if (today != null && openSession(today) != null) return today;
        LocalDate yesterday = LocalDate.now().minusDays(1);
        Attendance prev = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, yesterday).orElse(null);
        AttendanceSession open = prev == null ? null : openSession(prev);
        if (open != null && open.getCheckInTime() != null
                && Duration.between(yesterday.atTime(open.getCheckInTime()), java.time.LocalDateTime.now()).toHours()
                        < OVERNIGHT_SHIFT_HOURS) {
            return prev;
        }
        return today;
    }

    private List<AttendanceSession> sessionsOf(Attendance att) {
        if (att == null) return List.of();
        // By clock-in time (id breaks ties) — an HR-added session can have a later id but an earlier time.
        List<AttendanceSession> list = new java.util.ArrayList<>(sessionRepository.findByAttendanceIdOrderByIdAsc(att.getId()));
        list.sort(java.util.Comparator.comparing(AttendanceSession::getCheckInTime,
                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())));
        return list;
    }

    /** The session that's been clocked in but not yet clocked out, if any. */
    private AttendanceSession openSession(Attendance att) {
        for (AttendanceSession s : sessionsOf(att)) {
            if (s.getCheckOutTime() == null) return s;
        }
        return null;
    }

    // --- clock actions -----------------------------------------------------

    public Attendance clockIn(User user, BigDecimal lat, BigDecimal lng, Integer accuracyMeters, String locationLabel,
                              String deviceInfo, boolean biometricVerified, DeviceBindingService.DeviceCheck deviceCheck) {
        return clockIn(user, lat, lng, accuracyMeters, locationLabel, deviceInfo, biometricVerified, deviceCheck, null);
    }

    @LogActivity(module = "ATTENDANCE", action = "CLOCK_IN")
    @Transactional
    public Attendance clockIn(User user, BigDecimal lat, BigDecimal lng, Integer accuracyMeters, String locationLabel,
                              String deviceInfo, boolean biometricVerified, DeviceBindingService.DeviceCheck deviceCheck,
                              String fieldNote) {
        Employee employee = requireEmployee(user);
        Attendance live = activeRow(employee.getId());
        if (live != null && openSession(live) != null) {
            throw new IllegalStateException("You're already clocked in. Clock out before clocking in again.");
        }
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
        s.setAccuracyMeters(accuracyMeters);
        s.setLocationLabel(locationLabel);
        s.setDeviceInfo(deviceInfo);
        s.setCheckInSource(AttendanceSession.SOURCE_PHONE);
        s.setFieldNote(note(fieldNote));
        // Verify against the employee's required method (geo-fence / biometric). Soft: never blocks,
        // flags for HR approval on failure. Stamps the result onto the session.
        verificationService.verify(s, employee, biometricVerified);
        verificationService.applyDevice(s, employee, deviceCheck, "Clock-in");
        sessionRepository.save(s);

        att.setStatus("PRESENT");
        syncAggregate(att, employee);
        return attendanceRepository.save(att);
    }

    public Attendance clockOut(User user, DeviceBindingService.DeviceCheck deviceCheck) {
        return clockOut(user, deviceCheck, null, null, null, null);
    }

    /** Clock-out with optional location + note (recorded as evidence; required for field punches to be judged). */
    @LogActivity(module = "ATTENDANCE", action = "CLOCK_OUT")
    @Transactional
    public Attendance clockOut(User user, DeviceBindingService.DeviceCheck deviceCheck,
                              BigDecimal lat, BigDecimal lng, Integer accuracyMeters, String fieldNote) {
        Employee employee = requireEmployee(user);
        Attendance att = activeRow(employee.getId());
        AttendanceSession s = att == null ? null : openSession(att);
        if (s == null) throw new IllegalStateException("You are not clocked in.");
        if (s.getBreakStart() != null) closeBreak(s, LocalTime.now()); // auto-close a still-open break
        s.setCheckOutTime(LocalTime.now().withNano(0));
        s.setCheckOutSource(AttendanceSession.SOURCE_PHONE);
        s.setCheckOutLat(lat);
        s.setCheckOutLng(lng);
        s.setCheckOutAccuracy(accuracyMeters);
        String outNote = note(fieldNote);
        if (outNote != null) {
            String merged = s.getFieldNote() == null ? "Out: " + outNote : s.getFieldNote() + " · Out: " + outNote;
            s.setFieldNote(merged.length() > 255 ? merged.substring(0, 255) : merged);
        }
        verificationService.applyDevice(s, employee, deviceCheck, "Clock-out");
        sessionRepository.save(s);

        syncAggregate(att, employee);
        return attendanceRepository.save(att);
    }

    // --- office kiosk (face) punches ------------------------------------------

    /** What a kiosk punch did: CHECKED_IN | CHECKED_OUT | ALREADY_IN | NOT_IN | TOO_SOON. */
    public record KioskPunchOutcome(String outcome, LocalTime time, Long minutesWorked) {}

    /** A check-out this soon after the check-in is treated as an accidental double tap. */
    private static final long KIOSK_MIN_SESSION_SECONDS = 120;

    /**
     * Records a face- or fingerprint-verified punch from an office kiosk for an already-identified employee. Mirrors the
     * phone clock-in/out (same sessions, same hours and pay maths) but needs no login: the kiosk device
     * is the trust anchor. A weak face match never blocks the punch, it flags the session for HR approval.
     * The selfie is only stored (the supplier only runs) when the punch is actually recorded.
     */
    @Transactional
    public KioskPunchOutcome kioskPunch(Employee employee, com.arudra.crm.entity.AttendanceKiosk kiosk, boolean checkIn,
                                        String method, double value, boolean weakMatch, java.util.function.Supplier<String> selfieUrl, String liveness) {
        boolean finger = "FINGER".equals(method);
        String weakReason = finger
                ? String.format(Locale.ROOT, "Weak fingerprint match on the kiosk (score %.0f), needs admin approval", value)
                : String.format(Locale.ROOT, "Weak face match on the kiosk (distance %.2f), needs admin approval", value);
        Attendance live = activeRow(employee.getId());
        AttendanceSession open = live == null ? null : openSession(live);

        if (checkIn) {
            if (open != null) return new KioskPunchOutcome("ALREADY_IN", open.getCheckInTime(), null);
            Attendance att = todayRow(employee.getId());
            if (att == null) {
                att = new Attendance();
                att.setEmployee(employee);
                att.setDate(LocalDate.now());
                att.setStatus("PRESENT");
                att = attendanceRepository.save(att); // need the id before attaching a session
            }
            AttendanceSession s = new AttendanceSession();
            s.setAttendance(att);
            LocalTime now = LocalTime.now().withNano(0);
            s.setCheckInTime(now);
            s.setCheckInSource(AttendanceSession.SOURCE_KIOSK);
            s.setKiosk(kiosk);
            s.setOfficeLocation(kiosk.getOfficeLocation());
            if (finger) s.setFingerScoreIn(value); else s.setFaceDistanceIn(value);
            s.setSelfieInUrl(selfieUrl.get());
            s.setLivenessIn(liveness);
            verificationService.applyBiometric(s, employee, method, weakMatch, weakReason, true);
            sessionRepository.save(s);
            att.setStatus("PRESENT");
            syncAggregate(att, employee);
            attendanceRepository.save(att);
            return new KioskPunchOutcome("CHECKED_IN", now, null);
        }

        if (open == null) return new KioskPunchOutcome("NOT_IN", null, null);
        java.time.LocalDateTime inAt = live.getDate().atTime(open.getCheckInTime());
        long sinceIn = Duration.between(inAt, java.time.LocalDateTime.now()).getSeconds();
        if (sinceIn >= 0 && sinceIn < KIOSK_MIN_SESSION_SECONDS) {
            return new KioskPunchOutcome("TOO_SOON", open.getCheckInTime(), null);
        }
        if (open.getBreakStart() != null) closeBreak(open, LocalTime.now()); // auto-close a still-open break
        LocalTime now = LocalTime.now().withNano(0);
        open.setCheckOutTime(now);
        open.setCheckOutSource(AttendanceSession.SOURCE_KIOSK);
        if (finger) open.setFingerScoreOut(value); else open.setFaceDistanceOut(value);
        open.setSelfieOutUrl(selfieUrl.get());
        open.setLivenessOut(liveness);
        verificationService.applyBiometric(open, employee, method, weakMatch, weakReason, false);
        sessionRepository.save(open);
        syncAggregate(live, employee);
        attendanceRepository.save(live);
        return new KioskPunchOutcome("CHECKED_OUT", now, Math.max(0, sinceIn / 60));
    }

    @LogActivity(module = "ATTENDANCE", action = "BREAK_START")
    @Transactional
    public Attendance startBreak(User user) {
        Employee employee = requireEmployee(user);
        Attendance att = activeRow(employee.getId());
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
        Attendance att = activeRow(employee.getId());
        AttendanceSession s = att == null ? null : openSession(att);
        if (s == null) throw new IllegalStateException("You are not clocked in.");
        if (s.getBreakStart() == null) throw new IllegalStateException("No break is currently running.");
        closeBreak(s, LocalTime.now());
        sessionRepository.save(s);
        syncAggregate(att, employee);
        return attendanceRepository.save(att);
    }

    private void closeBreak(AttendanceSession s, LocalTime now) {
        long mins = minutesBetween(s.getBreakStart(), now, true); // a break can run past midnight
        s.setBreakMinutes((s.getBreakMinutes() == null ? 0 : s.getBreakMinutes()) + (int) mins);
        s.setBreakEnd(now.withNano(0));
        s.setBreakStart(null);
    }

    /** Recompute + persist a day's aggregate from its (possibly just-edited) sessions. Used by the
     *  attendance-correction flow after rewriting session times so worked-hours/earnings stay in sync. */
    @Transactional
    public Attendance recomputeAggregate(Attendance att) {
        syncAggregate(att, att.getEmployee());
        return attendanceRepository.save(att);
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
        Attendance today = activeRow(employee.getId()); // yesterday's row during a live overnight shift
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
        // Attendance verification hints for the clock UI.
        m.put("attendanceMethod", employee.getAttendanceMethod() == null ? "GEO" : employee.getAttendanceMethod());
        m.put("attendanceMethodRequested", employee.getAttendanceMethodRequested());
        m.put("biometricRegistered", webauthnCredentialRepository.existsByEmployeeIdAndIsDeletedFalse(employee.getId()));
        // Phone binding hints: OFF/SOFT/HARD + whether this login has an approved / pending phone.
        m.put("deviceBindingMode", deviceBindingSettings.effectiveMode(employee));
        m.put("deviceRegistered", userDeviceRepository.countByUserIdAndStatusAndIsDeletedFalse(user.getId(), UserDevice.ACTIVE) > 0);
        m.put("devicePending", userDeviceRepository.countByUserIdAndStatusAndIsDeletedFalse(user.getId(), UserDevice.PENDING) > 0);

        // Second-accurate so a refresh re-syncs to the same running time the screen was already showing
        // (whole-minute figures made the timer/earnings jump back by up to a minute on every reload).
        BigDecimal[] live = today == null ? new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO}
                : computeBreakdown(today, employee, asOf, true);
        m.put("todayHours", live[0]);
        m.put("todayOvertime", live[1].setScale(2, RoundingMode.HALF_UP));
        m.put("todayEarnings", live[2].add(live[3]).setScale(4, RoundingMode.HALF_UP));        // Time waiting for admin approval — not in todayHours/earnings until approved.
        m.put("todayPendingHours", hours(pendingMinutes(today, asOf)));
        m.put("weekEarnings", earningsBetween(employee, startOfWeek(LocalDate.now()), LocalDate.now(), asOf));
        m.put("monthEarnings", earningsBetween(employee, LocalDate.now().withDayOfMonth(1), LocalDate.now(), asOf));

        // Motivational daily target: a full standard day at the regular rate — the money the
        // running earnings bar fills toward on the home screen.
        BigDecimal std = nz(employee.getStandardDailyHours(), new BigDecimal("8"));
        m.put("standardDailyHours", std);
        // Stretch goals past the standard day pay at the overtime rate; the safety cap stops the ladder.
        m.put("overtimeRate", employee.getHourlyRate() == null ? null : overtimeRate(employee).setScale(2, RoundingMode.HALF_UP));
        m.put("maxDailyHours", employee.getMaxDailyHours());
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
            sm.put("verificationMethod", s.getVerificationMethod());
            sm.put("verified", Boolean.TRUE.equals(s.getVerified()));
            sm.put("flagged", Boolean.TRUE.equals(s.getFlagged()));
            sm.put("flagReason", s.getFlagReason());
            sm.put("approvalStatus", s.getApprovalStatus());
            sm.put("payable", s.isPayable());
            sm.put("approvalNote", s.getApprovalNote());
            sm.put("checkInSource", s.getCheckInSource());
            sm.put("checkOutSource", s.getCheckOutSource());
            sm.put("fieldNote", s.getFieldNote());
            sm.put("deviceVerified", Boolean.TRUE.equals(s.getDeviceVerified()));
            sm.put("deviceMismatchReason", s.getDeviceMismatchReason());
            sessionList.add(sm);
        }
        m.put("sessions", sessionList);
        return m;
    }

    public Map<String, Object> getEarnings(User user) {
        return getStatus(user); // same snapshot; kept as a distinct endpoint for clarity
    }

    // --- self-service attendance-method switch (admin-approved) ------------

    /** Employee requests to switch to biometric attendance (resolves to ANY on admin approval). */
    @Transactional
    public void requestBiometricAttendance(User user) {
        Employee e = requireEmployee(user);
        e.setAttendanceMethodRequested("ANY");
        e.setAttendanceMethodRequestedAt(java.time.LocalDateTime.now());
        employeeRepository.save(e);
    }

    /** Employee withdraws a pending method-change request. */
    @Transactional
    public void cancelMethodRequest(User user) {
        Employee e = requireEmployee(user);
        e.setAttendanceMethodRequested(null);
        e.setAttendanceMethodRequestedAt(null);
        employeeRepository.save(e);
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
        return getTimesheet(user, period, null, null);
    }

    /** Longest range a custom timesheet may span (keeps the per-day session lookups bounded). */
    private static final int MAX_CUSTOM_DAYS = 366;

    /**
     * Timesheet + earnings for a preset period (DAILY / WEEKLY / MONTHLY / LAST_MONTH) or a CUSTOM
     * {@code from}..{@code to} range. Each day is recomputed from the wage config, split into regular
     * vs overtime pay; flagged punches still awaiting admin approval are reported but never paid.
     */
    public Map<String, Object> getTimesheet(User user, String period, LocalDate customFrom, LocalDate customTo) {
        Employee employee = requireEmployee(user);
        LocalDate today = LocalDate.now();
        String p = period == null || period.isBlank() ? "MONTHLY" : period.trim().toUpperCase();
        LocalDate from, to;
        switch (p) {
            case "DAILY" -> { from = today; to = today; }
            case "WEEKLY" -> { from = startOfWeek(today); to = today; }
            case "LAST_MONTH" -> {
                from = today.minusMonths(1).withDayOfMonth(1);
                to = from.withDayOfMonth(from.lengthOfMonth());
            }
            case "CUSTOM" -> {
                if (customFrom == null || customTo == null) {
                    throw new IllegalStateException("Pick both a start and an end date.");
                }
                from = customFrom;
                to = customTo.isAfter(today) ? today : customTo;
                if (from.isAfter(to)) throw new IllegalStateException("Start date must be on or before the end date.");
                if (java.time.temporal.ChronoUnit.DAYS.between(from, to) + 1 > MAX_CUSTOM_DAYS) {
                    throw new IllegalStateException("Pick a range of " + MAX_CUSTOM_DAYS + " days or less.");
                }
            }
            default -> { p = "MONTHLY"; from = today.withDayOfMonth(1); to = today; }
        }
        List<Attendance> rows = attendanceRepository.findByEmployeeIdAndDateBetween(employee.getId(), from, to);
        rows.sort((a, b) -> b.getDate().compareTo(a.getDate()));

        LocalTime now = LocalTime.now();
        List<Map<String, Object>> lines = new ArrayList<>();
        BigDecimal totalHours = BigDecimal.ZERO, totalOt = BigDecimal.ZERO;
        BigDecimal regEarn = BigDecimal.ZERO, otEarn = BigDecimal.ZERO;
        BigDecimal weekendHours = BigDecimal.ZERO, weekendEarn = BigDecimal.ZERO;
        long pendingMin = 0;
        int daysWorked = 0;
        for (Attendance a : rows) {
            BigDecimal[] b = computeBreakdown(a, employee, now); // closed sessions ignore asOf
            BigDecimal dayEarn = b[2].add(b[3]).setScale(2, RoundingMode.HALF_UP);
            long dayPending = pendingMinutes(a, now);
            boolean weekend = a.getDate().getDayOfWeek() == DayOfWeek.SATURDAY
                    || a.getDate().getDayOfWeek() == DayOfWeek.SUNDAY;

            Map<String, Object> line = new LinkedHashMap<>();
            line.put("date", a.getDate());
            line.put("status", a.getStatus());
            line.put("checkIn", a.getCheckInTime());
            line.put("checkOut", a.getCheckOutTime());
            line.put("sessions", sessionsOf(a).size());
            line.put("breakMinutes", a.getBreakMinutes());
            line.put("hours", b[0]);
            line.put("overtime", b[1]);
            line.put("regularEarnings", b[2]);
            line.put("overtimeEarnings", b[3]);
            line.put("earnings", dayEarn);
            line.put("weekend", weekend);
            line.put("pendingHours", hours(dayPending));
            lines.add(line);

            totalHours = totalHours.add(b[0]);
            totalOt = totalOt.add(b[1]);
            regEarn = regEarn.add(b[2]);
            otEarn = otEarn.add(b[3]);
            pendingMin += dayPending;
            if (b[0].signum() > 0) {
                daysWorked++;
                if (weekend) { weekendHours = weekendHours.add(b[0]); weekendEarn = weekendEarn.add(dayEarn); }
            }
        }
        BigDecimal totalEarn = regEarn.add(otEarn);
        BigDecimal pendingHours = hours(pendingMin);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", p);
        out.put("from", from);
        out.put("to", to);
        out.put("hourlyRate", employee.getHourlyRate());
        out.put("overtimeRate", employee.getHourlyRate() == null ? null : overtimeRate(employee).setScale(2, RoundingMode.HALF_UP));
        out.put("weekendRate", employee.getHourlyRate() == null ? null : regularRate(employee, true).setScale(2, RoundingMode.HALF_UP));
        out.put("standardDailyHours", nz(employee.getStandardDailyHours(), new BigDecimal("8")));
        out.put("lines", lines);
        out.put("daysWorked", daysWorked);
        out.put("totalHours", totalHours.setScale(2, RoundingMode.HALF_UP));
        out.put("regularHours", totalHours.subtract(totalOt).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        out.put("totalOvertime", totalOt.setScale(2, RoundingMode.HALF_UP));
        out.put("weekendHours", weekendHours.setScale(2, RoundingMode.HALF_UP));
        out.put("regularEarnings", regEarn.setScale(2, RoundingMode.HALF_UP));
        out.put("overtimeEarnings", otEarn.setScale(2, RoundingMode.HALF_UP));
        out.put("weekendEarnings", weekendEarn.setScale(2, RoundingMode.HALF_UP));
        out.put("totalEarnings", totalEarn.setScale(2, RoundingMode.HALF_UP));
        out.put("avgDailyEarnings", daysWorked == 0 ? BigDecimal.ZERO.setScale(2)
                : totalEarn.divide(BigDecimal.valueOf(daysWorked), 2, RoundingMode.HALF_UP));
        out.put("avgDailyHours", daysWorked == 0 ? BigDecimal.ZERO.setScale(2)
                : totalHours.divide(BigDecimal.valueOf(daysWorked), 2, RoundingMode.HALF_UP));
        // Flagged punches waiting on an admin — NOT in the totals above; shown so the employee knows.
        out.put("pendingHours", pendingHours);
        out.put("pendingEarningsEstimate", employee.getHourlyRate() == null ? BigDecimal.ZERO.setScale(2)
                : pendingHours.multiply(employee.getHourlyRate()).setScale(2, RoundingMode.HALF_UP));
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
        return computeBreakdown(att, employee, asOf, false);
    }

    /**
     * @param precise count time to the second instead of whole minutes (hours kept to 6 places). Used
     *                only for the live clock display, so a page refresh re-syncs to exactly the same
     *                running time; payroll keeps the whole-minute figures.
     */
    private BigDecimal[] computeBreakdown(Attendance att, Employee employee, LocalTime asOf, boolean precise) {
        BigDecimal zero = BigDecimal.ZERO;
        if (att == null) return new BigDecimal[]{zero, zero, zero, zero};

        List<AttendanceSession> sessions = sessionsOf(att);
        long payableUnits; // minutes, or seconds when precise
        // A past day with no clock-out has no real end time, so it can't be priced (the live clock,
        // `precise`, still runs an overnight shift). It counts again once an admin sets a check-out.
        boolean pastDay = !precise && att.getDate() != null && att.getDate().isBefore(LocalDate.now());
        if (sessions.isEmpty()) {
            if (pastDay && att.getCheckOutTime() == null) return new BigDecimal[]{zero, zero, zero, zero};
            payableUnits = payable(precise, att.getDate(), att.getCheckInTime(), att.getCheckOutTime(), att.getBreakStart(),
                    att.getBreakMinutes(), asOf);
        } else {
            // Only payable sessions count: a flagged session waits for admin approval and a rejected
            // one never counts (see AttendanceSession#isPayable). Pending time is reported separately.
            long sum = 0;
            for (AttendanceSession s : sessions) {
                if (!s.isPayable()) continue;
                if (pastDay && s.getCheckOutTime() == null) continue;
                sum += payable(precise, att.getDate(), s.getCheckInTime(), s.getCheckOutTime(), s.getBreakStart(), s.getBreakMinutes(), asOf);
            }
            payableUnits = sum;
        }
        if (payableUnits <= 0) return new BigDecimal[]{zero, zero, zero, zero};

        BigDecimal workedHours = precise
                ? BigDecimal.valueOf(payableUnits).divide(BigDecimal.valueOf(3600), 6, RoundingMode.HALF_UP)
                : BigDecimal.valueOf(payableUnits).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        if (employee.getMaxDailyHours() != null && workedHours.compareTo(employee.getMaxDailyHours()) > 0) {
            workedHours = employee.getMaxDailyHours(); // safety cap
        }

        BigDecimal std = nz(employee.getStandardDailyHours(), new BigDecimal("8"));
        int hScale = precise ? 6 : 2, mScale = precise ? 4 : 2;
        BigDecimal overtime = workedHours.subtract(std).max(zero).setScale(hScale, RoundingMode.HALF_UP);
        BigDecimal regular = workedHours.subtract(overtime).max(zero);

        if (employee.getHourlyRate() == null) return new BigDecimal[]{workedHours, overtime, zero, zero};

        boolean weekend = att.getDate().getDayOfWeek() == DayOfWeek.SATURDAY
                || att.getDate().getDayOfWeek() == DayOfWeek.SUNDAY;
        BigDecimal regularEarnings = regular.multiply(regularRate(employee, weekend)).setScale(mScale, RoundingMode.HALF_UP);
        BigDecimal overtimeEarnings = overtime.multiply(overtimeRate(employee)).setScale(mScale, RoundingMode.HALF_UP);
        return new BigDecimal[]{workedHours, overtime, regularEarnings, overtimeEarnings};
    }

    private static long payable(boolean precise, LocalDate day, LocalTime in, LocalTime out, LocalTime openBreakStart,
                                Integer breakMinutes, LocalTime asOf) {
        return precise ? payableSeconds(day, in, out, openBreakStart, breakMinutes, asOf)
                : payableMinutes(day, in, out, openBreakStart, breakMinutes, asOf);
    }

    /** Same as {@link #payableMinutes} but to the second: (out|asOf − in) minus break (accumulated + open). */
    private static long payableSeconds(LocalDate day, LocalTime in, LocalTime out, LocalTime openBreakStart,
                                       Integer breakMinutes, LocalTime asOf) {
        if (in == null) return 0;
        LocalTime end = out != null ? out : asOf;
        boolean overnight = out != null || (day != null && day.equals(LocalDate.now().minusDays(1)));
        long gross = secondsBetween(in, end, overnight);
        long brk = (breakMinutes == null ? 0 : breakMinutes) * 60L;
        if (out == null && openBreakStart != null) brk += secondsBetween(openBreakStart, end, overnight);
        return Math.max(0, gross - brk);
    }

    private static long secondsBetween(LocalTime start, LocalTime end, boolean wrap) {
        long s = Duration.between(start, end).getSeconds();
        if (s >= 0) return s;
        return wrap ? s + 24 * 3600 : 0;
    }

    /** Minutes of a day's sessions still waiting for admin approval (not paid until approved). */
    private long pendingMinutes(Attendance att, LocalTime asOf) {
        if (att == null) return 0;
        long sum = 0;
        for (AttendanceSession s : sessionsOf(att)) {
            if (!s.isAwaitingApproval()) continue;
            if (s.getCheckOutTime() == null && att.getDate() != null && att.getDate().isBefore(LocalDate.now())) continue;
            sum += payableMinutes(att.getDate(), s.getCheckInTime(), s.getCheckOutTime(), s.getBreakStart(), s.getBreakMinutes(), asOf);
        }
        return sum;
    }

    private static BigDecimal hours(long minutes) {
        return BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    /** Payable minutes of a session on {@code day}: (out|asOf − in) minus break (accumulated + any open break). */
    private static long payableMinutes(LocalDate day, LocalTime in, LocalTime out, LocalTime openBreakStart,
                                       Integer breakMinutes, LocalTime asOf) {
        if (in == null) return 0;
        LocalTime end = out != null ? out : asOf;
        // An end earlier than the start means the shift ran past midnight — true for any clocked-out
        // session, and for a still-open one only when it started yesterday (an overnight shift).
        // An open session from an older day is abandoned: it stays at 0 until an admin corrects it.
        boolean overnight = out != null || (day != null && day.equals(LocalDate.now().minusDays(1)));
        long gross = minutesBetween(in, end, overnight);
        int brk = breakMinutes == null ? 0 : breakMinutes;
        if (out == null && openBreakStart != null) {
            brk += minutesBetween(openBreakStart, end, overnight);
        }
        return Math.max(0, gross - brk);
    }

    /** Minutes from {@code start} to {@code end}; when {@code wrap}, an earlier end counts as the next day. */
    private static long minutesBetween(LocalTime start, LocalTime end, boolean wrap) {
        long m = Duration.between(start, end).toMinutes();
        if (m >= 0) return m;
        return wrap ? m + 24 * 60 : 0;
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
        long pendingMin = 0;
        int pendingSessions = 0;
        for (Attendance a : attendanceRepository.findByEmployeeIdAndDateBetween(employee.getId(), from, to)) {
            pendingMin += pendingMinutes(a, LocalTime.now());
            pendingSessions += (int) sessionsOf(a).stream().filter(AttendanceSession::isAwaitingApproval).count();
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
        // Flagged punches still waiting for an admin — NOT included in the figures above.
        m.put("pendingHours", hours(pendingMin));
        m.put("pendingSessions", pendingSessions);
        return m;
    }

    private static BigDecimal nz(BigDecimal v, BigDecimal d) { return v == null ? d : v; }

    private static String note(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > 200 ? t.substring(0, 200) : t;
    }

    private static LocalDate startOfWeek(LocalDate d) {
        return d.with(WeekFields.of(Locale.getDefault()).dayOfWeek(), 1);
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.AttendanceDevice;
import com.arudra.crm.entity.AttendanceShift;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.repository.AttendanceDeviceRepository;
import com.arudra.crm.repository.AttendanceRepository;
import com.arudra.crm.repository.AttendanceSessionRepository;
import com.arudra.crm.repository.EmployeeBiometricRepository;
import com.arudra.crm.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Read side of attendance: the HR dashboard (one day, every employee), an employee's monthly
 * history + calendar, and a date-range report.
 *
 * A day with no attendance row is resolved virtually (nothing is written): WEEK_OFF on the shift's
 * weekly off, NOT_MARKED for today before the shift start + grace has passed or for future days,
 * otherwise ABSENT. Approved leave already creates LEAVE rows (HrService), so it is read as stored.
 */
@Service
public class AttendanceReportService {

    /** Statuses that mean the employee turned up. */
    public static final Set<String> PRESENT_LIKE = Set.of("PRESENT", "LATE", "HALF_DAY", "ON_DUTY", "WORK_FROM_HOME");

    private final EmployeeRepository employeeRepository;
    private final AttendanceRepository attendanceRepository;
    private final AttendanceSessionRepository sessionRepository;
    private final AttendanceDeviceRepository deviceRepository;
    private final EmployeeBiometricRepository biometricRepository;
    private final AttendanceShiftService shiftService;
    private final AttendanceDeviceService deviceService;

    @Value("${app.attendance.dashboard.max-range-days:93}") private int maxRangeDays;

    public AttendanceReportService(EmployeeRepository employeeRepository, AttendanceRepository attendanceRepository,
                                   AttendanceSessionRepository sessionRepository, AttendanceDeviceRepository deviceRepository,
                                   EmployeeBiometricRepository biometricRepository, AttendanceShiftService shiftService,
                                   AttendanceDeviceService deviceService) {
        this.employeeRepository = employeeRepository;
        this.attendanceRepository = attendanceRepository;
        this.sessionRepository = sessionRepository;
        this.deviceRepository = deviceRepository;
        this.biometricRepository = biometricRepository;
        this.shiftService = shiftService;
        this.deviceService = deviceService;
    }

    public record Filters(Long employeeId, Long departmentId, Long branchId, Long shiftId, Long deviceId, String status) {}

    // =====================================================================================
    // Dashboard
    // =====================================================================================

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard(LocalDate date, Filters f) {
        LocalDate day = date == null ? LocalDate.now() : date;
        AttendanceShift defaultShift = shiftService.defaultShift();
        List<Employee> employees = filteredEmployees(f, defaultShift);
        Map<Long, Attendance> byEmployee = new HashMap<>();
        for (Attendance a : attendanceRepository.findByDateBetween(day, day)) {
            if (Boolean.TRUE.equals(a.getIsDeleted())) continue;
            byEmployee.merge(a.getEmployee().getId(), a, (x, y) -> x.getId() > y.getId() ? x : y);
        }
        Set<Long> enrolled = enrolledIds(employees);

        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String k : List.of("PRESENT", "LATE", "ABSENT", "LEAVE", "HALF_DAY", "WEEK_OFF", "HOLIDAY", "NOT_MARKED",
                "ON_DUTY", "WORK_FROM_HOME")) counts.put(k, 0);
        int checkedInNow = 0, biometricCount = 0;

        for (Employee e : employees) {
            AttendanceShift shift = e.getAttendanceShift() != null ? e.getAttendanceShift() : defaultShift;
            Attendance a = byEmployee.get(e.getId());
            if (f.deviceId() != null && (a == null || a.getDevice() == null || !Objects.equals(a.getDevice().getId(), f.deviceId()))) {
                continue;
            }
            String status = dayStatus(a, shift, day);
            if (f.status() != null && !f.status().isBlank() && !matchesStatus(f.status(), status)) continue;

            counts.merge(status, 1, Integer::sum);
            boolean openNow = a != null && a.getCheckInTime() != null && a.getCheckOutTime() == null;
            if (openNow) checkedInNow++;
            if (a != null && Boolean.TRUE.equals(a.getBiometricVerified())) biometricCount++;
            rows.add(row(e, a, shift, status, enrolled.contains(e.getId()), day));
        }
        rows.sort(Comparator.comparing((Map<String, Object> r) -> statusOrder((String) r.get("status")))
                .thenComparing(r -> String.valueOf(r.get("employeeName"))));

        int present = counts.get("PRESENT") + counts.get("LATE") + counts.get("ON_DUTY") + counts.get("WORK_FROM_HOME");
        Map<String, Object> cards = new LinkedHashMap<>();
        cards.put("total", rows.size());
        cards.put("present", present);
        cards.put("late", counts.get("LATE"));
        cards.put("absent", counts.get("ABSENT"));
        cards.put("onLeave", counts.get("LEAVE"));
        cards.put("halfDay", counts.get("HALF_DAY"));
        cards.put("weekOff", counts.get("WEEK_OFF") + counts.get("HOLIDAY"));
        cards.put("notMarked", counts.get("NOT_MARKED"));
        cards.put("checkedInNow", checkedInNow);
        cards.put("biometric", biometricCount);

        List<AttendanceDevice> devices = deviceRepository.findByStatusAndIsDeletedFalse("ACTIVE");
        long online = devices.stream().filter(d -> d.getDeviceUuid() != null && deviceService.isOnline(d)).count();
        Map<String, Object> deviceSummary = new LinkedHashMap<>();
        deviceSummary.put("active", devices.stream().filter(d -> d.getDeviceUuid() != null).count());
        deviceSummary.put("online", online);
        deviceSummary.put("pendingSync", devices.stream().mapToInt(d -> d.getPendingSyncCount() == null ? 0 : d.getPendingSyncCount()).sum());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", day);
        out.put("cards", cards);
        out.put("devices", deviceSummary);
        out.put("rows", rows);
        return out;
    }

    // =====================================================================================
    // Employee history (month summary + calendar)
    // =====================================================================================

    @Transactional(readOnly = true)
    public Map<String, Object> history(Long employeeId, int year, int month) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new com.arudra.crm.exception.ResourceNotFoundException("Employee not found."));
        YearMonth ym = YearMonth.of(year, month);
        LocalDate from = ym.atDay(1), to = ym.atEndOfMonth();
        AttendanceShift shift = shiftService.resolve(e);
        Map<LocalDate, Attendance> byDay = new HashMap<>();
        for (Attendance a : attendanceRepository.findByEmployeeIdAndDateBetween(employeeId, from, to)) {
            if (Boolean.TRUE.equals(a.getIsDeleted())) continue;
            byDay.merge(a.getDate(), a, (x, y) -> x.getId() > y.getId() ? x : y);
        }

        int workingDays = 0, present = 0, absent = 0, leave = 0, halfDay = 0, late = 0, weekOff = 0, holiday = 0;
        long overtime = 0, worked = 0, lateMinutes = 0;
        List<Map<String, Object>> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Attendance a = byDay.get(d);
            String status = dayStatus(a, shift, d);
            boolean weeklyOff = AttendanceShiftCalculator.isWeekOff(shift, d);
            if (!weeklyOff && !"HOLIDAY".equals(status)) workingDays++;
            switch (status) {
                case "PRESENT", "ON_DUTY", "WORK_FROM_HOME" -> present++;
                case "LATE" -> { present++; late++; }
                case "HALF_DAY" -> halfDay++;
                case "ABSENT" -> absent++;
                case "LEAVE" -> leave++;
                case "WEEK_OFF" -> weekOff++;
                case "HOLIDAY" -> holiday++;
                default -> { }
            }
            if (a != null) {
                overtime += nz(a.getOvertimeMinutes());
                lateMinutes += nz(a.getLateMinutes());
                worked += workedMinutes(a);
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", d);
            m.put("dayOfWeek", d.getDayOfWeek().name());
            m.put("status", status);
            m.put("checkIn", a == null ? null : a.getCheckInTime());
            m.put("checkOut", a == null ? null : a.getCheckOutTime());
            m.put("workingMinutes", a == null ? null : workedMinutes(a));
            m.put("lateMinutes", a == null ? null : a.getLateMinutes());
            m.put("overtimeMinutes", a == null ? null : a.getOvertimeMinutes());
            m.put("method", a == null ? null : a.getCheckInMethod());
            m.put("biometricVerified", a != null && Boolean.TRUE.equals(a.getBiometricVerified()));
            m.put("remarks", a == null ? null : a.getRemarks());
            days.add(m);
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("workingDays", workingDays);
        summary.put("present", present);
        summary.put("absent", absent);
        summary.put("leave", leave);
        summary.put("halfDay", halfDay);
        summary.put("late", late);
        summary.put("weekOff", weekOff);
        summary.put("holiday", holiday);
        summary.put("overtimeMinutes", overtime);
        summary.put("workedMinutes", worked);
        summary.put("lateMinutes", lateMinutes);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("employeeId", e.getId());
        out.put("employeeName", AttendanceDeviceService.fullName(e));
        out.put("year", year);
        out.put("month", month);
        out.put("shift", shift == null ? null : Map.of("id", shift.getId(), "name", shift.getName(),
                "startTime", shift.getStartTime(), "endTime", shift.getEndTime()));
        out.put("summary", summary);
        out.put("days", days);
        return out;
    }

    // =====================================================================================
    // Range report
    // =====================================================================================

    @Transactional(readOnly = true)
    public Map<String, Object> report(LocalDate from, LocalDate to, Filters f) {
        if (from == null || to == null) throw new IllegalArgumentException("from and to are required.");
        if (to.isBefore(from)) throw new IllegalArgumentException("'to' must not be before 'from'.");
        if (from.plusDays(maxRangeDays).isBefore(to)) throw new IllegalArgumentException("Range is limited to " + maxRangeDays + " days.");
        AttendanceShift defaultShift = shiftService.defaultShift();
        List<Employee> employees = filteredEmployees(f, defaultShift);
        Map<Long, Map<LocalDate, Attendance>> rowsByEmp = new HashMap<>();
        for (Attendance a : attendanceRepository.findByDateBetween(from, to)) {
            if (Boolean.TRUE.equals(a.getIsDeleted())) continue;
            if (f.deviceId() != null && (a.getDevice() == null || !Objects.equals(a.getDevice().getId(), f.deviceId()))) continue;
            rowsByEmp.computeIfAbsent(a.getEmployee().getId(), k -> new HashMap<>())
                    .merge(a.getDate(), a, (x, y) -> x.getId() > y.getId() ? x : y);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Long> totals = new LinkedHashMap<>();
        for (String k : List.of("present", "late", "absent", "leave", "halfDay", "workedMinutes", "overtimeMinutes", "lateMinutes")) totals.put(k, 0L);
        for (Employee e : employees) {
            AttendanceShift shift = e.getAttendanceShift() != null ? e.getAttendanceShift() : defaultShift;
            Map<LocalDate, Attendance> days = rowsByEmp.getOrDefault(e.getId(), Map.of());
            if (f.deviceId() != null && days.isEmpty()) continue;
            int present = 0, late = 0, absent = 0, leave = 0, half = 0, workingDays = 0;
            long worked = 0, ot = 0, lateMin = 0;
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                Attendance a = days.get(d);
                String st = dayStatus(a, shift, d);
                if (!"WEEK_OFF".equals(st) && !"HOLIDAY".equals(st) && !"NOT_MARKED".equals(st)) workingDays++;
                switch (st) {
                    case "PRESENT", "ON_DUTY", "WORK_FROM_HOME" -> present++;
                    case "LATE" -> { present++; late++; }
                    case "ABSENT" -> absent++;
                    case "LEAVE" -> leave++;
                    case "HALF_DAY" -> half++;
                    default -> { }
                }
                if (a != null) {
                    worked += workedMinutes(a);
                    ot += nz(a.getOvertimeMinutes());
                    lateMin += nz(a.getLateMinutes());
                }
            }
            if (f.status() != null && !f.status().isBlank()) {
                String s = f.status().toUpperCase();
                boolean keep = switch (s) {
                    case "LATE" -> late > 0;
                    case "ABSENT" -> absent > 0;
                    case "LEAVE" -> leave > 0;
                    case "HALF_DAY" -> half > 0;
                    case "PRESENT" -> present > 0;
                    default -> true;
                };
                if (!keep) continue;
            }
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("employeeId", e.getId());
            r.put("employeeCode", e.getEmployeeCode());
            r.put("employeeName", AttendanceDeviceService.fullName(e));
            r.put("department", e.getDepartment() == null ? null : e.getDepartment().getName());
            r.put("branch", e.getBranch() == null ? null : e.getBranch().getName());
            r.put("shift", shift == null ? null : shift.getName());
            r.put("workingDays", workingDays);
            r.put("present", present);
            r.put("late", late);
            r.put("absent", absent);
            r.put("leave", leave);
            r.put("halfDay", half);
            r.put("workedMinutes", worked);
            r.put("overtimeMinutes", ot);
            r.put("lateMinutes", lateMin);
            rows.add(r);
            totals.merge("present", (long) present, Long::sum);
            totals.merge("late", (long) late, Long::sum);
            totals.merge("absent", (long) absent, Long::sum);
            totals.merge("leave", (long) leave, Long::sum);
            totals.merge("halfDay", (long) half, Long::sum);
            totals.merge("workedMinutes", worked, Long::sum);
            totals.merge("overtimeMinutes", ot, Long::sum);
            totals.merge("lateMinutes", lateMin, Long::sum);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", from);
        out.put("to", to);
        out.put("rows", rows);
        out.put("totals", totals);
        return out;
    }

    // =====================================================================================
    // helpers
    // =====================================================================================

    private List<Employee> filteredEmployees(Filters f, AttendanceShift defaultShift) {
        List<Employee> out = new ArrayList<>();
        for (Employee e : employeeRepository.findActiveForAttendance()) {
            if (Boolean.FALSE.equals(e.getAttendanceRequired()) && f.employeeId() == null) continue;
            if (f.employeeId() != null && !Objects.equals(e.getId(), f.employeeId())) continue;
            if (f.departmentId() != null && (e.getDepartment() == null || !Objects.equals(e.getDepartment().getId(), f.departmentId()))) continue;
            if (f.branchId() != null && (e.getBranch() == null || !Objects.equals(e.getBranch().getId(), f.branchId()))) continue;
            if (f.shiftId() != null) {
                AttendanceShift s = e.getAttendanceShift() != null ? e.getAttendanceShift() : defaultShift;
                if (s == null || !Objects.equals(s.getId(), f.shiftId())) continue;
            }
            out.add(e);
        }
        return out;
    }

    private Set<Long> enrolledIds(List<Employee> employees) {
        if (employees.isEmpty()) return Set.of();
        return new HashSet<>(biometricRepository.findEnrolledEmployeeIds(employees.stream().map(Employee::getId).toList()));
    }

    /** Stored status, or the virtual status of a day with no row. */
    static String dayStatus(Attendance a, AttendanceShift shift, LocalDate day) {
        if (a != null && a.getStatus() != null && !a.getStatus().isBlank()) return a.getStatus().toUpperCase();
        if (AttendanceShiftCalculator.isWeekOff(shift, day)) return "WEEK_OFF";
        LocalDate today = LocalDate.now();
        if (day.isAfter(today)) return "NOT_MARKED";
        if (day.isEqual(today)) {
            LocalTime cutoff = shift == null ? LocalTime.NOON
                    : shift.getStartTime().plusMinutes(shift.getGracePeriodMinutes() == null ? 0 : shift.getGracePeriodMinutes());
            if (LocalTime.now().isBefore(cutoff)) return "NOT_MARKED"; // shift hasn't (late-)started yet
        }
        return "ABSENT";
    }

    private static boolean matchesStatus(String filter, String status) {
        String f = filter.toUpperCase();
        if ("PRESENT".equals(f)) return Set.of("PRESENT", "LATE", "ON_DUTY", "WORK_FROM_HOME").contains(status);
        return f.equals(status);
    }

    private Map<String, Object> row(Employee e, Attendance a, AttendanceShift shift, String status, boolean enrolled, LocalDate day) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("employeeId", e.getId());
        m.put("employeeCode", e.getEmployeeCode());
        m.put("employeeName", AttendanceDeviceService.fullName(e));
        m.put("designation", e.getDesignation());
        m.put("department", e.getDepartment() == null ? null : e.getDepartment().getName());
        m.put("branch", e.getBranch() == null ? null : e.getBranch().getName());
        m.put("shift", shift == null ? null : shift.getName());
        m.put("status", status);
        m.put("checkIn", a == null ? null : a.getCheckInTime());
        m.put("checkOut", a == null ? null : a.getCheckOutTime());
        m.put("workingMinutes", a == null ? null : liveWorkedMinutes(a, day));
        m.put("lateMinutes", a == null ? null : a.getLateMinutes());
        m.put("earlyDepartureMinutes", a == null ? null : a.getEarlyDepartureMinutes());
        m.put("overtimeMinutes", a == null ? null : a.getOvertimeMinutes());
        m.put("checkInMethod", a == null ? null : a.getCheckInMethod());
        m.put("checkOutMethod", a == null ? null : a.getCheckOutMethod());
        m.put("biometricVerified", a != null && Boolean.TRUE.equals(a.getBiometricVerified()));
        m.put("device", a == null || a.getDevice() == null ? null : a.getDevice().getDeviceName());
        m.put("deviceId", a == null || a.getDevice() == null ? null : a.getDevice().getId());
        m.put("enrolled", enrolled);
        m.put("checkedInNow", a != null && a.getCheckInTime() != null && a.getCheckOutTime() == null);
        m.put("remarks", a == null ? null : a.getRemarks());
        return m;
    }

    /** Stored working minutes, or for a legacy/self-service row the span of its sessions. */
    private int workedMinutes(Attendance a) {
        if (a.getWorkingMinutes() != null) return a.getWorkingMinutes();
        if (a.getCheckInTime() != null && a.getCheckOutTime() != null) {
            return AttendanceShiftCalculator.minutesBetween(a.getCheckInTime(), a.getCheckOutTime());
        }
        return a.getWorkedHours() == null ? 0 : a.getWorkedHours().multiply(java.math.BigDecimal.valueOf(60)).intValue();
    }

    /** Like {@link #workedMinutes} but counts a still-open day up to now (today only). */
    private int liveWorkedMinutes(Attendance a, LocalDate day) {
        if (a.getCheckInTime() != null && a.getCheckOutTime() == null && day.isEqual(LocalDate.now())) {
            return (int) Math.max(0, java.time.Duration.between(day.atTime(a.getCheckInTime()), LocalDateTime.now()).toMinutes());
        }
        return workedMinutes(a);
    }

    private static int statusOrder(String s) {
        return switch (s) {
            case "LATE" -> 0;
            case "PRESENT" -> 1;
            case "HALF_DAY" -> 2;
            case "ABSENT" -> 3;
            case "NOT_MARKED" -> 4;
            case "LEAVE" -> 5;
            default -> 6;
        };
    }

    private static long nz(Integer v) { return v == null ? 0 : v; }
}

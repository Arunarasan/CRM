package com.arudra.crm.service;

import com.arudra.crm.dto.attendance.DeviceApi.PunchRequest;
import com.arudra.crm.dto.attendance.DeviceApi.PunchResponse;
import com.arudra.crm.dto.attendance.DeviceApi.TerminalEmployee;
import com.arudra.crm.dto.attendance.DeviceApi.TodayStatus;
import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.AttendanceDevice;
import com.arudra.crm.entity.AttendancePunch;
import com.arudra.crm.entity.AttendanceSession;
import com.arudra.crm.entity.AttendanceShift;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.repository.AttendanceDeviceRepository;
import com.arudra.crm.repository.AttendancePunchRepository;
import com.arudra.crm.repository.AttendanceRepository;
import com.arudra.crm.repository.AttendanceSessionRepository;
import com.arudra.crm.repository.EmployeeBiometricRepository;
import com.arudra.crm.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The punch engine behind the biometric terminal. The terminal only says "employee X was identified
 * at time T"; everything else is decided here, server-side, never trusted to the client:
 *
 *  1. Idempotency — (device, idempotency key) is unique; a replay returns the stored outcome.
 *  2. Time — online punches use SERVER time. Offline punches use the terminal's server-anchored
 *     monotonic clock; a punch from an unanchored clock is accepted but flagged for HR review, one in
 *     the future or older than the offline window is rejected.
 *  3. Employee — must exist, not be terminated, and (when enforced) belong to the device's branch.
 *  4. State machine per attendance day (employee row is locked, so racing punches serialise):
 *        no attendance → CHECK_IN
 *        checked in    → CHECK_OUT, or ALREADY_CHECKED_IN within the minimum gap after check-in
 *        checked out   → ALREADY_CHECKED_OUT (day completed)
 *  5. Figures — late / early / working / overtime / status from the employee's shift; the existing
 *     payroll aggregate (worked hours, earnings) is recomputed through {@link EmployeeTimeService}.
 *
 * Records go into the same {@code attendance} / {@code attendance_sessions} tables as self-service
 * clock-ins, so payroll, timesheets and corrections keep working unchanged.
 */
@Service
public class DeviceAttendanceService {

    public static final String METHOD_BIOMETRIC_DEVICE = "BIOMETRIC_DEVICE";

    public static final String RESULT_CHECK_IN = "CHECK_IN";
    public static final String RESULT_CHECK_OUT = "CHECK_OUT";
    public static final String RESULT_ALREADY_IN = "ALREADY_CHECKED_IN";
    public static final String RESULT_ALREADY_OUT = "ALREADY_CHECKED_OUT";
    public static final String RESULT_REJECTED = "REJECTED";

    private static final Pattern KEY = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");
    private static final Set<String> ACTIONS = Set.of("AUTO", "CHECK_IN", "CHECK_OUT");
    private static final Set<String> TIME_SOURCES = Set.of("SERVER", "SERVER_ANCHORED", "DEVICE_CLOCK");
    /** Tolerated forward skew of an offline timestamp vs. receipt time. */
    private static final Duration FUTURE_TOLERANCE = Duration.ofMinutes(2);

    private final AttendancePunchRepository punchRepository;
    private final AttendanceRepository attendanceRepository;
    private final AttendanceSessionRepository sessionRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeBiometricRepository biometricRepository;
    private final AttendanceDeviceRepository deviceRepository;
    private final AttendanceShiftService shiftService;
    private final EmployeeTimeService timeService;
    private final AttendanceAuditService audit;
    private final NotificationService notificationService;

    @Value("${app.attendance.device.min-checkout-gap-minutes:15}") private int minCheckoutGapMinutes;
    @Value("${app.attendance.device.max-offline-hours:72}") private int maxOfflineHours;
    @Value("${app.attendance.device.enforce-branch:true}") private boolean enforceBranch;

    public DeviceAttendanceService(AttendancePunchRepository punchRepository, AttendanceRepository attendanceRepository,
                                   AttendanceSessionRepository sessionRepository, EmployeeRepository employeeRepository,
                                   EmployeeBiometricRepository biometricRepository, AttendanceDeviceRepository deviceRepository,
                                   AttendanceShiftService shiftService, EmployeeTimeService timeService,
                                   AttendanceAuditService audit, NotificationService notificationService) {
        this.punchRepository = punchRepository;
        this.attendanceRepository = attendanceRepository;
        this.sessionRepository = sessionRepository;
        this.employeeRepository = employeeRepository;
        this.biometricRepository = biometricRepository;
        this.deviceRepository = deviceRepository;
        this.shiftService = shiftService;
        this.timeService = timeService;
        this.audit = audit;
        this.notificationService = notificationService;
    }

    // =====================================================================================
    // Punch
    // =====================================================================================

    /** Records one punch. Each call is its own transaction (offline sync calls it per record). */
    @Transactional
    public PunchResponse punch(Long deviceId, PunchRequest req) {
        AttendanceDevice device = deviceRepository.findByIdAndIsDeletedFalse(deviceId)
                .orElseThrow(() -> new IllegalStateException("Device not found."));
        if (req == null || req.idempotencyKey() == null || !KEY.matcher(req.idempotencyKey()).matches()) {
            throw new IllegalArgumentException("A valid idempotencyKey (8–64 chars, letters/digits/-/_) is required.");
        }
        String action = req.action() == null ? "AUTO" : req.action().toUpperCase(Locale.ROOT);
        if (!ACTIONS.contains(action)) throw new IllegalArgumentException("action must be AUTO, CHECK_IN or CHECK_OUT.");

        // Resolve (then lock) the employee first: the lock serialises racing punches for the same person,
        // including two deliveries of the same idempotency key, so the replay check below is race-free.
        Long employeeId = resolveEmployeeId(req);
        Employee employee = employeeId == null ? null : employeeRepository.findByIdForUpdate(employeeId).orElse(null);

        AttendancePunch existing = punchRepository.findByDeviceIdAndIdempotencyKey(deviceId, req.idempotencyKey()).orElse(null);
        if (existing != null) return replay(existing);

        LocalDateTime now = LocalDateTime.now().withNano(0);
        boolean offline = Boolean.TRUE.equals(req.offline());
        String timeSource = req.timeSource() == null ? null : req.timeSource().toUpperCase(Locale.ROOT);
        if (timeSource != null && !TIME_SOURCES.contains(timeSource)) timeSource = "DEVICE_CLOCK";

        AttendancePunch p = new AttendancePunch();
        p.setDeviceId(deviceId);
        p.setEmployeeId(employee == null ? null : employee.getId());
        p.setIdempotencyKey(req.idempotencyKey());
        p.setReceivedAt(now);
        p.setRequestedAction(action);
        p.setOffline(offline);
        p.setMatchScore(req.matchScore());
        p.setIdentification(req.identification() == null ? "FINGERPRINT"
                : AttendanceAuditService.truncate(req.identification().toUpperCase(Locale.ROOT), 30));

        // --- time ---------------------------------------------------------------------------
        LocalDateTime punchTime;
        boolean flagged = false;
        String flagReason = null;
        if (!offline || req.capturedAt() == null) {
            punchTime = now;              // online: server time is the only clock we trust
            p.setTimeSource("SERVER");
        } else {
            punchTime = LocalDateTime.ofInstant(Instant.ofEpochMilli(req.capturedAt()), ZoneId.systemDefault()).withNano(0);
            p.setTimeSource(timeSource == null ? "DEVICE_CLOCK" : timeSource);
            if (!"SERVER_ANCHORED".equals(p.getTimeSource())) {
                flagged = true;
                flagReason = "Offline punch with an unverified device clock (terminal restarted while offline).";
            }
        }
        p.setPunchTime(punchTime);

        if (offline && punchTime.isAfter(now.plus(FUTURE_TOLERANCE))) {
            return reject(p, device, employee, "Punch time is in the future — device clock is not trusted.");
        }
        if (offline && punchTime.isBefore(now.minusHours(maxOfflineHours))) {
            return reject(p, device, employee, "Offline punch is older than " + maxOfflineHours + " hours.");
        }

        // --- employee -----------------------------------------------------------------------
        if (employee == null || Boolean.TRUE.equals(employee.getIsDeleted())) {
            return reject(p, device, null, "Employee not found.");
        }
        if ("TERMINATED".equalsIgnoreCase(employee.getStatus())) {
            return reject(p, device, employee, "Employee is not active.");
        }
        if (enforceBranch && employee.getBranch() != null && device.getBranch() != null
                && !Objects.equals(employee.getBranch().getId(), device.getBranch().getId())) {
            return reject(p, device, employee, "Employee belongs to branch " + employee.getBranch().getName()
                    + ", not " + device.getBranch().getName() + ".");
        }
        if (!biometricRepository.existsByEmployeeIdAndStatusAndIsDeletedFalse(employee.getId(), "ACTIVE")) {
            // The terminal matched a template the server no longer recognises (revoked meanwhile).
            return reject(p, device, employee, "No active biometric enrollment for this employee.");
        }

        // --- state machine ------------------------------------------------------------------
        AttendanceShift shift = shiftService.resolve(employee);
        AttendanceShiftCalculator.ShiftSpec spec = AttendanceShiftCalculator.ShiftSpec.of(shift);
        LocalDate date = attendanceDate(employee, spec, punchTime);
        Attendance att = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employee.getId(), date).orElse(null);
        List<AttendanceSession> sessions = att == null ? List.of() : sessionRepository.findByAttendanceIdOrderByIdAsc(att.getId());
        AttendanceSession open = sessions.stream().filter(s -> s.getCheckInTime() != null && s.getCheckOutTime() == null)
                .findFirst().orElse(null);
        boolean anyClosed = sessions.stream().anyMatch(s -> s.getCheckOutTime() != null);

        String outcome;
        if (open != null) {
            LocalDateTime inAt = sessionStart(date, open);
            long sinceIn = Duration.between(inAt, punchTime).toMinutes();
            if ("CHECK_IN".equals(action) || punchTime.isBefore(inAt)
                    || ("AUTO".equals(action) && sinceIn < minCheckoutGapMinutes)) {
                outcome = RESULT_ALREADY_IN;
            } else {
                outcome = RESULT_CHECK_OUT;
            }
        } else if (anyClosed) {
            outcome = RESULT_ALREADY_OUT;
        } else {
            outcome = "CHECK_OUT".equals(action) ? null : RESULT_CHECK_IN;
        }
        if (outcome == null) return reject(p, device, employee, "No check-in found for today — check in first.");

        if (RESULT_CHECK_IN.equals(outcome)) {
            att = checkIn(employee, device, shift, spec, date, att, punchTime, flagged, flagReason);
        } else if (RESULT_CHECK_OUT.equals(outcome)) {
            att = checkOut(employee, device, spec, date, att, open, punchTime, flagged, flagReason);
        }

        p.setEmployeeId(employee.getId());
        p.setAttendanceId(att == null ? null : att.getId());
        p.setResult(outcome);
        p.setFlagged(flagged && (RESULT_CHECK_IN.equals(outcome) || RESULT_CHECK_OUT.equals(outcome)));
        p.setMessage(message(outcome, employee, att));
        punchRepository.save(p);

        if (offline) device.setLastSyncAt(now);
        device.setLastSeenAt(now);
        deviceRepository.save(device);
        if (RESULT_CHECK_IN.equals(outcome) || RESULT_CHECK_OUT.equals(outcome)) {
            audit.deviceEvent(deviceId, outcome, AttendanceDeviceService.fullName(employee) + " at "
                    + punchTime.toLocalTime() + (offline ? " (offline, synced)" : "") + (p.getFlagged() ? " — flagged" : ""),
                    employee.getId());
        }
        if (p.getFlagged()) {
            notificationService.dispatchToAdmins("Attendance needs approval",
                    AttendanceDeviceService.fullName(employee) + ": " + flagReason, "ATTENDANCE", "/workforce/attendance", null);
        }
        return response(p, employee, att, false);
    }

    private Attendance checkIn(Employee employee, AttendanceDevice device, AttendanceShift shift,
                               AttendanceShiftCalculator.ShiftSpec spec, LocalDate date, Attendance att,
                               LocalDateTime punchTime, boolean flagged, String flagReason) {
        if (att == null) {
            att = new Attendance();
            att.setEmployee(employee);
            att.setDate(date);
        }
        int late = AttendanceShiftCalculator.lateMinutes(spec, date, punchTime);
        att.setStatus(late > 0 ? AttendanceShiftCalculator.LATE : AttendanceShiftCalculator.PRESENT);
        att.setAttendanceType(AttendanceShiftCalculator.isWeekOff(shift, date) ? "WEEK_OFF" : "WORKING_DAY");
        att.setDevice(device);
        att.setBranch(device.getBranch());
        att.setLocation(device.getLocation());
        att.setShift(shift);
        att.setBiometricVerified(true);
        att.setCheckInMethod(METHOD_BIOMETRIC_DEVICE);
        att.setLateMinutes(late);
        att.setLocationLabel(device.getLocation() == null ? null : device.getLocation().getName());
        att.setDeviceInfo(device.getDeviceCode());
        att = attendanceRepository.save(att);

        AttendanceSession s = new AttendanceSession();
        s.setAttendance(att);
        s.setCheckInTime(punchTime.toLocalTime().withNano(0));
        s.setDeviceInfo(device.getDeviceCode());
        s.setLocationLabel(att.getLocationLabel());
        s.setOfficeLocation(device.getLocation());
        s.setVerificationMethod("BIOMETRIC");
        s.setVerified(!flagged);
        s.setFlagged(flagged);
        s.setFlagReason(flagged ? flagReason : null);
        s.setApprovalStatus(flagged ? "PENDING" : null);
        sessionRepository.save(s);
        return timeService.recomputeAggregate(att);
    }

    private Attendance checkOut(Employee employee, AttendanceDevice device, AttendanceShiftCalculator.ShiftSpec spec,
                                LocalDate date, Attendance att, AttendanceSession open, LocalDateTime punchTime,
                                boolean flagged, String flagReason) {
        LocalTime outTime = punchTime.toLocalTime().withNano(0);
        if (open.getBreakStart() != null) { // close a break left running in the self-service app
            open.setBreakMinutes(nz(open.getBreakMinutes())
                    + AttendanceShiftCalculator.minutesBetween(open.getBreakStart(), outTime));
            open.setBreakEnd(outTime);
            open.setBreakStart(null);
        }
        open.setCheckOutTime(outTime);
        if (flagged && !Boolean.TRUE.equals(open.getFlagged())) {
            open.setFlagged(true);
            open.setVerified(false);
            open.setFlagReason(flagReason);
            open.setApprovalStatus("PENDING");
        }

        List<AttendanceSession> sessions = sessionRepository.findByAttendanceIdOrderByIdAsc(att.getId());
        int gross = 0;
        for (AttendanceSession s : sessions) {
            LocalTime out = s.getId().equals(open.getId()) ? outTime : s.getCheckOutTime();
            gross += AttendanceShiftCalculator.minutesBetween(s.getCheckInTime(), out);
        }
        LocalDateTime firstIn = sessionStart(date, sessions.get(0));
        AttendanceShiftCalculator.Figures f = AttendanceShiftCalculator.complete(spec, date, firstIn, punchTime, gross);

        // The shift's unpaid break is deducted from payable hours unless breaks were clocked explicitly.
        int recordedBreaks = sessions.stream().mapToInt(s -> nz(s.getBreakMinutes())).sum();
        if (f.unpaidBreakMinutes() > recordedBreaks) {
            open.setBreakMinutes(nz(open.getBreakMinutes()) + (f.unpaidBreakMinutes() - recordedBreaks));
        }
        sessionRepository.save(open);

        att.setCheckOutMethod(METHOD_BIOMETRIC_DEVICE);
        att.setBiometricVerified(METHOD_BIOMETRIC_DEVICE.equals(att.getCheckInMethod()));
        att.setWorkingMinutes(f.workingMinutes());
        att.setLateMinutes(f.lateMinutes());
        att.setEarlyDepartureMinutes(f.earlyDepartureMinutes());
        att.setOvertimeMinutes(f.overtimeMinutes());
        att.setStatus(f.status());
        if (att.getDevice() == null) att.setDevice(device);
        return timeService.recomputeAggregate(att);
    }

    /**
     * The attendance day a punch belongs to. For an overnight shift, an early-morning punch while
     * yesterday's check-in is still open closes yesterday's day.
     */
    private LocalDate attendanceDate(Employee employee, AttendanceShiftCalculator.ShiftSpec spec, LocalDateTime punchTime) {
        LocalDate today = punchTime.toLocalDate();
        if (spec == null || !spec.overnight()) return today;
        LocalDate yesterday = today.minusDays(1);
        if (punchTime.isAfter(spec.endOn(yesterday).plusHours(6))) return today;
        Attendance prev = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employee.getId(), yesterday).orElse(null);
        if (prev == null) return today;
        boolean openPrev = sessionRepository.findByAttendanceIdOrderByIdAsc(prev.getId()).stream()
                .anyMatch(s -> s.getCheckInTime() != null && s.getCheckOutTime() == null);
        return openPrev ? yesterday : today;
    }

    /** Check-in instant of a session on its attendance day (a check-in time before noon on an
     *  overnight day that started the previous evening is not a case: sessions start on their day). */
    private static LocalDateTime sessionStart(LocalDate date, AttendanceSession s) {
        return date.atTime(s.getCheckInTime());
    }

    private PunchResponse reject(AttendancePunch p, AttendanceDevice device, Employee employee, String reason) {
        p.setResult(RESULT_REJECTED);
        p.setMessage(AttendanceAuditService.truncate(reason, 255));
        p.setFlagged(false);
        punchRepository.save(p);
        audit.deviceEvent(device.getId(), "PUNCH_REJECTED",
                (employee == null ? "Unknown employee" : AttendanceDeviceService.fullName(employee)) + ": " + reason,
                employee == null ? null : employee.getId());
        return response(p, employee, null, false);
    }

    private PunchResponse replay(AttendancePunch p) {
        Employee e = p.getEmployeeId() == null ? null : employeeRepository.findById(p.getEmployeeId()).orElse(null);
        Attendance att = p.getAttendanceId() == null ? null : attendanceRepository.findById(p.getAttendanceId()).orElse(null);
        return response(p, e, att, true);
    }

    private PunchResponse response(AttendancePunch p, Employee e, Attendance att, boolean duplicate) {
        boolean accepted = !RESULT_REJECTED.equals(p.getResult());
        return new PunchResponse(p.getResult(), p.getMessage(), accepted, duplicate, Boolean.TRUE.equals(p.getFlagged()),
                e == null ? null : e.getId(), e == null ? null : e.getEmployeeCode(),
                e == null ? null : AttendanceDeviceService.fullName(e),
                att == null ? null : att.getDate(),
                att == null ? null : att.getCheckInTime(), att == null ? null : att.getCheckOutTime(),
                att == null ? null : att.getWorkingMinutes(), att == null ? null : att.getLateMinutes(),
                att == null ? null : att.getOvertimeMinutes(), att == null ? null : att.getStatus(),
                p.getPunchTime(), p.getIdempotencyKey());
    }

    private static String message(String outcome, Employee e, Attendance att) {
        return switch (outcome) {
            case RESULT_CHECK_IN -> "Check-in successful";
            case RESULT_CHECK_OUT -> "Check-out successful";
            case RESULT_ALREADY_IN -> "Already checked in"
                    + (att != null && att.getCheckInTime() != null ? " at " + att.getCheckInTime().withSecond(0) : "");
            case RESULT_ALREADY_OUT -> "Attendance already completed for today";
            default -> outcome;
        };
    }

    // =====================================================================================
    // Terminal lookups
    // =====================================================================================

    private Long resolveEmployeeId(PunchRequest req) {
        if (req.employeeId() != null) return req.employeeId();
        if (req.employeeCode() != null && !req.employeeCode().isBlank()) {
            return employeeRepository.findFirstByEmployeeCodeIgnoreCaseAndIsDeletedFalse(req.employeeCode().trim())
                    .map(Employee::getId).orElse(null);
        }
        return null;
    }

    /** Employee by ID typed on the terminal — name + enrolled flag only (minimal PII). */
    @Transactional(readOnly = true)
    public TerminalEmployee lookup(Long deviceId, String code) {
        if (code == null || code.isBlank()) throw new IllegalArgumentException("Enter an employee ID.");
        Employee e = employeeRepository.findFirstByEmployeeCodeIgnoreCaseAndIsDeletedFalse(code.trim())
                .filter(x -> !"TERMINATED".equalsIgnoreCase(x.getStatus()))
                .orElseThrow(() -> new com.arudra.crm.exception.ResourceNotFoundException("No employee with ID " + code.trim() + "."));
        AttendanceDevice d = deviceRepository.findByIdAndIsDeletedFalse(deviceId).orElseThrow();
        if (enforceBranch && e.getBranch() != null && d.getBranch() != null
                && !Objects.equals(e.getBranch().getId(), d.getBranch().getId())) {
            throw new IllegalStateException("Employee " + e.getEmployeeCode() + " belongs to another branch.");
        }
        return new TerminalEmployee(e.getId(), e.getEmployeeCode(), AttendanceDeviceService.fullName(e),
                biometricRepository.existsByEmployeeIdAndStatusAndIsDeletedFalse(e.getId(), "ACTIVE"));
    }

    /** Employees this terminal may record (its branch + employees with no branch), for "select employee". */
    @Transactional(readOnly = true)
    public List<TerminalEmployee> roster(Long deviceId) {
        AttendanceDevice d = deviceRepository.findByIdAndIsDeletedFalse(deviceId).orElseThrow();
        Long branchId = d.getBranch() == null ? null : d.getBranch().getId();
        List<Employee> all = employeeRepository.findActiveForAttendance().stream()
                .filter(e -> !enforceBranch || branchId == null || e.getBranch() == null
                        || Objects.equals(e.getBranch().getId(), branchId))
                .toList();
        Set<Long> enrolled = new HashSet<>(all.isEmpty() ? List.of()
                : biometricRepository.findEnrolledEmployeeIds(all.stream().map(Employee::getId).toList()));
        return all.stream().map(e -> new TerminalEmployee(e.getId(), e.getEmployeeCode(),
                AttendanceDeviceService.fullName(e), enrolled.contains(e.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public TodayStatus today(Long employeeId) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new com.arudra.crm.exception.ResourceNotFoundException("Employee not found."));
        Attendance att = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, LocalDate.now()).orElse(null);
        String state = "NOT_CHECKED_IN";
        if (att != null) {
            List<AttendanceSession> sessions = sessionRepository.findByAttendanceIdOrderByIdAsc(att.getId());
            if (sessions.stream().anyMatch(s -> s.getCheckInTime() != null && s.getCheckOutTime() == null)) state = "CHECKED_IN";
            else if (!sessions.isEmpty()) state = "CHECKED_OUT";
        }
        return new TodayStatus(e.getId(), AttendanceDeviceService.fullName(e), state,
                att == null ? null : att.getCheckInTime(), att == null ? null : att.getCheckOutTime(),
                att == null ? null : att.getWorkingMinutes(), att == null ? null : att.getStatus());
    }

    private static int nz(Integer v) { return v == null ? 0 : v; }
}

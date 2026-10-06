package com.arudra.crm.service;

import com.arudra.crm.dto.attendance.DeviceApi.EnrollmentCompleteRequest;
import com.arudra.crm.dto.attendance.DeviceApi.PendingEnrollment;
import com.arudra.crm.dto.attendance.DeviceApi.TerminalEnrollment;
import com.arudra.crm.entity.AttendanceDevice;
import com.arudra.crm.entity.AttendanceDeviceStatus;
import com.arudra.crm.entity.BiometricEnrollmentSession;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeBiometric;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.AttendanceDeviceRepository;
import com.arudra.crm.repository.BiometricEnrollmentSessionRepository;
import com.arudra.crm.repository.EmployeeBiometricRepository;
import com.arudra.crm.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Employee biometric enrollment — reference data only.
 *
 * Privacy model: the fingerprint image and template never reach the CRM. The scanner SDK on the
 * terminal extracts the template, the terminal stores it encrypted under a hardware-backed key and
 * matches locally; the server keeps an {@link EmployeeBiometric} row recording that terminal X holds a
 * template for employee Y under opaque handle Z. Deleting an enrollment revokes the row; the terminal
 * wipes the local template on its next enrollment sync (driven by {@link #enrollmentsRevision}).
 *
 * Enrollment is always admin-initiated: the admin opens a {@link BiometricEnrollmentSession} for one
 * employee on one ACTIVE terminal; only that terminal can complete it, and only before it expires.
 */
@Service
public class BiometricService {

    public static final Set<String> FINGERS = Set.of(
            "RIGHT_THUMB", "RIGHT_INDEX", "RIGHT_MIDDLE", "RIGHT_RING", "RIGHT_LITTLE",
            "LEFT_THUMB", "LEFT_INDEX", "LEFT_MIDDLE", "LEFT_RING", "LEFT_LITTLE");
    private static final Set<String> OPEN = Set.of(BiometricEnrollmentSession.PENDING, BiometricEnrollmentSession.IN_PROGRESS);
    private static final Pattern TEMPLATE_REF = Pattern.compile("^[A-Za-z0-9._:-]{8,128}$");
    private static final Pattern PROVIDER = Pattern.compile("^[A-Za-z0-9._:-]{2,60}$");

    private final EmployeeBiometricRepository biometricRepository;
    private final BiometricEnrollmentSessionRepository sessionRepository;
    private final EmployeeRepository employeeRepository;
    private final AttendanceDeviceRepository deviceRepository;
    private final AttendanceAuditService audit;

    @Value("${app.attendance.device.enrollment-ttl-minutes:10}") private int enrollmentTtlMinutes;

    public BiometricService(EmployeeBiometricRepository biometricRepository,
                            BiometricEnrollmentSessionRepository sessionRepository,
                            EmployeeRepository employeeRepository,
                            AttendanceDeviceRepository deviceRepository,
                            AttendanceAuditService audit) {
        this.biometricRepository = biometricRepository;
        this.sessionRepository = sessionRepository;
        this.employeeRepository = employeeRepository;
        this.deviceRepository = deviceRepository;
        this.audit = audit;
    }

    // =====================================================================================
    // Admin
    // =====================================================================================

    @Transactional(readOnly = true)
    public Map<String, Object> status(Long employeeId) {
        Employee e = requireEmployee(employeeId);
        List<Map<String, Object>> enrollments = biometricRepository.findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(employeeId)
                .stream().map(this::enrollmentView).toList();
        List<Map<String, Object>> sessions = sessionRepository.findTop10ByEmployeeIdOrderByIdDesc(employeeId)
                .stream().map(this::sessionView).toList();
        List<Map<String, Object>> devices = deviceRepository.findByStatusAndIsDeletedFalse(AttendanceDeviceStatus.ACTIVE)
                .stream().filter(d -> d.getDeviceUuid() != null)
                .map(d -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", d.getId());
                    m.put("deviceName", d.getDeviceName());
                    m.put("deviceCode", d.getDeviceCode());
                    m.put("branchName", d.getBranch() == null ? null : d.getBranch().getName());
                    m.put("scannerStatus", d.getScannerStatus());
                    m.put("lastSeenAt", d.getLastSeenAt());
                    return m;
                }).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("employeeId", e.getId());
        out.put("employeeCode", e.getEmployeeCode());
        out.put("employeeName", AttendanceDeviceService.fullName(e));
        out.put("enrolled", enrollments.stream().anyMatch(m -> EmployeeBiometric.ACTIVE.equals(m.get("status"))));
        out.put("enrollments", enrollments);
        out.put("sessions", sessions);
        out.put("devices", devices);
        out.put("branchId", e.getBranch() == null ? null : e.getBranch().getId());
        out.put("branchName", e.getBranch() == null ? null : e.getBranch().getName());
        out.put("shiftId", e.getAttendanceShift() == null ? null : e.getAttendanceShift().getId());
        out.put("shiftName", e.getAttendanceShift() == null ? null : e.getAttendanceShift().getName());
        out.put("attendanceRequired", e.getAttendanceRequired());
        return out;
    }

    @Transactional
    public Map<String, Object> startEnrollment(Long employeeId, Long deviceId, String fingerPosition) {
        Employee e = requireEmployee(employeeId);
        if ("TERMINATED".equalsIgnoreCase(e.getStatus())) throw new IllegalStateException("Employee is terminated.");
        AttendanceDevice d = deviceRepository.findByIdAndIsDeletedFalse(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Select an attendance device."));
        if (!AttendanceDeviceStatus.ACTIVE.equals(d.getStatus()) || d.getDeviceUuid() == null) {
            throw new IllegalStateException("Enrollment needs an active, paired attendance device.");
        }
        String finger = normalizeFinger(fingerPosition);

        // One open enrollment per employee: a new request supersedes any earlier one.
        for (BiometricEnrollmentSession s : sessionRepository.findByEmployeeIdAndStatusIn(employeeId, OPEN)) {
            s.setStatus(BiometricEnrollmentSession.CANCELLED);
            s.setFailureReason("Superseded by a new enrollment request");
            sessionRepository.save(s);
        }
        BiometricEnrollmentSession s = new BiometricEnrollmentSession();
        s.setEmployee(e);
        s.setDevice(d);
        s.setFingerPosition(finger);
        s.setStatus(BiometricEnrollmentSession.PENDING);
        s.setRequestedBy(audit.actor());
        s.setExpiresAt(LocalDateTime.now().plusMinutes(enrollmentTtlMinutes));
        s = sessionRepository.save(s);

        audit.deviceEvent(d.getId(), "ENROLLMENT_REQUESTED",
                "Enrollment requested for " + AttendanceDeviceService.fullName(e) + " (" + finger + ")", e.getId());
        audit.audit(AttendanceAuditService.MODULE_BIOMETRIC, "ENROLLMENT_STARTED", e.getId(), e.getEmployeeCode(),
                "Biometric enrollment started for " + AttendanceDeviceService.fullName(e) + " on " + d.getDeviceName()
                        + " (" + finger + ")");
        return sessionView(s);
    }

    @Transactional
    public Map<String, Object> session(Long sessionId) {
        BiometricEnrollmentSession s = requireSession(sessionId);
        expireIfDue(s);
        return sessionView(s);
    }

    @Transactional
    public Map<String, Object> cancelSession(Long sessionId) {
        BiometricEnrollmentSession s = requireSession(sessionId);
        if (s.isOpen()) {
            s.setStatus(BiometricEnrollmentSession.CANCELLED);
            s.setFailureReason("Cancelled by " + audit.actor());
            sessionRepository.save(s);
            audit.audit(AttendanceAuditService.MODULE_BIOMETRIC, "ENROLLMENT_CANCELLED", s.getEmployee().getId(),
                    s.getEmployee().getEmployeeCode(), "Biometric enrollment cancelled");
        }
        return sessionView(s);
    }

    /** Revokes every active enrollment of an employee (DELETE /biometric/{employeeId}). */
    @Transactional
    public int revokeEmployee(Long employeeId, String reason) {
        Employee e = requireEmployee(employeeId);
        List<EmployeeBiometric> active = biometricRepository.findByEmployeeIdAndStatusAndIsDeletedFalse(employeeId, EmployeeBiometric.ACTIVE);
        for (EmployeeBiometric b : active) revoke(b);
        for (BiometricEnrollmentSession s : sessionRepository.findByEmployeeIdAndStatusIn(employeeId, OPEN)) {
            s.setStatus(BiometricEnrollmentSession.CANCELLED);
            s.setFailureReason("Biometrics removed");
            sessionRepository.save(s);
        }
        audit.audit(AttendanceAuditService.MODULE_BIOMETRIC, "BIOMETRIC_REVOKED", e.getId(), e.getEmployeeCode(),
                "Removed " + active.size() + " biometric enrollment(s) for " + AttendanceDeviceService.fullName(e)
                        + (reason == null || reason.isBlank() ? "" : " — " + reason));
        return active.size();
    }

    @Transactional
    public void revokeEnrollment(Long biometricId) {
        EmployeeBiometric b = biometricRepository.findById(biometricId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found."));
        if (!EmployeeBiometric.ACTIVE.equals(b.getStatus())) return;
        revoke(b);
        audit.audit(AttendanceAuditService.MODULE_BIOMETRIC, "BIOMETRIC_REVOKED", b.getEmployee().getId(),
                b.getEmployee().getEmployeeCode(), "Removed " + b.getFingerPosition() + " enrollment of "
                        + AttendanceDeviceService.fullName(b.getEmployee()));
    }

    /** Used when a device is revoked/deleted: its templates are no longer trusted. */
    @Transactional
    public int revokeAllOnDevice(AttendanceDevice device, String reason) {
        if (device.getId() == null) return 0;
        List<EmployeeBiometric> rows = biometricRepository.findByDeviceIdAndStatusAndIsDeletedFalse(device.getId(), EmployeeBiometric.ACTIVE);
        for (EmployeeBiometric b : rows) revoke(b);
        if (!rows.isEmpty()) {
            audit.audit(AttendanceAuditService.MODULE_BIOMETRIC, "BIOMETRIC_REVOKED", device.getId(), device.getDeviceCode(),
                    rows.size() + " enrollment(s) revoked: " + reason);
        }
        return rows.size();
    }

    // =====================================================================================
    // Terminal
    // =====================================================================================

    @Transactional
    public PendingEnrollment nextPendingEnrollment(Long deviceId) {
        for (BiometricEnrollmentSession s : sessionRepository.findByDeviceIdAndStatusInOrderByIdAsc(deviceId, OPEN)) {
            if (expireIfDue(s)) continue;
            Employee e = s.getEmployee();
            return new PendingEnrollment(s.getId(), e.getId(), e.getEmployeeCode(), AttendanceDeviceService.fullName(e),
                    s.getFingerPosition(), s.getStatus(), s.getExpiresAt());
        }
        return null;
    }

    @Transactional
    public PendingEnrollment markStarted(Long deviceId, Long sessionId) {
        BiometricEnrollmentSession s = requireDeviceSession(deviceId, sessionId);
        s.setStatus(BiometricEnrollmentSession.IN_PROGRESS);
        sessionRepository.save(s);
        Employee e = s.getEmployee();
        return new PendingEnrollment(s.getId(), e.getId(), e.getEmployeeCode(), AttendanceDeviceService.fullName(e),
                s.getFingerPosition(), s.getStatus(), s.getExpiresAt());
    }

    @Transactional
    public TerminalEnrollment complete(Long deviceId, Long sessionId, EnrollmentCompleteRequest req) {
        BiometricEnrollmentSession s = requireDeviceSession(deviceId, sessionId);
        if (req == null || req.templateRef() == null || !TEMPLATE_REF.matcher(req.templateRef()).matches()) {
            throw new IllegalArgumentException("A valid template reference is required.");
        }
        if (req.provider() == null || !PROVIDER.matcher(req.provider()).matches()) {
            throw new IllegalArgumentException("A valid biometric provider id is required.");
        }
        Employee e = s.getEmployee();
        String finger = req.fingerPosition() == null ? s.getFingerPosition() : normalizeFinger(req.fingerPosition());

        // Re-enrolling the same finger on the same terminal replaces the previous reference.
        for (EmployeeBiometric old : biometricRepository.findByEmployeeIdAndStatusAndIsDeletedFalse(e.getId(), EmployeeBiometric.ACTIVE)) {
            if (old.getDevice() != null && Objects.equals(old.getDevice().getId(), deviceId)
                    && Objects.equals(old.getFingerPosition(), finger)) {
                revoke(old);
            }
        }
        EmployeeBiometric b = new EmployeeBiometric();
        b.setEmployee(e);
        b.setDevice(s.getDevice());
        b.setProvider(req.provider());
        b.setTemplateRef(req.templateRef());
        b.setFingerPosition(finger);
        b.setQualityScore(req.qualityScore() == null ? null : Math.max(0, Math.min(100, req.qualityScore())));
        b.setStatus(EmployeeBiometric.ACTIVE);
        b.setEnrolledBy(s.getRequestedBy());
        b.setEnrolledAt(LocalDateTime.now());
        b = biometricRepository.save(b);

        s.setStatus(BiometricEnrollmentSession.COMPLETED);
        s.setCompletedAt(LocalDateTime.now());
        s.setBiometricId(b.getId());
        sessionRepository.save(s);

        audit.deviceEvent(deviceId, "ENROLLED", AttendanceDeviceService.fullName(e) + " enrolled (" + finger
                + (b.getQualityScore() == null ? "" : ", quality " + b.getQualityScore()) + ")", e.getId());
        audit.audit(AttendanceAuditService.MODULE_BIOMETRIC, "BIOMETRIC_ENROLLED", e.getId(), e.getEmployeeCode(),
                "Biometric enrolled for " + AttendanceDeviceService.fullName(e) + " on " + s.getDevice().getDeviceName()
                        + " (" + finger + ", provider " + req.provider() + ")");
        return terminalView(b);
    }

    @Transactional
    public void fail(Long deviceId, Long sessionId, String reason) {
        BiometricEnrollmentSession s = requireDeviceSession(deviceId, sessionId);
        String r = reason == null || reason.isBlank() ? "Enrollment failed on the device" : AttendanceAuditService.truncate(reason.trim(), 255);
        s.setStatus(BiometricEnrollmentSession.FAILED);
        s.setFailureReason(r);
        sessionRepository.save(s);
        audit.deviceEvent(deviceId, "ENROLLMENT_FAILED", AttendanceDeviceService.fullName(s.getEmployee()) + ": " + r,
                s.getEmployee().getId());
        audit.audit(AttendanceAuditService.MODULE_BIOMETRIC, "ENROLLMENT_FAILED", s.getEmployee().getId(),
                s.getEmployee().getEmployeeCode(), "Biometric enrollment failed: " + r);
    }

    /** Authoritative list of templates this terminal should hold; anything else it must delete. */
    @Transactional(readOnly = true)
    public List<TerminalEnrollment> terminalEnrollments(Long deviceId) {
        return biometricRepository.findByDeviceIdAndStatusAndIsDeletedFalse(deviceId, EmployeeBiometric.ACTIVE)
                .stream().filter(b -> !"TERMINATED".equalsIgnoreCase(b.getEmployee().getStatus())
                        && !Boolean.TRUE.equals(b.getEmployee().getIsDeleted()))
                .map(this::terminalView).toList();
    }

    /** Changes whenever the device's enrollment set changes, so the terminal knows to re-sync. */
    @Transactional(readOnly = true)
    public String enrollmentsRevision(Long deviceId) {
        StringBuilder sb = new StringBuilder();
        for (TerminalEnrollment t : terminalEnrollments(deviceId)) {
            sb.append(t.biometricId()).append(':').append(t.templateRef()).append(';');
        }
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h, 0, 12);
        } catch (Exception ex) {
            return Integer.toHexString(sb.toString().hashCode());
        }
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 120_000)
    @Transactional
    public void expireStaleSessions() {
        for (AttendanceDevice d : deviceRepository.findByStatusAndIsDeletedFalse(AttendanceDeviceStatus.ACTIVE)) {
            sessionRepository.findByDeviceIdAndStatusInOrderByIdAsc(d.getId(), OPEN).forEach(this::expireIfDue);
        }
    }

    // =====================================================================================
    // helpers
    // =====================================================================================

    private void revoke(EmployeeBiometric b) {
        b.setStatus(EmployeeBiometric.REVOKED);
        b.setRevokedBy(audit.actor());
        b.setRevokedAt(LocalDateTime.now());
        biometricRepository.save(b);
        if (b.getDevice() != null) {
            audit.deviceEvent(b.getDevice().getId(), "ENROLLMENT_REVOKED",
                    AttendanceDeviceService.fullName(b.getEmployee()) + " (" + b.getFingerPosition() + ") removed",
                    b.getEmployee().getId());
        }
    }

    private boolean expireIfDue(BiometricEnrollmentSession s) {
        if (s.isOpen() && s.getExpiresAt().isBefore(LocalDateTime.now())) {
            s.setStatus(BiometricEnrollmentSession.EXPIRED);
            s.setFailureReason("Not completed on the device in time");
            sessionRepository.save(s);
            return true;
        }
        return false;
    }

    private BiometricEnrollmentSession requireSession(Long id) {
        return sessionRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Enrollment session not found."));
    }

    /** A terminal may only act on an open, unexpired session addressed to itself. */
    private BiometricEnrollmentSession requireDeviceSession(Long deviceId, Long sessionId) {
        BiometricEnrollmentSession s = requireSession(sessionId);
        if (!Objects.equals(s.getDevice().getId(), deviceId)) {
            throw new ResourceNotFoundException("Enrollment session not found.");
        }
        if (expireIfDue(s) || !s.isOpen()) {
            throw new IllegalStateException("This enrollment is no longer open (" + s.getStatus().toLowerCase(Locale.ROOT) + ").");
        }
        return s;
    }

    private Employee requireEmployee(Long id) {
        return employeeRepository.findById(id).filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found: " + id));
    }

    static String normalizeFinger(String f) {
        String v = f == null || f.isBlank() ? "RIGHT_INDEX" : f.trim().toUpperCase(Locale.ROOT);
        if (!FINGERS.contains(v)) throw new IllegalArgumentException("Unknown finger position: " + f);
        return v;
    }

    private TerminalEnrollment terminalView(EmployeeBiometric b) {
        Employee e = b.getEmployee();
        return new TerminalEnrollment(b.getId(), e.getId(), e.getEmployeeCode(), AttendanceDeviceService.fullName(e),
                b.getTemplateRef(), b.getFingerPosition());
    }

    private Map<String, Object> enrollmentView(EmployeeBiometric b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("status", b.getStatus());
        m.put("fingerPosition", b.getFingerPosition());
        m.put("qualityScore", b.getQualityScore());
        m.put("provider", b.getProvider());
        m.put("deviceId", b.getDevice() == null ? null : b.getDevice().getId());
        m.put("deviceName", b.getDevice() == null ? null : b.getDevice().getDeviceName());
        m.put("enrolledBy", b.getEnrolledBy());
        m.put("enrolledAt", b.getEnrolledAt());
        m.put("revokedBy", b.getRevokedBy());
        m.put("revokedAt", b.getRevokedAt());
        return m;
    }

    private Map<String, Object> sessionView(BiometricEnrollmentSession s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("employeeId", s.getEmployee().getId());
        m.put("deviceId", s.getDevice().getId());
        m.put("deviceName", s.getDevice().getDeviceName());
        m.put("fingerPosition", s.getFingerPosition());
        m.put("status", s.getStatus());
        m.put("requestedBy", s.getRequestedBy());
        m.put("createdAt", s.getCreatedAt());
        m.put("expiresAt", s.getExpiresAt());
        m.put("completedAt", s.getCompletedAt());
        m.put("failureReason", s.getFailureReason());
        return m;
    }
}

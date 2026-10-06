package com.arudra.crm.controller;

import com.arudra.crm.dto.attendance.DeviceApi.*;
import com.arudra.crm.security.DevicePrincipal;
import com.arudra.crm.service.AttendanceAuditService;
import com.arudra.crm.service.AttendanceDeviceService;
import com.arudra.crm.service.BiometricService;
import com.arudra.crm.service.DeviceAttendanceService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * API used by the Android attendance terminal.
 *
 * Open (approval-gated, rate-limited):
 *   GET  /api/device/register/options   branches + attendance locations for the registration screen
 *   POST /api/device/register           registration request, or pairing with an admin code
 *   POST /api/device/register/status    poll own registration; receives the device secret once approved
 *   POST /api/device/auth/token         exchange device secret → short-lived device token
 *
 * Device token required ({@code Authorization: Device <token>}, see DeviceAuthenticationFilter):
 *   POST /api/device/heartbeat, GET /api/device/employees[/lookup], POST /api/device/attendance/punch|check-in|check-out|sync,
 *   GET /api/device/attendance/today, enrollment session + enrollment-sync endpoints.
 */
@RestController
@RequestMapping("/api/device")
public class DeviceTerminalController {

    private static final Logger log = LoggerFactory.getLogger(DeviceTerminalController.class);
    private static final int MAX_SYNC_BATCH = 200;

    private final AttendanceDeviceService deviceService;
    private final DeviceAttendanceService attendanceService;
    private final BiometricService biometricService;

    public DeviceTerminalController(AttendanceDeviceService deviceService, DeviceAttendanceService attendanceService,
                                    BiometricService biometricService) {
        this.deviceService = deviceService;
        this.attendanceService = attendanceService;
        this.biometricService = biometricService;
    }

    // --- registration + auth ----------------------------------------------------------------

    @GetMapping("/register/options")
    public RegistrationOptions registrationOptions(HttpServletRequest http) {
        return deviceService.registrationOptions(AttendanceAuditService.clientIp(http));
    }

    @PostMapping("/register")
    public RegisterResponse register(@RequestBody RegisterRequest req, HttpServletRequest http) {
        return deviceService.register(req, AttendanceAuditService.clientIp(http));
    }

    @PostMapping("/register/status")
    public RegistrationStatusResponse registrationStatus(@RequestBody RegistrationStatusRequest req, HttpServletRequest http) {
        return deviceService.registrationStatus(req, AttendanceAuditService.clientIp(http));
    }

    @PostMapping("/auth/token")
    public TokenResponse token(@RequestBody TokenRequest req, HttpServletRequest http) {
        return deviceService.exchangeToken(req, AttendanceAuditService.clientIp(http));
    }

    // --- health -----------------------------------------------------------------------------

    @PostMapping("/heartbeat")
    public HeartbeatResponse heartbeat(@AuthenticationPrincipal DevicePrincipal device,
                                       @RequestBody(required = false) HeartbeatRequest req, HttpServletRequest http) {
        return deviceService.heartbeat(device, req, AttendanceAuditService.clientIp(http));
    }

    // --- employees --------------------------------------------------------------------------

    @GetMapping("/employees")
    public List<TerminalEmployee> roster(@AuthenticationPrincipal DevicePrincipal device) {
        return attendanceService.roster(device.deviceId());
    }

    @GetMapping("/employees/lookup")
    public TerminalEmployee lookup(@AuthenticationPrincipal DevicePrincipal device, @RequestParam String code) {
        return attendanceService.lookup(device.deviceId(), code);
    }

    // --- attendance -------------------------------------------------------------------------

    /** Check-in or check-out, decided by the server from today's state. */
    @PostMapping("/attendance/punch")
    public PunchResponse punch(@AuthenticationPrincipal DevicePrincipal device, @RequestBody PunchRequest req) {
        return attendanceService.punch(device.deviceId(), withAction(req, req.action()));
    }

    @PostMapping("/attendance/check-in")
    public PunchResponse checkIn(@AuthenticationPrincipal DevicePrincipal device, @RequestBody PunchRequest req) {
        return attendanceService.punch(device.deviceId(), withAction(req, "CHECK_IN"));
    }

    @PostMapping("/attendance/check-out")
    public PunchResponse checkOut(@AuthenticationPrincipal DevicePrincipal device, @RequestBody PunchRequest req) {
        return attendanceService.punch(device.deviceId(), withAction(req, "CHECK_OUT"));
    }

    /**
     * Offline queue upload. Records are applied oldest-first, each in its own transaction, so one bad
     * record never blocks the rest; every record gets a result (the terminal deletes accepted and
     * rejected ones, and retries only transport failures).
     */
    @PostMapping("/attendance/sync")
    public SyncResponse sync(@AuthenticationPrincipal DevicePrincipal device, @RequestBody SyncRequest req) {
        List<PunchRequest> punches = req == null || req.punches() == null ? List.of() : new ArrayList<>(req.punches());
        if (punches.size() > MAX_SYNC_BATCH) {
            throw new IllegalArgumentException("At most " + MAX_SYNC_BATCH + " punches per sync request.");
        }
        punches.sort(Comparator.comparing(p -> p.capturedAt() == null ? Long.MAX_VALUE : p.capturedAt()));
        List<PunchResponse> results = new ArrayList<>(punches.size());
        for (PunchRequest p : punches) {
            PunchRequest offline = new PunchRequest(p.employeeId(), p.employeeCode(), p.idempotencyKey(), p.capturedAt(),
                    p.timeSource(), true, p.matchScore(), p.identification(), p.action());
            try {
                results.add(attendanceService.punch(device.deviceId(), offline));
            } catch (IllegalArgumentException | IllegalStateException e) {
                results.add(new PunchResponse("REJECTED", e.getMessage(), false, false, false, p.employeeId(),
                        p.employeeCode(), null, null, null, null, null, null, null, null, null, p.idempotencyKey()));
            } catch (Exception e) {
                // Unexpected server fault: report as retryable (not accepted, not rejected) so the
                // terminal keeps the record and tries again later.
                log.error("Sync of punch {} from device {} failed", p.idempotencyKey(), device.deviceCode(), e);
                results.add(new PunchResponse("RETRY", "Temporary server error", false, false, false, p.employeeId(),
                        p.employeeCode(), null, null, null, null, null, null, null, null, null, p.idempotencyKey()));
            }
        }
        return new SyncResponse(results, System.currentTimeMillis());
    }

    @GetMapping("/attendance/today")
    public TodayStatus today(@RequestParam Long employeeId) {
        return attendanceService.today(employeeId);
    }

    // --- biometric enrollment ---------------------------------------------------------------

    @GetMapping("/biometric/enrollments")
    public List<TerminalEnrollment> enrollments(@AuthenticationPrincipal DevicePrincipal device) {
        return biometricService.terminalEnrollments(device.deviceId());
    }

    @GetMapping("/biometric/sessions/pending")
    public ResponseEntity<PendingEnrollment> pendingSession(@AuthenticationPrincipal DevicePrincipal device) {
        PendingEnrollment p = biometricService.nextPendingEnrollment(device.deviceId());
        return p == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(p);
    }

    @PostMapping("/biometric/sessions/{id}/start")
    public PendingEnrollment startSession(@AuthenticationPrincipal DevicePrincipal device, @PathVariable Long id) {
        return biometricService.markStarted(device.deviceId(), id);
    }

    @PostMapping("/biometric/sessions/{id}/complete")
    public TerminalEnrollment completeSession(@AuthenticationPrincipal DevicePrincipal device, @PathVariable Long id,
                                              @RequestBody EnrollmentCompleteRequest req) {
        return biometricService.complete(device.deviceId(), id, req);
    }

    @PostMapping("/biometric/sessions/{id}/fail")
    public ResponseEntity<Void> failSession(@AuthenticationPrincipal DevicePrincipal device, @PathVariable Long id,
                                            @RequestBody(required = false) EnrollmentFailRequest req) {
        biometricService.fail(device.deviceId(), id, req == null ? null : req.reason());
        return ResponseEntity.noContent().build();
    }

    private static PunchRequest withAction(PunchRequest r, String action) {
        if (r == null) throw new IllegalArgumentException("Request body is required.");
        return new PunchRequest(r.employeeId(), r.employeeCode(), r.idempotencyKey(), r.capturedAt(), r.timeSource(),
                r.offline(), r.matchScore(), r.identification(), action);
    }
}

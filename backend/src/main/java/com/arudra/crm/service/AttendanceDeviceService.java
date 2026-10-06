package com.arudra.crm.service;

import com.arudra.crm.dto.attendance.DeviceApi.*;
import com.arudra.crm.entity.AttendanceDevice;
import com.arudra.crm.entity.AttendanceDeviceEvent;
import com.arudra.crm.entity.AttendanceDeviceStatus;
import com.arudra.crm.entity.AttendanceLocation;
import com.arudra.crm.entity.Branch;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.exception.DeviceAccessException;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.AttendanceDeviceEventRepository;
import com.arudra.crm.repository.AttendanceDeviceRepository;
import com.arudra.crm.repository.AttendanceLocationRepository;
import com.arudra.crm.repository.BranchRepository;
import com.arudra.crm.repository.EmployeeBiometricRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.security.DevicePrincipal;
import com.arudra.crm.security.SimpleRateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Lifecycle of attendance terminals: registration (open but approval-gated), admin approval / reject /
 * block / unblock / revoke / rename / re-assign, credential issue and token exchange, heartbeat and
 * offline detection. Every state change is audited and lands in the device's activity trail.
 *
 * Two ways to register a terminal:
 *  1. Request → approve: the terminal sends a registration request (status PENDING); an admin approves it
 *     from HR → Attendance → Devices; the terminal, polling with its one-time poll token, then receives
 *     its device secret.
 *  2. Admin-created slot: the admin "Registers Device" in the CRM, gets a one-time pairing code, and types
 *     it on the terminal — the slot is pre-approved, so the terminal is ACTIVE immediately.
 */
@Service
public class AttendanceDeviceService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceDeviceService.class);
    private static final Pattern UUID_PATTERN = Pattern.compile("^[A-Za-z0-9-]{16,64}$");
    private static final Set<String> SCANNER_STATES =
            Set.of("CONNECTED", "DISCONNECTED", "PERMISSION_DENIED", "ERROR", "UNKNOWN");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    private final AttendanceDeviceRepository deviceRepository;
    private final AttendanceDeviceEventRepository eventRepository;
    private final BranchRepository branchRepository;
    private final AttendanceLocationRepository locationRepository;
    private final EmployeeBiometricRepository biometricRepository;
    private final EmployeeRepository employeeRepository;
    private final DeviceCredentialService credentialService;
    private final AttendanceAuditService audit;
    private final NotificationService notificationService;
    private final SimpleRateLimiter rateLimiter;
    private final BiometricService biometricService;

    @Value("${app.attendance.device.heartbeat-interval-seconds:60}") private int heartbeatIntervalSeconds;
    @Value("${app.attendance.device.offline-after-seconds:300}") private int offlineAfterSeconds;
    @Value("${app.attendance.device.min-checkout-gap-minutes:15}") private int minCheckoutGapMinutes;
    @Value("${app.attendance.device.max-offline-hours:72}") private int maxOfflineHours;
    @Value("${app.attendance.device.success-screen-seconds:4}") private int successScreenSeconds;
    @Value("${app.attendance.device.code-prefix:ARUDRA-ATT}") private String codePrefix;
    @Value("${app.attendance.device.pairing-ttl-hours:24}") private int pairingTtlHours;

    public AttendanceDeviceService(AttendanceDeviceRepository deviceRepository,
                                   AttendanceDeviceEventRepository eventRepository,
                                   BranchRepository branchRepository,
                                   AttendanceLocationRepository locationRepository,
                                   EmployeeBiometricRepository biometricRepository,
                                   EmployeeRepository employeeRepository,
                                   DeviceCredentialService credentialService,
                                   AttendanceAuditService audit,
                                   NotificationService notificationService,
                                   SimpleRateLimiter rateLimiter,
                                   BiometricService biometricService) {
        this.deviceRepository = deviceRepository;
        this.eventRepository = eventRepository;
        this.branchRepository = branchRepository;
        this.locationRepository = locationRepository;
        this.biometricRepository = biometricRepository;
        this.employeeRepository = employeeRepository;
        this.credentialService = credentialService;
        this.audit = audit;
        this.notificationService = notificationService;
        this.rateLimiter = rateLimiter;
        this.biometricService = biometricService;
    }

    // =====================================================================================
    // Terminal: registration
    // =====================================================================================

    @Transactional(readOnly = true)
    public RegistrationOptions registrationOptions(String ip) {
        rateLimiter.check("reg-options:" + ip, 60, 3_600_000L);
        List<Option> branches = branchRepository.findByActiveTrueAndIsDeletedFalseOrderByNameAsc().stream()
                .map(b -> new Option(b.getId(), b.getName())).toList();
        List<LocationOption> locations = locationRepository.findByActiveTrueAndIsDeletedFalse().stream()
                .map(l -> new LocationOption(l.getId(), l.getName(), l.getBranch() == null ? null : l.getBranch().getId()))
                .toList();
        return new RegistrationOptions(branches, locations);
    }

    @Transactional
    public RegisterResponse register(RegisterRequest req, String ip) {
        rateLimiter.check("register:" + ip, 10, 3_600_000L);
        if (req == null || req.deviceUuid() == null || !UUID_PATTERN.matcher(req.deviceUuid()).matches()) {
            throw new IllegalArgumentException("A valid device id is required.");
        }
        String uuid = req.deviceUuid().trim();

        if (req.pairingCode() != null && !req.pairingCode().isBlank()) {
            return pair(req, uuid, ip);
        }

        AttendanceDevice device = deviceRepository.findByDeviceUuidAndIsDeletedFalse(uuid).orElse(null);
        if (device != null) {
            switch (device.getStatus()) {
                case AttendanceDeviceStatus.ACTIVE -> throw new DeviceAccessException(409, "DEVICE_ALREADY_ACTIVE",
                        "This device is already registered. Ask an administrator to revoke it before registering again.");
                case AttendanceDeviceStatus.BLOCKED -> throw DeviceAccessException.forbidden("DEVICE_BLOCKED",
                        "This device has been blocked by an administrator.");
                default -> { /* PENDING (re-send), REJECTED / REVOKED (new request) */ }
            }
        } else {
            device = new AttendanceDevice();
            device.setDeviceUuid(uuid);
            device.setDeviceCode(nextDeviceCode());
        }

        Branch branch = requireBranch(req.branchId());
        AttendanceLocation location = requireLocation(req.locationId(), branch);
        boolean resubmission = device.getId() != null && !AttendanceDeviceStatus.PENDING.equals(device.getStatus());

        device.setDeviceName(cleanName(req.deviceName(), device.getDeviceCode()));
        device.setBranch(branch);
        device.setLocation(location);
        applyHardware(device, req);
        device.setStatus(AttendanceDeviceStatus.PENDING);
        device.setStatusReason(null);
        device.setRegisteredAt(LocalDateTime.now());
        device.setCredentialHash(null);
        device.setCredentialDelivered(false);
        device.setLastIp(ip);
        String pollToken = credentialService.newSecret();
        device.setPollTokenHash(credentialService.hash(pollToken));
        device = deviceRepository.save(device);

        audit.deviceEvent(device.getId(), "REGISTRATION_REQUESTED",
                (resubmission ? "Registration re-submitted" : "Registration requested") + " for " + branch.getName()
                        + " / " + location.getName(), null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_REGISTRATION_REQUESTED", device.getId(),
                device.getDeviceCode(), "Device " + device.getDeviceName() + " (" + device.getDeviceCode()
                        + ") requested registration from " + ip);
        notificationService.dispatchToAdmins("New Attendance Device",
                "Device: " + device.getDeviceName() + "\nBranch: " + branch.getName()
                        + "\nRequested: " + LocalDateTime.now().format(DAY),
                "ATTENDANCE_DEVICE", "/workforce/attendance-devices?focus=" + device.getId(), null);

        return new RegisterResponse(device.getId(), device.getDeviceCode(), device.getDeviceName(),
                device.getStatus(), pollToken, null, "Registration sent. Waiting for administrator approval.");
    }

    /** Binds a terminal to an admin-created (pre-approved) slot via its one-time pairing code. */
    private RegisterResponse pair(RegisterRequest req, String uuid, String ip) {
        rateLimiter.check("pair:" + ip, 5, 900_000L);
        String normalized = DeviceCredentialService.normalizePairingCode(req.pairingCode());
        LocalDateTime now = LocalDateTime.now();
        AttendanceDevice slot = deviceRepository.findByPairingCodeHashIsNotNullAndDeviceUuidIsNullAndIsDeletedFalse().stream()
                .filter(d -> d.getPairingExpiresAt() != null && d.getPairingExpiresAt().isAfter(now))
                .filter(d -> credentialService.matches(normalized, d.getPairingCodeHash()))
                .findFirst()
                .orElseThrow(() -> new DeviceAccessException(400, "PAIRING_INVALID",
                        "Pairing code is invalid or has expired."));

        AttendanceDevice existing = deviceRepository.findByDeviceUuidAndIsDeletedFalse(uuid).orElse(null);
        if (existing != null) {
            if (AttendanceDeviceStatus.ACTIVE.equals(existing.getStatus()) || AttendanceDeviceStatus.BLOCKED.equals(existing.getStatus())) {
                throw new DeviceAccessException(409, "DEVICE_ALREADY_REGISTERED",
                        "This device is already registered as " + existing.getDeviceCode() + ".");
            }
            // An old pending/rejected/revoked request from the same hardware is superseded by the slot.
            existing.setDeviceUuid(null);
            existing.setIsDeleted(true);
            existing.setDeletedAt(now);
            existing.setStatusReason("Superseded by pairing with " + slot.getDeviceCode());
            deviceRepository.saveAndFlush(existing);
        }

        slot.setDeviceUuid(uuid);
        applyHardware(slot, req);
        slot.setPairingCodeHash(null);
        slot.setPairingExpiresAt(null);
        slot.setRegisteredAt(now);
        slot.setLastIp(ip);
        String secret = issueCredential(slot);
        slot.setCredentialDelivered(false); // confirmed on first token exchange
        slot = deviceRepository.save(slot);

        audit.deviceEvent(slot.getId(), "PAIRED", "Terminal paired with admin pairing code", null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_PAIRED", slot.getId(), slot.getDeviceCode(),
                "Terminal " + uuid + " paired to pre-approved device " + slot.getDeviceCode() + " from " + ip);
        return new RegisterResponse(slot.getId(), slot.getDeviceCode(), slot.getDeviceName(), slot.getStatus(),
                null, secret, "Device paired and active.");
    }

    @Transactional
    public RegistrationStatusResponse registrationStatus(RegistrationStatusRequest req, String ip) {
        rateLimiter.check("reg-status:" + ip, 240, 3_600_000L);
        if (req == null || req.registrationId() == null || req.pollToken() == null) {
            throw new IllegalArgumentException("registrationId and pollToken are required.");
        }
        AttendanceDevice device = deviceRepository.findByIdAndIsDeletedFalse(req.registrationId())
                .orElseThrow(() -> DeviceAccessException.unauthorized("REGISTRATION_UNKNOWN", "Registration not found."));
        if (!Objects.equals(device.getDeviceUuid(), req.deviceUuid())
                || !credentialService.matches(req.pollToken(), device.getPollTokenHash())) {
            throw DeviceAccessException.unauthorized("REGISTRATION_UNKNOWN", "Registration not found.");
        }
        String status = device.getStatus();
        if (AttendanceDeviceStatus.ACTIVE.equals(status) && !Boolean.TRUE.equals(device.getCredentialDelivered())) {
            // Re-issued on every poll until the terminal proves it has it (first token exchange), so a
            // lost response never strands the device; each re-issue invalidates the previous secret.
            String secret = issueCredential(device);
            deviceRepository.save(device);
            audit.deviceEvent(device.getId(), "CREDENTIAL_ISSUED", "Device credential issued", null);
            return new RegistrationStatusResponse(status, device.getDeviceCode(), device.getDeviceName(), secret,
                    "Approved.");
        }
        String message = switch (status) {
            case AttendanceDeviceStatus.PENDING -> "Waiting for administrator approval.";
            case AttendanceDeviceStatus.REJECTED -> "Registration was rejected"
                    + (device.getStatusReason() == null ? "." : ": " + device.getStatusReason());
            case AttendanceDeviceStatus.BLOCKED -> "This device has been blocked.";
            default -> status;
        };
        return new RegistrationStatusResponse(status, device.getDeviceCode(), device.getDeviceName(), null, message);
    }

    // =====================================================================================
    // Terminal: authentication + heartbeat
    // =====================================================================================

    @Transactional(noRollbackFor = DeviceAccessException.class)
    public TokenResponse exchangeToken(TokenRequest req, String ip) {
        rateLimiter.check("token-ip:" + ip, 60, 600_000L);
        if (req == null || req.deviceUuid() == null || req.deviceSecret() == null) {
            throw DeviceAccessException.unauthorized("INVALID_CREDENTIAL", "Device credentials are required.");
        }
        rateLimiter.check("token-dev:" + req.deviceUuid(), 20, 600_000L);
        AttendanceDevice device = deviceRepository.findByDeviceUuidAndIsDeletedFalse(req.deviceUuid())
                .orElseThrow(() -> DeviceAccessException.unauthorized("INVALID_CREDENTIAL", "Unknown device."));
        if (!credentialService.matches(req.deviceSecret(), device.getCredentialHash())) {
            audit.deviceEvent(device.getId(), "AUTH_FAILED", "Rejected credential exchange from " + ip, null);
            throw DeviceAccessException.unauthorized("INVALID_CREDENTIAL", "Device credential is not valid.");
        }
        if (!AttendanceDeviceStatus.ACTIVE.equals(device.getStatus())) {
            throw DeviceAccessException.forbidden("DEVICE_" + device.getStatus(),
                    "This attendance device is " + device.getStatus().toLowerCase(Locale.ROOT) + ".");
        }
        if (!Boolean.TRUE.equals(device.getCredentialDelivered())) {
            device.setCredentialDelivered(true);
            device.setPollTokenHash(null); // registration handshake complete
            audit.deviceEvent(device.getId(), "ACTIVATED", "Terminal confirmed its credential", null);
        }
        device.setLastSeenAt(LocalDateTime.now());
        device.setLastIp(ip);
        deviceRepository.save(device);
        String token = credentialService.issueToken(device.getId(), device.getDeviceUuid(), device.getCredentialVersion());
        return new TokenResponse(token, credentialService.tokenTtlSeconds(), System.currentTimeMillis(), info(device));
    }

    @Transactional
    public HeartbeatResponse heartbeat(DevicePrincipal principal, HeartbeatRequest req, String ip) {
        AttendanceDevice device = requireDevice(principal.deviceId());
        LocalDateTime now = LocalDateTime.now();
        if (Boolean.TRUE.equals(device.getOfflineAlertSent())) {
            device.setOfflineAlertSent(false);
            audit.deviceEvent(device.getId(), "ONLINE", "Device back online", null);
        }
        if (req != null) {
            if (req.appVersion() != null) device.setAppVersion(AttendanceAuditService.truncate(req.appVersion(), 40));
            if (req.scannerVendor() != null) device.setScannerVendor(AttendanceAuditService.truncate(req.scannerVendor(), 60));
            if (req.scannerModel() != null) device.setScannerModel(AttendanceAuditService.truncate(req.scannerModel(), 100));
            if (req.scannerSerial() != null) device.setScannerSerial(AttendanceAuditService.truncate(req.scannerSerial(), 100));
            if (req.osVersion() != null) device.setOsVersion(AttendanceAuditService.truncate(req.osVersion(), 40));
            if (req.pendingSyncCount() != null) device.setPendingSyncCount(Math.max(0, req.pendingSyncCount()));
            String scanner = req.scannerStatus() == null ? null : req.scannerStatus().toUpperCase(Locale.ROOT);
            if (scanner != null && SCANNER_STATES.contains(scanner) && !scanner.equals(device.getScannerStatus())) {
                String previous = device.getScannerStatus();
                device.setScannerStatus(scanner);
                audit.deviceEvent(device.getId(), "SCANNER_" + scanner,
                        "Scanner " + scanner.toLowerCase(Locale.ROOT).replace('_', ' ')
                                + (previous == null ? "" : " (was " + previous.toLowerCase(Locale.ROOT) + ")"), null);
                if (previous != null && !"CONNECTED".equals(scanner)) {
                    notificationService.dispatchToAdmins("Attendance scanner " + scanner.toLowerCase(Locale.ROOT).replace('_', ' '),
                            device.getDeviceName() + ": the fingerprint scanner is " + scanner.toLowerCase(Locale.ROOT).replace('_', ' ') + ".",
                            "ATTENDANCE_DEVICE", "/workforce/attendance-devices?focus=" + device.getId(), null);
                }
            }
        }
        device.setLastSeenAt(now);
        device.setLastIp(ip);
        deviceRepository.save(device);

        return new HeartbeatResponse(System.currentTimeMillis(), device.getStatus(), config(),
                biometricService.nextPendingEnrollment(device.getId()),
                biometricService.enrollmentsRevision(device.getId()), info(device));
    }

    public DeviceConfig config() {
        return new DeviceConfig(heartbeatIntervalSeconds, minCheckoutGapMinutes, maxOfflineHours,
                successScreenSeconds, ZoneId.systemDefault().getId());
    }

    /** Raises a one-time alert for ACTIVE devices that stopped sending heartbeats. */
    @Scheduled(fixedDelayString = "${app.attendance.device.offline-check-ms:60000}", initialDelay = 90_000)
    @Transactional
    public void detectOfflineDevices() {
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(offlineAfterSeconds);
        for (AttendanceDevice d : deviceRepository.findNewlyOffline(cutoff)) {
            d.setOfflineAlertSent(true);
            deviceRepository.save(d);
            audit.deviceEvent(d.getId(), "OFFLINE", "No heartbeat since " + d.getLastSeenAt(), null);
            notificationService.dispatchToAdmins("Attendance device offline",
                    d.getDeviceName() + " has not been seen since " + d.getLastSeenAt().toLocalTime().withNano(0)
                            + ". Punches are kept on the device and will sync when it reconnects.",
                    "ATTENDANCE_DEVICE", "/workforce/attendance-devices?focus=" + d.getId(), null);
            log.info("Attendance device {} marked offline (last seen {})", d.getDeviceCode(), d.getLastSeenAt());
        }
    }

    // =====================================================================================
    // Admin
    // =====================================================================================

    @Transactional(readOnly = true)
    public List<DeviceView> list() {
        return deviceRepository.findByIsDeletedFalseOrderByIdDesc().stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public DeviceView get(Long id) {
        return view(requireDevice(id));
    }

    /** Admin "Register Device": a pre-approved slot plus a one-time pairing code for the terminal. */
    @Transactional
    public AdminCreateResponse adminCreate(AdminCreateRequest req) {
        Branch branch = requireBranch(req == null ? null : req.branchId());
        AttendanceLocation location = requireLocation(req.locationId(), branch);
        AttendanceDevice d = new AttendanceDevice();
        d.setDeviceCode(nextDeviceCode());
        d.setDeviceName(cleanName(req.deviceName(), d.getDeviceCode()));
        d.setBranch(branch);
        d.setLocation(location);
        d.setStatus(AttendanceDeviceStatus.ACTIVE);
        d.setApprovedBy(audit.actor());
        d.setApprovedAt(LocalDateTime.now());
        String code = credentialService.newPairingCode();
        d.setPairingCodeHash(credentialService.hash(DeviceCredentialService.normalizePairingCode(code)));
        d.setPairingExpiresAt(LocalDateTime.now().plusHours(pairingTtlHours));
        d = deviceRepository.save(d);
        audit.deviceEvent(d.getId(), "REGISTERED_BY_ADMIN", "Device slot created; awaiting terminal pairing", null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_REGISTERED", d.getId(), d.getDeviceCode(),
                "Registered device " + d.getDeviceName() + " for " + branch.getName() + " / " + location.getName());
        return new AdminCreateResponse(view(d), code, d.getPairingExpiresAt());
    }

    @Transactional
    public AdminCreateResponse regeneratePairingCode(Long id) {
        AttendanceDevice d = requireDevice(id);
        if (d.getDeviceUuid() != null) throw new IllegalStateException("This device is already paired.");
        String code = credentialService.newPairingCode();
        d.setPairingCodeHash(credentialService.hash(DeviceCredentialService.normalizePairingCode(code)));
        d.setPairingExpiresAt(LocalDateTime.now().plusHours(pairingTtlHours));
        deviceRepository.save(d);
        audit.deviceEvent(d.getId(), "PAIRING_CODE_REISSUED", "New pairing code issued", null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_PAIRING_CODE", d.getId(), d.getDeviceCode(),
                "Pairing code re-issued for " + d.getDeviceName());
        return new AdminCreateResponse(view(d), code, d.getPairingExpiresAt());
    }

    @Transactional
    public DeviceView approve(Long id, DeviceActionRequest req) {
        AttendanceDevice d = requireDevice(id);
        if (!AttendanceDeviceStatus.PENDING.equals(d.getStatus())) {
            throw new IllegalStateException("Only a pending device can be approved (current: " + d.getStatus() + ").");
        }
        if (req != null) applyAssignment(d, req.deviceName(), req.branchId(), req.locationId());
        if (d.getBranch() == null || d.getLocation() == null) {
            throw new IllegalArgumentException("Assign a branch and an attendance location before approving.");
        }
        d.setApprovedBy(audit.actor());
        d.setApprovedAt(LocalDateTime.now());
        changeStatus(d, AttendanceDeviceStatus.ACTIVE, null);
        audit.deviceEvent(d.getId(), "APPROVED", "Approved by " + audit.actor(), null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_APPROVED", d.getId(), d.getDeviceCode(),
                "Approved attendance device " + d.getDeviceName() + " (" + d.getDeviceCode() + ")");
        return view(deviceRepository.save(d));
    }

    @Transactional
    public DeviceView reject(Long id, DeviceActionRequest req) {
        AttendanceDevice d = requireDevice(id);
        if (!AttendanceDeviceStatus.PENDING.equals(d.getStatus())) {
            throw new IllegalStateException("Only a pending device can be rejected.");
        }
        String reason = reason(req);
        changeStatus(d, AttendanceDeviceStatus.REJECTED, reason);
        audit.deviceEvent(d.getId(), "REJECTED", "Rejected" + suffix(reason), null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_REJECTED", d.getId(), d.getDeviceCode(),
                "Rejected attendance device " + d.getDeviceName() + suffix(reason));
        return view(deviceRepository.save(d));
    }

    @Transactional
    public DeviceView block(Long id, DeviceActionRequest req) {
        AttendanceDevice d = requireDevice(id);
        if (!AttendanceDeviceStatus.ACTIVE.equals(d.getStatus()) && !AttendanceDeviceStatus.PENDING.equals(d.getStatus())) {
            throw new IllegalStateException("Only an active or pending device can be blocked.");
        }
        String reason = reason(req);
        changeStatus(d, AttendanceDeviceStatus.BLOCKED, reason);
        audit.deviceEvent(d.getId(), "BLOCKED", "Blocked" + suffix(reason), null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_BLOCKED", d.getId(), d.getDeviceCode(),
                "Blocked attendance device " + d.getDeviceName() + suffix(reason));
        return view(deviceRepository.save(d));
    }

    @Transactional
    public DeviceView unblock(Long id) {
        AttendanceDevice d = requireDevice(id);
        if (!AttendanceDeviceStatus.BLOCKED.equals(d.getStatus())) throw new IllegalStateException("Device is not blocked.");
        // Never approved ⇒ back to the approval queue; otherwise straight back to ACTIVE.
        changeStatus(d, d.getApprovedAt() == null ? AttendanceDeviceStatus.PENDING : AttendanceDeviceStatus.ACTIVE, null);
        audit.deviceEvent(d.getId(), "UNBLOCKED", "Unblocked by " + audit.actor(), null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_UNBLOCKED", d.getId(), d.getDeviceCode(),
                "Unblocked attendance device " + d.getDeviceName());
        return view(deviceRepository.save(d));
    }

    /**
     * Permanently revokes the device's credential. Outstanding tokens die immediately (credential
     * version bump + status), and the biometric references held on the device are revoked so the
     * terminal wipes its local templates if it is ever re-registered.
     */
    @Transactional
    public DeviceView revoke(Long id, DeviceActionRequest req) {
        AttendanceDevice d = requireDevice(id);
        if (AttendanceDeviceStatus.REVOKED.equals(d.getStatus())) throw new IllegalStateException("Device is already revoked.");
        String reason = reason(req);
        d.setCredentialHash(null);
        d.setCredentialVersion((d.getCredentialVersion() == null ? 0 : d.getCredentialVersion()) + 1);
        d.setCredentialDelivered(false);
        d.setPollTokenHash(null);
        d.setPairingCodeHash(null);
        d.setPairingExpiresAt(null);
        changeStatus(d, AttendanceDeviceStatus.REVOKED, reason);
        int revoked = biometricService.revokeAllOnDevice(d, "Device revoked");
        audit.deviceEvent(d.getId(), "REVOKED", "Credential revoked" + suffix(reason)
                + (revoked > 0 ? "; " + revoked + " enrollment(s) revoked" : ""), null);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_REVOKED", d.getId(), d.getDeviceCode(),
                "Revoked attendance device " + d.getDeviceName() + suffix(reason));
        return view(deviceRepository.save(d));
    }

    @Transactional
    public DeviceView update(Long id, DeviceUpdateRequest req) {
        AttendanceDevice d = requireDevice(id);
        String before = describe(d);
        applyAssignment(d, req.deviceName(), req.branchId(), req.locationId());
        String after = describe(d);
        if (!before.equals(after)) {
            audit.deviceEvent(d.getId(), "UPDATED", before + " → " + after, null);
            audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_UPDATED", d.getId(), d.getDeviceCode(),
                    "Device updated: " + before + " → " + after);
        }
        return view(deviceRepository.save(d));
    }

    @Transactional
    public void delete(Long id) {
        AttendanceDevice d = requireDevice(id);
        if (AttendanceDeviceStatus.ACTIVE.equals(d.getStatus()) && d.getDeviceUuid() != null) {
            throw new IllegalStateException("Block or revoke an active device before deleting it.");
        }
        biometricService.revokeAllOnDevice(d, "Device deleted");
        d.setIsDeleted(true);
        d.setDeletedAt(LocalDateTime.now());
        d.setDeletedBy(audit.actor());
        d.setDeviceUuid(null); // frees the hardware id for a future registration
        d.setCredentialHash(null);
        d.setPollTokenHash(null);
        d.setPairingCodeHash(null);
        deviceRepository.save(d);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "DEVICE_DELETED", d.getId(), d.getDeviceCode(),
                "Deleted attendance device " + d.getDeviceName());
    }

    @Transactional(readOnly = true)
    public List<DeviceEventView> activity(Long id, int limit) {
        requireDevice(id);
        List<AttendanceDeviceEvent> events = eventRepository.findByDeviceIdOrderByOccurredAtDesc(id,
                PageRequest.of(0, Math.max(1, Math.min(500, limit))));
        Map<Long, String> names = new HashMap<>();
        employeeRepository.findAllById(events.stream().map(AttendanceDeviceEvent::getEmployeeId)
                        .filter(Objects::nonNull).distinct().toList())
                .forEach(e -> names.put(e.getId(), fullName(e)));
        return events.stream().map(e -> new DeviceEventView(e.getId(), e.getEventType(), e.getMessage(),
                e.getEmployeeId(), e.getEmployeeId() == null ? null : names.get(e.getEmployeeId()),
                e.getActor(), e.getIpAddress(), e.getOccurredAt())).toList();
    }

    // =====================================================================================
    // helpers
    // =====================================================================================

    public AttendanceDevice requireDevice(Long id) {
        return deviceRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attendance device not found: " + id));
    }

    public boolean isOnline(AttendanceDevice d) {
        return d.getLastSeenAt() != null
                && d.getLastSeenAt().isAfter(LocalDateTime.now().minusSeconds(offlineAfterSeconds));
    }

    public DeviceInfo info(AttendanceDevice d) {
        return new DeviceInfo(d.getId(), d.getDeviceCode(), d.getDeviceName(),
                d.getBranch() == null ? null : d.getBranch().getId(),
                d.getBranch() == null ? null : d.getBranch().getName(),
                d.getLocation() == null ? null : d.getLocation().getId(),
                d.getLocation() == null ? null : d.getLocation().getName());
    }

    private DeviceView view(AttendanceDevice d) {
        boolean online = isOnline(d);
        String effective = AttendanceDeviceStatus.ACTIVE.equals(d.getStatus()) && d.getDeviceUuid() != null && !online
                ? AttendanceDeviceStatus.OFFLINE : d.getStatus();
        boolean awaitingPairing = d.getDeviceUuid() == null && d.getPairingCodeHash() != null;
        return new DeviceView(d.getId(), d.getDeviceName(), d.getDeviceCode(), d.getDeviceUuid(), d.getStatus(),
                effective, online,
                d.getBranch() == null ? null : d.getBranch().getId(),
                d.getBranch() == null ? null : d.getBranch().getName(),
                d.getLocation() == null ? null : d.getLocation().getId(),
                d.getLocation() == null ? null : d.getLocation().getName(),
                d.getLastSeenAt(), d.getAppVersion(), d.getScannerStatus(), d.getScannerVendor(), d.getScannerModel(),
                d.getScannerSerial(), d.getRegisteredAt(), d.getApprovedBy(), d.getApprovedAt(), d.getLastSyncAt(),
                d.getPendingSyncCount(), d.getManufacturer(), d.getModel(), d.getOsVersion(), d.getLastIp(),
                d.getStatusReason(), d.getStatusChangedBy(), d.getStatusChangedAt(),
                d.getId() == null ? 0 : biometricRepository.countActiveOnDevice(d.getId()),
                awaitingPairing, awaitingPairing ? d.getPairingExpiresAt() : null, d.getCredentialIssuedAt());
    }

    /** New random secret; stores its hash and bumps the credential version (invalidating old tokens). */
    private String issueCredential(AttendanceDevice d) {
        String secret = credentialService.newSecret();
        d.setCredentialHash(credentialService.hash(secret));
        d.setCredentialVersion((d.getCredentialVersion() == null ? 0 : d.getCredentialVersion()) + 1);
        d.setCredentialIssuedAt(LocalDateTime.now());
        return secret;
    }

    private void changeStatus(AttendanceDevice d, String status, String reason) {
        d.setStatus(status);
        d.setStatusReason(reason);
        d.setStatusChangedBy(audit.actor());
        d.setStatusChangedAt(LocalDateTime.now());
    }

    private void applyAssignment(AttendanceDevice d, String name, Long branchId, Long locationId) {
        if (name != null && !name.isBlank()) d.setDeviceName(cleanName(name, d.getDeviceCode()));
        Branch branch = d.getBranch();
        if (branchId != null) branch = requireBranch(branchId);
        if (locationId != null) {
            d.setLocation(requireLocation(locationId, branch));
        } else if (branchId != null && d.getLocation() != null && d.getLocation().getBranch() != null
                && !Objects.equals(d.getLocation().getBranch().getId(), branchId)) {
            throw new IllegalArgumentException("The device's attendance location belongs to another branch — pick a location too.");
        }
        d.setBranch(branch);
    }

    private void applyHardware(AttendanceDevice d, RegisterRequest req) {
        d.setAppVersion(AttendanceAuditService.truncate(req.appVersion(), 40));
        d.setManufacturer(AttendanceAuditService.truncate(req.manufacturer(), 100));
        d.setModel(AttendanceAuditService.truncate(req.model(), 100));
        d.setOsVersion(AttendanceAuditService.truncate(req.osVersion(), 40));
        d.setScannerVendor(AttendanceAuditService.truncate(req.scannerVendor(), 60));
        d.setScannerModel(AttendanceAuditService.truncate(req.scannerModel(), 100));
    }

    private Branch requireBranch(Long id) {
        if (id == null) throw new IllegalArgumentException("Select a branch.");
        Branch b = branchRepository.findById(id).filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Branch not found."));
        if (!Boolean.TRUE.equals(b.getActive())) throw new IllegalArgumentException("Branch " + b.getName() + " is inactive.");
        return b;
    }

    private AttendanceLocation requireLocation(Long id, Branch branch) {
        if (id == null) throw new IllegalArgumentException("Select an attendance location.");
        AttendanceLocation l = locationRepository.findById(id).filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Attendance location not found."));
        if (!Boolean.TRUE.equals(l.getActive())) throw new IllegalArgumentException("Location " + l.getName() + " is inactive.");
        if (branch != null && l.getBranch() != null && !Objects.equals(l.getBranch().getId(), branch.getId())) {
            throw new IllegalArgumentException("Location " + l.getName() + " belongs to another branch.");
        }
        return l;
    }

    private String nextDeviceCode() {
        Long max = deviceRepository.maxId();
        return String.format("%s-%04d", codePrefix, (max == null ? 0 : max) + 1);
    }

    private static String cleanName(String name, String fallback) {
        String n = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        if (n.isEmpty()) return fallback;
        return n.length() > 120 ? n.substring(0, 120) : n;
    }

    private static String reason(DeviceActionRequest req) {
        String r = req == null || req.reason() == null ? null : req.reason().trim();
        return r == null || r.isEmpty() ? null : AttendanceAuditService.truncate(r, 255);
    }

    private static String suffix(String reason) {
        return reason == null ? "" : " — " + reason;
    }

    private static String describe(AttendanceDevice d) {
        return d.getDeviceName() + " @ " + (d.getBranch() == null ? "—" : d.getBranch().getName())
                + " / " + (d.getLocation() == null ? "—" : d.getLocation().getName());
    }

    static String fullName(Employee e) {
        return ((e.getFirstName() == null ? "" : e.getFirstName()) + " "
                + (e.getLastName() == null ? "" : e.getLastName())).trim();
    }
}

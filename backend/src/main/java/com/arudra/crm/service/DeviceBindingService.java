package com.arudra.crm.service;

import com.arudra.crm.config.DeviceBindingSettings;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.User;
import com.arudra.crm.entity.UserDevice;
import com.arudra.crm.entity.UserDeviceEvent;
import com.arudra.crm.exception.DeviceNotAuthorizedException;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.UserDeviceEventRepository;
import com.arudra.crm.repository.UserDeviceRepository;
import com.arudra.crm.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Attendance phone binding: one approved phone per user account. The phone holds a non-extractable
 * WebCrypto ECDSA P-256 key; this service stores the public half and proves later punches came from
 * that phone by verifying a signature over a one-time server nonce.
 *
 * Signing contract (client side): sign the UTF-8 bytes of the nonce string exactly as issued, with
 * ECDSA/SHA-256. WebCrypto's raw 64-byte r||s signature and DER are both accepted.
 *
 * Auto-approval: a user's FIRST phone (no device rows on record — never bound, or wiped by an admin
 * reset) goes ACTIVE straight away when enabled. Any later phone waits as PENDING; approving it
 * retires the oldest ACTIVE device(s) beyond app.attendance.device-binding.max-devices-per-user.
 *
 * Challenges are in-memory per user (single-instance, like WebAuthnService).
 */
@Service
public class DeviceBindingService {

    private static final Logger log = LoggerFactory.getLogger(DeviceBindingService.class);
    private static final Pattern UUID_RE = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");
    private static final List<String> LIVE = List.of(UserDevice.PENDING, UserDevice.ACTIVE);
    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();

    /** Outcome of checking a punch's device proof. */
    public enum Outcome { VERIFIED, NO_PROOF, NOT_BOUND, PENDING, REVOKED, BAD_CHALLENGE, BAD_SIGNATURE }

    public record Verification(Outcome outcome, UserDevice device, String reason) {
        public boolean verified() { return outcome == Outcome.VERIFIED; }
    }

    private record ChallengeEntry(String nonce, long expiresAt) {}

    private final UserDeviceRepository deviceRepository;
    private final UserDeviceEventRepository eventRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final DeviceBindingSettings settings;

    private final SecureRandom random = new SecureRandom();
    private final Map<Long, ChallengeEntry> challenges = new ConcurrentHashMap<>();

    public DeviceBindingService(UserDeviceRepository deviceRepository, UserDeviceEventRepository eventRepository,
                                EmployeeRepository employeeRepository, UserRepository userRepository,
                                NotificationService notificationService, DeviceBindingSettings settings) {
        this.deviceRepository = deviceRepository;
        this.eventRepository = eventRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.settings = settings;
    }

    // =====================================================================
    // Employee side
    // =====================================================================

    /** The signed-in user's binding state for the portal. */
    @Transactional(readOnly = true)
    public Map<String, Object> myStatus(User user) {
        Employee emp = employeeFor(user);
        List<UserDevice> devices = deviceRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(user.getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("mode", settings.effectiveMode(emp));
        out.put("maxDevices", settings.getMaxDevicesPerUser());
        out.put("hasActiveDevice", devices.stream().anyMatch(d -> UserDevice.ACTIVE.equals(d.getStatus())));
        out.put("hasPendingDevice", devices.stream().anyMatch(d -> UserDevice.PENDING.equals(d.getStatus())));
        out.put("devices", devices.stream().map(this::view).toList());
        return out;
    }

    /** A fresh one-time nonce for the signed-in user (replaces any outstanding one). */
    public Map<String, Object> issueChallenge(User user) {
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String nonce = B64URL.encodeToString(raw);
        int ttl = settings.getChallengeTtlSeconds();
        challenges.put(user.getId(), new ChallengeEntry(nonce, System.currentTimeMillis() + ttl * 1000L));
        purgeExpired();
        return Map.of("nonce", nonce, "expiresInSeconds", ttl);
    }

    public record BindRequest(String deviceUuid, String publicKey, String nonce, String signature,
                              String deviceLabel, String platform, String userAgent, String reason) {}

    /**
     * Bind (or re-request) this phone. The request must carry a signature over a fresh challenge
     * made with the private half of {@code publicKey} — proof the caller actually holds the key.
     */
    @Transactional
    public Map<String, Object> requestBind(User user, BindRequest req, String ip) {
        String uuid = trim(req.deviceUuid());
        if (uuid == null || !UUID_RE.matcher(uuid).matches()) {
            throw new IllegalArgumentException("Invalid device id.");
        }
        PublicKey key = parsePublicKey(req.publicKey());
        if (!consumeChallenge(user.getId(), req.nonce()) || !verifySignature(key, req.nonce(), req.signature())) {
            throw new IllegalArgumentException("Device proof failed — please try again.");
        }
        String spki = req.publicKey().trim();
        String keyHash = sha256Hex(spki);

        // Same phone already live under someone else → refuse (buddy-punching guard).
        if (!deviceRepository.findByDeviceUuidAndUserIdNotAndStatusInAndIsDeletedFalse(uuid, user.getId(), LIVE).isEmpty()
                || !deviceRepository.findByPublicKeyHashAndUserIdNotAndStatusInAndIsDeletedFalse(keyHash, user.getId(), LIVE).isEmpty()) {
            event(null, user.getId(), "SHARED_DEVICE_DETECTED", user.getEmail(), ip,
                    "Tried to bind a phone already registered to another user (device " + uuid + ")");
            notificationService.dispatchToAdmins("Shared phone blocked",
                    displayName(user) + " tried to register a phone that is already registered to another employee.",
                    "ATTENDANCE", "/hr", null);
            throw new IllegalStateException("This phone is already registered to another user. Ask HR for help.");
        }

        LocalDateTime now = LocalDateTime.now();
        UserDevice existing = deviceRepository.findByUserIdAndDeviceUuid(user.getId(), uuid).orElse(null);

        // Already bound with the same key — idempotent.
        if (existing != null && !Boolean.TRUE.equals(existing.getIsDeleted())
                && UserDevice.ACTIVE.equals(existing.getStatus()) && keyHash.equals(existing.getPublicKeyHash())) {
            touch(existing, ip);
            return view(deviceRepository.save(existing));
        }

        boolean autoApprove = settings.isAutoApproveFirstDevice() && !deviceRepository.existsByUserIdAndIsDeletedFalse(user.getId());

        // One open request at a time: a newer phone supersedes an older pending one.
        for (UserDevice p : deviceRepository.findByUserIdAndStatusAndIsDeletedFalse(user.getId(), UserDevice.PENDING)) {
            if (p.getDeviceUuid().equals(uuid)) continue;
            p.setStatus(UserDevice.REVOKED);
            p.setRevokedAt(now);
            p.setRevokedBy(user.getEmail());
            p.setRevokeReason("Superseded by a newer phone request");
            deviceRepository.save(p);
            event(p.getId(), user.getId(), "REVOKED", user.getEmail(), ip, "Superseded by a newer phone request");
        }

        UserDevice d = existing != null ? existing : new UserDevice();
        d.setUser(user);
        d.setEmployee(employeeFor(user));
        d.setDeviceUuid(uuid);
        d.setPublicKey(spki);
        d.setPublicKeyHash(keyHash);
        d.setKeyAlg("ES256");
        d.setUserAgent(clip(req.userAgent(), 500));
        d.setPlatform(clip(firstNonBlank(req.platform(), platformOf(req.userAgent())), 50));
        d.setDeviceLabel(clip(firstNonBlank(req.deviceLabel(), labelOf(req.userAgent())), 150));
        d.setRequestReason(clip(trim(req.reason()), 255));
        d.setRequestedAt(now);
        d.setIsDeleted(false);
        d.setDeletedAt(null);
        d.setDeletedBy(null);
        d.setRevokedAt(null);
        d.setRevokedBy(null);
        d.setRevokeReason(null);
        d.setApprovedAt(null);
        d.setApprovedBy(null);
        touch(d, ip);

        if (autoApprove) {
            d.setStatus(UserDevice.ACTIVE);
            d.setApprovedAt(now);
            d.setApprovedBy("AUTO");
            d = deviceRepository.save(d);
            event(d.getId(), user.getId(), "AUTO_APPROVED", user.getEmail(), ip, "First phone: " + d.getDeviceLabel());
        } else {
            d.setStatus(UserDevice.PENDING);
            d = deviceRepository.save(d);
            event(d.getId(), user.getId(), "BIND_REQUESTED", user.getEmail(), ip,
                    d.getDeviceLabel() + (d.getRequestReason() != null ? " — " + d.getRequestReason() : ""));
            notificationService.dispatchToAdmins("Phone approval needed",
                    displayName(user) + " asked to register a new phone for attendance (" + d.getDeviceLabel() + ").",
                    "ATTENDANCE", "/hr", null);
        }
        return view(d);
    }

    /** The employee withdraws their own pending request. */
    @Transactional
    public void withdraw(User user, Long deviceId, String ip) {
        UserDevice d = deviceRepository.findById(deviceId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()) && x.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Device not found."));
        if (!UserDevice.PENDING.equals(d.getStatus())) {
            throw new IllegalStateException("Only a pending request can be withdrawn.");
        }
        d.setStatus(UserDevice.REVOKED);
        d.setRevokedAt(LocalDateTime.now());
        d.setRevokedBy(user.getEmail());
        d.setRevokeReason("Withdrawn by employee");
        deviceRepository.save(d);
        event(d.getId(), user.getId(), "REVOKED", user.getEmail(), ip, "Withdrawn by employee");
    }

    /**
     * Check a punch's device proof. Consumes the user's challenge. Never throws for a bad proof —
     * the caller decides (by enforcement mode) whether to flag or refuse.
     */
    @Transactional
    public Verification verify(User user, String deviceUuid, String nonce, String signature, String ip) {
        if (trim(deviceUuid) == null || trim(nonce) == null || trim(signature) == null) {
            return new Verification(Outcome.NO_PROOF, null, "No device proof sent");
        }
        boolean challengeOk = consumeChallenge(user.getId(), nonce);
        UserDevice d = deviceRepository.findByUserIdAndDeviceUuidAndIsDeletedFalse(user.getId(), deviceUuid.trim()).orElse(null);
        if (d == null) {
            return new Verification(Outcome.NOT_BOUND, null, "Punched from an unregistered phone");
        }
        if (!challengeOk) {
            return new Verification(Outcome.BAD_CHALLENGE, d, "Device challenge expired or reused");
        }
        PublicKey key;
        try {
            key = parsePublicKey(d.getPublicKey());
        } catch (IllegalArgumentException e) {
            return new Verification(Outcome.BAD_SIGNATURE, d, "Stored device key unreadable");
        }
        if (!verifySignature(key, nonce, signature)) {
            return new Verification(Outcome.BAD_SIGNATURE, d, "Device signature did not match");
        }
        return switch (d.getStatus()) {
            case UserDevice.ACTIVE -> {
                touch(d, ip);
                deviceRepository.save(d);
                yield new Verification(Outcome.VERIFIED, d, null);
            }
            case UserDevice.PENDING -> new Verification(Outcome.PENDING, d, "Phone approval still pending");
            default -> new Verification(Outcome.REVOKED, d, "Phone registration was " + d.getStatus().toLowerCase(Locale.ROOT));
        };
    }

    /** The device result a clock action carries into the session; verification is null when OFF. */
    public record DeviceCheck(String mode, Verification verification) {
        public boolean enforced() { return verification != null; }
        public boolean verified() { return verification != null && verification.verified(); }
    }

    /**
     * Device gate for a clock action ("Clock-in" / "Clock-out"). OFF: not checked. Otherwise the proof
     * is verified and a failure is audited; in HARD mode a failure is refused with
     * {@link DeviceNotAuthorizedException}, in SOFT mode it's returned for the session to be flagged.
     * Deliberately non-transactional so the audit row commits even when the punch is refused.
     */
    public DeviceCheck check(User user, String deviceUuid, String nonce, String signature, String ip, String action) {
        String mode = effectiveMode(user);
        if (DeviceBindingSettings.OFF.equals(mode)) return new DeviceCheck(mode, null);
        Verification v = verify(user, deviceUuid, nonce, signature, ip);
        if (!v.verified()) {
            recordMismatch(user, v, ip, action);
            if (DeviceBindingSettings.HARD.equals(mode)) {
                throw new DeviceNotAuthorizedException(hardMessage(v));
            }
        }
        return new DeviceCheck(mode, v);
    }

    private static String hardMessage(Verification v) {
        return switch (v.outcome()) {
            case PENDING -> "Your phone is waiting for HR approval. Attendance can be marked once it's approved.";
            case REVOKED -> v.device() != null && UserDevice.REPLACED.equals(v.device().getStatus())
                    ? "This phone was replaced by your new phone. Please use your registered phone."
                    : "This phone's registration was removed. Request a phone change from Settings.";
            case BAD_CHALLENGE -> "The security check timed out. Please try again.";
            default -> "Attendance can only be marked from your registered phone.";
        };
    }

    /** Audit a punch that failed its device check (called by the clock-in path). */
    @Transactional
    public void recordMismatch(User user, Verification v, String ip, String action) {
        event(v.device() == null ? null : v.device().getId(), user.getId(), "MISMATCH_PUNCH", user.getEmail(), ip,
                action + ": " + v.outcome() + (v.reason() != null ? " — " + v.reason() : ""));
    }

    // =====================================================================
    // Admin side
    // =====================================================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPending() {
        return deviceRepository.findByStatusAndIsDeletedFalseOrderByRequestedAtAsc(UserDevice.PENDING).stream()
                .map(d -> {
                    Map<String, Object> m = adminView(d);
                    m.put("currentDevices", deviceRepository
                            .findByUserIdAndStatusAndIsDeletedFalse(d.getUser().getId(), UserDevice.ACTIVE)
                            .stream().map(this::view).toList());
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> userDevices(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found."));
        Employee emp = employeeFor(user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", user.getId());
        out.put("name", displayName(user));
        out.put("email", user.getEmail());
        out.put("employeeId", emp == null ? null : emp.getId());
        out.put("modeOverride", emp == null ? null : emp.getDeviceBindingMode());
        out.put("effectiveMode", settings.effectiveMode(emp));
        out.put("devices", deviceRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(userId).stream().map(this::view).toList());
        out.put("events", eventRepository.findTop50ByUserIdOrderByCreatedAtDesc(userId).stream().map(this::eventView).toList());
        return out;
    }

    /** Same as {@link #userDevices} but addressed by employee (HR profile screens). */
    @Transactional(readOnly = true)
    public Map<String, Object> employeeDevices(Long employeeId) {
        Employee emp = employeeRepository.findById(employeeId).orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        User user = emp.getEmail() == null ? null : userRepository.findByEmail(emp.getEmail()).orElse(null);
        if (user == null) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("userId", null);
            out.put("employeeId", emp.getId());
            out.put("modeOverride", emp.getDeviceBindingMode());
            out.put("effectiveMode", settings.effectiveMode(emp));
            out.put("devices", List.of());
            out.put("events", List.of());
            return out;
        }
        return userDevices(user.getId());
    }

    @Transactional
    public Map<String, Object> approve(Long deviceId, String actor) {
        UserDevice d = requireDevice(deviceId);
        if (!UserDevice.PENDING.equals(d.getStatus())) {
            throw new IllegalStateException("Only a pending phone can be approved.");
        }
        LocalDateTime now = LocalDateTime.now();
        Long userId = d.getUser().getId();
        // Make room: retire the oldest ACTIVE phones beyond the per-user limit.
        List<UserDevice> active = new ArrayList<>(deviceRepository.findByUserIdAndStatusAndIsDeletedFalse(userId, UserDevice.ACTIVE));
        active.sort(Comparator.comparing(UserDevice::getApprovedAt, Comparator.nullsFirst(Comparator.naturalOrder())));
        int excess = active.size() + 1 - settings.getMaxDevicesPerUser();
        for (int i = 0; i < excess && i < active.size(); i++) {
            UserDevice old = active.get(i);
            old.setStatus(UserDevice.REPLACED);
            old.setRevokedAt(now);
            old.setRevokedBy(actor);
            old.setRevokeReason("Replaced by " + d.getDeviceLabel());
            deviceRepository.save(old);
            event(old.getId(), userId, "REPLACED", actor, null, "Replaced by " + d.getDeviceLabel());
        }
        d.setStatus(UserDevice.ACTIVE);
        d.setApprovedAt(now);
        d.setApprovedBy(actor);
        d = deviceRepository.save(d);
        event(d.getId(), userId, "APPROVED", actor, null, d.getDeviceLabel());
        notifyUser(d.getUser(), "Phone approved", "Your phone (" + d.getDeviceLabel() + ") is now registered for attendance.");
        return adminView(d);
    }

    @Transactional
    public Map<String, Object> reject(Long deviceId, String actor, String reason) {
        UserDevice d = requireDevice(deviceId);
        if (!UserDevice.PENDING.equals(d.getStatus())) {
            throw new IllegalStateException("Only a pending phone can be rejected.");
        }
        close(d, UserDevice.REJECTED, actor, firstNonBlank(reason, "Rejected by HR"));
        event(d.getId(), d.getUser().getId(), "REJECTED", actor, null, d.getRevokeReason());
        notifyUser(d.getUser(), "Phone request rejected", "Your phone registration request was rejected: " + d.getRevokeReason());
        return adminView(d);
    }

    @Transactional
    public Map<String, Object> revoke(Long deviceId, String actor, String reason) {
        UserDevice d = requireDevice(deviceId);
        if (!UserDevice.ACTIVE.equals(d.getStatus()) && !UserDevice.PENDING.equals(d.getStatus())) {
            throw new IllegalStateException("This phone is already inactive.");
        }
        close(d, UserDevice.REVOKED, actor, firstNonBlank(reason, "Revoked by HR"));
        event(d.getId(), d.getUser().getId(), "REVOKED", actor, null, d.getRevokeReason());
        return adminView(d);
    }

    /**
     * Lost/changed phone: wipe all of the user's bindings (soft delete) so their next bind is treated
     * as a first phone and auto-approves (when enabled).
     */
    @Transactional
    public void reset(Long userId, String actor) {
        userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found."));
        LocalDateTime now = LocalDateTime.now();
        for (UserDevice d : deviceRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(userId)) {
            if (UserDevice.ACTIVE.equals(d.getStatus()) || UserDevice.PENDING.equals(d.getStatus())) {
                d.setStatus(UserDevice.REVOKED);
                d.setRevokedAt(now);
                d.setRevokedBy(actor);
                d.setRevokeReason("Reset by HR");
            }
            d.setIsDeleted(true);
            d.setDeletedAt(now);
            d.setDeletedBy(actor);
            deviceRepository.save(d);
        }
        challenges.remove(userId);
        event(null, userId, "RESET", actor, null, "All phone bindings cleared");
    }

    /** Per-employee enforcement override; null/blank/"DEFAULT" clears it. */
    @Transactional
    public Map<String, Object> setEmployeeMode(Long employeeId, String mode) {
        Employee emp = employeeRepository.findById(employeeId).orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        String m = trim(mode);
        if (m == null || "DEFAULT".equalsIgnoreCase(m)) {
            emp.setDeviceBindingMode(null);
        } else if (DeviceBindingSettings.isValidMode(m)) {
            emp.setDeviceBindingMode(m.toUpperCase(Locale.ROOT));
        } else {
            throw new IllegalArgumentException("Mode must be OFF, SOFT, HARD or DEFAULT.");
        }
        employeeRepository.save(emp);
        return Map.of("employeeId", emp.getId(),
                "modeOverride", emp.getDeviceBindingMode() == null ? "DEFAULT" : emp.getDeviceBindingMode(),
                "effectiveMode", settings.effectiveMode(emp));
    }

    public String effectiveMode(User user) {
        return settings.effectiveMode(employeeFor(user));
    }

    // =====================================================================
    // Crypto
    // =====================================================================

    /** SPKI (base64 or base64url) → EC P-256 public key. */
    static PublicKey parsePublicKey(String spki) {
        if (spki == null || spki.isBlank()) throw new IllegalArgumentException("Missing device public key.");
        try {
            byte[] der = decodeB64(spki.trim());
            PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(der));
            if (!(key instanceof ECPublicKey ec) || ec.getParams().getCurve().getField().getFieldSize() != 256) {
                throw new IllegalArgumentException("Device key must be ECDSA P-256.");
            }
            return key;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid device public key.");
        }
    }

    /** ECDSA/SHA-256 over the nonce's UTF-8 bytes; accepts raw r||s (WebCrypto) or DER. */
    static boolean verifySignature(PublicKey key, String nonce, String signatureB64) {
        if (nonce == null || signatureB64 == null) return false;
        try {
            byte[] sig = decodeB64(signatureB64.trim());
            Signature v = Signature.getInstance(sig.length == 64 ? "SHA256withECDSAinP1363Format" : "SHA256withECDSA");
            v.initVerify(key);
            v.update(nonce.getBytes(StandardCharsets.UTF_8));
            return v.verify(sig);
        } catch (Exception e) {
            log.debug("Device signature check failed: {}", e.getMessage());
            return false;
        }
    }

    private boolean consumeChallenge(Long userId, String nonce) {
        ChallengeEntry c = challenges.remove(userId);
        if (c == null || nonce == null || System.currentTimeMillis() > c.expiresAt()) return false;
        return MessageDigest.isEqual(c.nonce().getBytes(StandardCharsets.UTF_8), nonce.trim().getBytes(StandardCharsets.UTF_8));
    }

    private void purgeExpired() {
        long now = System.currentTimeMillis();
        challenges.entrySet().removeIf(e -> e.getValue().expiresAt() < now);
    }

    private static byte[] decodeB64(String s) {
        String std = s.replace('-', '+').replace('_', '/');
        int pad = (4 - std.length() % 4) % 4;
        return Base64.getDecoder().decode(std + "=".repeat(pad));
    }

    private static String sha256Hex(String s) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private Employee employeeFor(User user) {
        if (user == null || user.getEmail() == null) return null;
        return employeeRepository.findByEmailIgnoreCaseAndIsDeletedFalse(user.getEmail()).orElse(null);
    }

    private UserDevice requireDevice(Long id) {
        return deviceRepository.findById(id).filter(d -> !Boolean.TRUE.equals(d.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Device not found."));
    }

    private void close(UserDevice d, String status, String actor, String reason) {
        d.setStatus(status);
        d.setRevokedAt(LocalDateTime.now());
        d.setRevokedBy(actor);
        d.setRevokeReason(clip(reason, 255));
        deviceRepository.save(d);
    }

    private void touch(UserDevice d, String ip) {
        d.setLastSeenAt(LocalDateTime.now());
        if (ip != null) d.setLastIp(clip(ip, 64));
    }

    private void event(Long deviceId, Long userId, String type, String actor, String ip, String details) {
        UserDeviceEvent e = new UserDeviceEvent();
        e.setDeviceId(deviceId);
        e.setUserId(userId);
        e.setEvent(type);
        e.setActor(actor);
        e.setIp(clip(ip, 64));
        e.setDetails(clip(details, 1000));
        eventRepository.save(e);
    }

    private void notifyUser(User user, String title, String message) {
        try {
            notificationService.dispatch(title, message, "ATTENDANCE", user.getId(), "/employee");
        } catch (Exception e) {
            log.warn("Could not notify user {} about device change: {}", user.getId(), e.getMessage());
        }
    }

    private Map<String, Object> view(UserDevice d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId());
        m.put("deviceUuid", d.getDeviceUuid());
        m.put("deviceLabel", d.getDeviceLabel());
        m.put("platform", d.getPlatform());
        m.put("status", d.getStatus());
        m.put("requestReason", d.getRequestReason());
        m.put("requestedAt", d.getRequestedAt());
        m.put("approvedBy", d.getApprovedBy());
        m.put("approvedAt", d.getApprovedAt());
        m.put("revokedAt", d.getRevokedAt());
        m.put("revokeReason", d.getRevokeReason());
        m.put("lastSeenAt", d.getLastSeenAt());
        return m;
    }

    private Map<String, Object> adminView(UserDevice d) {
        Map<String, Object> m = view(d);
        User u = d.getUser();
        m.put("userId", u.getId());
        m.put("userName", displayName(u));
        m.put("userEmail", u.getEmail());
        m.put("employeeId", d.getEmployee() == null ? null : d.getEmployee().getId());
        m.put("userAgent", d.getUserAgent());
        m.put("lastIp", d.getLastIp());
        return m;
    }

    private Map<String, Object> eventView(UserDeviceEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId());
        m.put("deviceId", e.getDeviceId());
        m.put("event", e.getEvent());
        m.put("actor", e.getActor());
        m.put("ip", e.getIp());
        m.put("details", e.getDetails());
        m.put("at", e.getCreatedAt());
        return m;
    }

    private static String displayName(User u) {
        return u.getName() != null && !u.getName().isBlank() ? u.getName() : u.getEmail();
    }

    /** Best-effort "Android · Chrome"-style label from a user agent. */
    static String labelOf(String ua) {
        if (ua == null || ua.isBlank()) return "Unknown phone";
        String os = platformOf(ua);
        String browser = ua.contains("SamsungBrowser") ? "Samsung Internet"
                : ua.contains("EdgA") || ua.contains("Edg/") ? "Edge"
                : ua.contains("FxiOS") || ua.contains("Firefox") ? "Firefox"
                : ua.contains("CriOS") || ua.contains("Chrome") ? "Chrome"
                : ua.contains("Safari") ? "Safari" : "Browser";
        return os + " · " + browser;
    }

    static String platformOf(String ua) {
        if (ua == null) return null;
        if (ua.contains("Android")) return "Android";
        if (ua.contains("iPhone") || ua.contains("iPad") || ua.contains("iPod")) return "iOS";
        if (ua.contains("Windows")) return "Windows";
        if (ua.contains("Mac OS")) return "macOS";
        if (ua.contains("Linux")) return "Linux";
        return "Other";
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String firstNonBlank(String a, String b) {
        return trim(a) != null ? a.trim() : b;
    }

    private static String clip(String s, int max) {
        return s == null ? null : (s.length() <= max ? s : s.substring(0, max));
    }
}

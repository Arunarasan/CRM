package com.arudra.crm.service;

import com.arudra.crm.entity.AttendanceKiosk;
import com.arudra.crm.entity.AttendanceLocation;
import com.arudra.crm.repository.AttendanceKioskRepository;
import com.arudra.crm.repository.AttendanceLocationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.Base64;
import java.util.Deque;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Office kiosk registration. HR creates a kiosk and gets a one-time pairing code; the phone trades
 * that code for a long-lived token ({@link #pair}) and from then on sends it as {@code X-Kiosk-Token}
 * ({@link #authenticate}). Re-pairing issues a new code and revokes the old token, so replacing the
 * phone is one click and a lost phone is cut off immediately.
 */
@Service
public class KioskService {

    /** How long a pairing code stays valid. */
    static final Duration PAIRING_TTL = Duration.ofHours(24);
    /** A kiosk counts as online when it was seen within this window. */
    static final Duration ONLINE_WINDOW = Duration.ofMinutes(2);
    /** Throttle for last-seen writes so a polling kiosk does not update its row on every request. */
    private static final Duration TOUCH_EVERY = Duration.ofSeconds(30);
    /** Max pairing attempts per IP per window (codes are short, so guessing must be slowed down). */
    private static final int MAX_PAIR_ATTEMPTS = 8;
    private static final Duration PAIR_WINDOW = Duration.ofMinutes(10);
    // No 0/O/1/I so the code reads cleanly off a screen.
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Deque<LocalDateTime>> pairAttempts = new ConcurrentHashMap<>();

    @Autowired private AttendanceKioskRepository kioskRepository;
    @Autowired private AttendanceLocationRepository locationRepository;

    // --- admin -------------------------------------------------------------

    public List<Map<String, Object>> list() {
        return kioskRepository.findByIsDeletedFalseOrderByNameAsc().stream().map(k -> view(k, null)).toList();
    }

    /** Creates a kiosk and returns it with its pairing code (shown to HR once). */
    @Transactional
    public Map<String, Object> create(String name, Long officeLocationId) {
        AttendanceKiosk k = new AttendanceKiosk();
        k.setName(cleanName(name));
        k.setOfficeLocation(location(officeLocationId));
        String code = issuePairingCode(k);
        return view(kioskRepository.save(k), code);
    }

    @Transactional
    public Map<String, Object> update(Long id, String name, Long officeLocationId, Boolean active, String verifyMode) {
        AttendanceKiosk k = require(id);
        if (name != null) k.setName(cleanName(name));
        k.setOfficeLocation(location(officeLocationId));
        if (active != null) k.setActive(active);
        if (verifyMode != null) k.setVerifyMode(cleanMode(verifyMode));
        return view(kioskRepository.save(k), null);
    }

    /** New pairing code; the current phone's token stops working right away. */
    @Transactional
    public Map<String, Object> repair(Long id) {
        AttendanceKiosk k = require(id);
        k.setTokenHash(null);
        k.setPairedAt(null);
        k.setDeviceInfo(null);
        String code = issuePairingCode(k);
        return view(kioskRepository.save(k), code);
    }

    @Transactional
    public void delete(Long id) {
        AttendanceKiosk k = require(id);
        k.setIsDeleted(true);
        k.setDeletedAt(LocalDateTime.now());
        k.setActive(false);
        k.setTokenHash(null);
        k.setPairingCodeHash(null);
        kioskRepository.save(k);
    }

    // --- the kiosk phone ---------------------------------------------------

    /** Trades a pairing code for the kiosk's token. The token is returned only here, never stored in clear. */
    @Transactional
    public Map<String, Object> pair(String code, String deviceInfo, String ip) {
        throttle(ip);
        String normalized = code == null ? "" : code.replaceAll("[\\s-]", "").toUpperCase();
        AttendanceKiosk k = normalized.isEmpty() ? null
                : kioskRepository.findByPairingCodeHashAndIsDeletedFalse(sha256(normalized)).orElse(null);
        if (k == null || k.getPairingExpiresAt() == null || k.getPairingExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That code is wrong or has expired. Ask HR for a new one.");
        }
        if (!Boolean.TRUE.equals(k.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This kiosk is switched off.");
        }
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        k.setTokenHash(sha256(token));
        k.setPairingCodeHash(null); // single use
        k.setPairingExpiresAt(null);
        k.setPairedAt(LocalDateTime.now());
        k.setDeviceInfo(clip(deviceInfo, 255));
        k.setLastSeenAt(LocalDateTime.now());
        k.setLastIp(clip(ip, 64));
        kioskRepository.save(k);
        Map<String, Object> out = new LinkedHashMap<>(me(k));
        out.put("token", token);
        return out;
    }

    /** Resolves the kiosk behind a token or throws 401. Records last-seen (throttled). */
    @Transactional
    public AttendanceKiosk authenticate(String token, String ip) {
        if (token == null || token.isBlank()) throw unauthorized();
        AttendanceKiosk k = kioskRepository.findByTokenHashAndIsDeletedFalse(sha256(token.trim()))
                .orElseThrow(KioskService::unauthorized);
        if (!Boolean.TRUE.equals(k.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This kiosk is switched off.");
        }
        LocalDateTime now = LocalDateTime.now();
        if (k.getLastSeenAt() == null || Duration.between(k.getLastSeenAt(), now).compareTo(TOUCH_EVERY) > 0) {
            k.setLastSeenAt(now);
            k.setLastIp(clip(ip, 64));
            k = kioskRepository.save(k);
        }
        return k;
    }

    public Map<String, Object> me(AttendanceKiosk k) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", k.getId());
        m.put("name", k.getName());
        AttendanceLocation loc = k.getOfficeLocation();
        m.put("officeLocationId", loc == null ? null : loc.getId());
        m.put("officeLocationName", loc == null ? null : loc.getName());
        m.put("verifyMode", k.getVerifyMode());
        m.put("serverTime", LocalDateTime.now().toString());
        return m;
    }

    // --- helpers -----------------------------------------------------------

    private Map<String, Object> view(AttendanceKiosk k, String pairingCode) {
        LocalDateTime now = LocalDateTime.now();
        boolean paired = k.getTokenHash() != null;
        boolean codeLive = k.getPairingCodeHash() != null && k.getPairingExpiresAt() != null && k.getPairingExpiresAt().isAfter(now);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", k.getId());
        m.put("name", k.getName());
        AttendanceLocation loc = k.getOfficeLocation();
        m.put("officeLocationId", loc == null ? null : loc.getId());
        m.put("officeLocationName", loc == null ? null : loc.getName());
        m.put("active", Boolean.TRUE.equals(k.getActive()));
        m.put("verifyMode", k.getVerifyMode());
        m.put("paired", paired);
        m.put("pairedAt", k.getPairedAt());
        m.put("deviceInfo", k.getDeviceInfo());
        m.put("lastSeenAt", k.getLastSeenAt());
        m.put("lastIp", k.getLastIp());
        m.put("online", paired && k.getLastSeenAt() != null
                && Duration.between(k.getLastSeenAt(), now).compareTo(ONLINE_WINDOW) <= 0);
        m.put("waitingForPairing", !paired && codeLive);
        m.put("pairingExpiresAt", codeLive ? k.getPairingExpiresAt() : null);
        m.put("pairingCode", pairingCode); // only on create / re-pair
        return m;
    }

    private String issuePairingCode(AttendanceKiosk k) {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            String code = sb.toString();
            String hash = sha256(code);
            if (kioskRepository.findByPairingCodeHashAndIsDeletedFalse(hash).isEmpty()) {
                k.setPairingCodeHash(hash);
                k.setPairingExpiresAt(LocalDateTime.now().plus(PAIRING_TTL));
                return code.substring(0, 4) + "-" + code.substring(4);
            }
        }
        throw new IllegalStateException("Could not generate a pairing code, please try again.");
    }

    private AttendanceKiosk require(Long id) {
        return kioskRepository.findById(id).filter(k -> !Boolean.TRUE.equals(k.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Kiosk not found."));
    }

    private AttendanceLocation location(Long id) {
        if (id == null) return null;
        return locationRepository.findById(id).filter(l -> !Boolean.TRUE.equals(l.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Office location not found."));
    }

    private static String cleanMode(String mode) {
        String m = mode.trim().toUpperCase();
        if (!m.equals("FACE") && !m.equals("FINGER") && !m.equals("EITHER")) throw new IllegalArgumentException("Choose Face, Fingerprint or Either.");
        return m;
    }

    private static String cleanName(String name) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) throw new IllegalArgumentException("Give the kiosk a name, e.g. Front desk.");
        return clip(n, 150);
    }

    private void throttle(String ip) {
        String key = ip == null ? "?" : ip;
        LocalDateTime now = LocalDateTime.now();
        Deque<LocalDateTime> q = pairAttempts.computeIfAbsent(key, x -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst().isBefore(now.minus(PAIR_WINDOW))) q.pollFirst();
            if (q.size() >= MAX_PAIR_ATTEMPTS) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Wait a few minutes and try again.");
            }
            q.addLast(now);
        }
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "This kiosk is not paired. Pair it again with a new code.");
    }

    static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String clip(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}

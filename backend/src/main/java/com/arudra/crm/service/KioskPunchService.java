package com.arudra.crm.service;

import com.arudra.crm.entity.AttendanceKiosk;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeFaceTemplate;
import com.arudra.crm.repository.EmployeeFaceTemplateRepository;
import com.arudra.crm.storage.StorageService;
import com.arudra.crm.storage.StoredFile;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * An office kiosk punch: the kiosk sends the live face descriptor plus a selfie, and the SERVER
 * identifies who it is (1:N against the enrolled templates) and records the punch, so a tampered
 * browser can only ever claim a face, never an employee. The punch is either a check-in or a
 * check-out, chosen on the kiosk screen; a mismatch with the employee's state (checking in while
 * already in, checking out while not in) is reported back and records nothing.
 */
@Service
public class KioskPunchService {

    private static final Logger log = LoggerFactory.getLogger(KioskPunchService.class);

    /** Failed identifications allowed per kiosk per window, so a stolen token can't brute-force faces. */
    private static final int MAX_FAILURES = 12;
    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(1);
    private static final long MAX_SELFIE_BYTES = 3L * 1024 * 1024;
    private static final Set<String> SELFIE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<Long, Deque<LocalDateTime>> failures = new ConcurrentHashMap<>();
    /**
     * Parsed descriptors by template id. A template row is never edited (re-enrolling inserts new rows),
     * so an entry can't go stale; employee status is still read live from the database on every punch.
     */
    private final Map<Long, double[]> parsedCache = new ConcurrentHashMap<>();
    private static final int MAX_CACHED_TEMPLATES = 20000;

    private double[] parsedDescriptor(EmployeeFaceTemplate t) {
        Long id = t.getId();
        if (id == null) return parse(t.getDescriptor());
        double[] cached = parsedCache.get(id);
        if (cached != null) return cached;
        double[] d = parse(t.getDescriptor());
        if (d != null) {
            if (parsedCache.size() >= MAX_CACHED_TEMPLATES) parsedCache.clear();
            parsedCache.put(id, d);
        }
        return d;
    }

    @Autowired private EmployeeFaceTemplateRepository templateRepository;
    @Autowired private EmployeeTimeService timeService;
    @Autowired private StorageService storageService;
    @Autowired private FingerprintService fingerprintService;
    @Autowired private com.arudra.crm.repository.EmployeeRepository employeeRepository;

    /**
     * @param action     IN or OUT
     * @param descriptor JSON array of 128 numbers from the kiosk's face engine
     * @param liveness   the liveness challenge the kiosk says the person passed (BLINK | TURN), or null
     */
    public Map<String, Object> punch(AttendanceKiosk kiosk, String action, String descriptor, String liveness,
                                     byte[] selfie, String selfieType) {
        boolean checkIn = parseAction(action);
        requireMode(kiosk, "FACE");
        double[] live = parse(descriptor);
        if (live == null) throw new IllegalArgumentException("Invalid face capture. Try again.");
        throttleCheck(kiosk.getId());

        List<FaceMatcher.Sample> samples = new ArrayList<>();
        Map<Long, Employee> employees = new LinkedHashMap<>();
        for (EmployeeFaceTemplate t : templateRepository.findAllActive()) {
            Employee e = t.getEmployee();
            if (e == null || !"ACTIVE".equalsIgnoreCase(e.getStatus())) continue; // on leave / terminated can't punch
            double[] d = parsedDescriptor(t);
            if (d == null) continue;
            employees.put(e.getId(), e);
            samples.add(new FaceMatcher.Sample(e.getId(), d));
        }

        FaceMatcher.Result match = FaceMatcher.identify(live, samples);
        if (!match.matched()) {
            recordFailure(kiosk.getId());
            log.info("Kiosk {} punch not matched: {} (best distance {})", kiosk.getId(), match.verdict(), match.distance());
            return outcome(match.verdict() == FaceMatcher.Verdict.AMBIGUOUS ? "AMBIGUOUS" : "NOT_RECOGNISED", null, null, null, null, null);
        }

        Employee employee = employees.get(match.employeeId());
        boolean weak = match.verdict() == FaceMatcher.Verdict.WEAK;
        String cleanLiveness = liveness == null ? null : liveness.trim().toUpperCase();
        if (cleanLiveness != null && !cleanLiveness.equals("BLINK") && !cleanLiveness.equals("TURN")) cleanLiveness = null;
        return record(kiosk, checkIn, employee, "FACE", match.distance(), weak, cleanLiveness, selfie, selfieType);
    }

    /**
     * A fingerprint punch: the sensor's capture from the kiosk app. The server builds a template and
     * identifies the employee itself (1:N); the selfie is only evidence, it is not matched.
     */
    public Map<String, Object> punchFinger(AttendanceKiosk kiosk, String action, FingerprintService.Capture capture,
                                           byte[] selfie, String selfieType) {
        boolean checkIn = parseAction(action);
        requireMode(kiosk, "FINGER");
        throttleCheck(kiosk.getId());

        FingerprintPolicy.Decision d = fingerprintService.identify(capture);
        if (!d.matched()) {
            recordFailure(kiosk.getId());
            log.info("Kiosk {} fingerprint not matched: {} (best score {})", kiosk.getId(), d.verdict(), d.score());
            return outcome(d.verdict() == FingerprintPolicy.Verdict.AMBIGUOUS ? "AMBIGUOUS" : "NOT_RECOGNISED", null, null, null, null, null);
        }
        Employee employee = employeeRepository.findById(d.employeeId()).orElse(null);
        if (employee == null || !"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            recordFailure(kiosk.getId());
            return outcome("NOT_RECOGNISED", null, null, null, null, null);
        }
        return record(kiosk, checkIn, employee, "FINGER", d.score(), d.verdict() == FingerprintPolicy.Verdict.WEAK, null, selfie, selfieType);
    }

    /**
     * Fallback when the face / fingerprint cannot be read: the person types their employee ID or phone
     * number and the kiosk takes a photo. The punch is ALWAYS recorded as flagged / pending so an admin
     * checks the photo before it counts. A photo is required.
     */
    public Map<String, Object> punchManual(AttendanceKiosk kiosk, String action, String identifier, byte[] selfie, String selfieType) {
        boolean checkIn = parseAction(action);
        if (selfie == null || selfie.length == 0) throw new IllegalArgumentException("Take a photo first.");
        String id = identifier == null ? "" : identifier.trim();
        if (id.length() < 3) throw new IllegalArgumentException("Enter your employee ID or phone number.");
        throttleCheck(kiosk.getId());

        Employee employee = findByIdOrPhone(id);
        if (employee == null) {
            recordFailure(kiosk.getId());
            log.info("Kiosk {} manual punch: no unique active employee for '{}'", kiosk.getId(), id.replaceAll("\\d(?=\\d{3})", "*"));
            return outcome("NOT_FOUND", null, null, null, null, null);
        }
        return record(kiosk, checkIn, employee, EmployeeTimeService.KIOSK_MANUAL, Double.NaN, true, null, selfie, selfieType);
    }

    /** An active employee matched by employee code, or by phone (last 10 digits); null if none or more than one. */
    private Employee findByIdOrPhone(String id) {
        List<Employee> byCode = employeeRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalse(id).stream()
                .filter(e -> "ACTIVE".equalsIgnoreCase(e.getStatus())).toList();
        if (byCode.size() == 1) return byCode.get(0);
        String digits = id.replaceAll("\\D", "");
        if (digits.length() < 10) return null;
        String tail = digits.substring(digits.length() - 10);
        List<Employee> byPhone = employeeRepository.findByPhoneIsNotNullAndIsDeletedFalse().stream()
                .filter(e -> "ACTIVE".equalsIgnoreCase(e.getStatus()))
                .filter(e -> {
                    String p = e.getPhone().replaceAll("\\D", "");
                    return p.length() >= 10 && p.substring(p.length() - 10).equals(tail);
                }).toList();
        return byPhone.size() == 1 ? byPhone.get(0) : null;
    }

    /** Records the identified employee's punch and builds the reply. */
    private Map<String, Object> record(AttendanceKiosk kiosk, boolean checkIn, Employee employee, String method, double value,
                                       boolean weak, String liveness, byte[] selfie, String selfieType) {
        // The selfie upload (a remote bucket, ~1 s) must not hold up the reply: the punch is recorded first
        // and the photo is attached in the background. No orphan files for "already checked in" etc.
        EmployeeTimeService.KioskPunchOutcome res = timeService.kioskPunch(employee, kiosk, checkIn, method,
                value, weak, () -> null, liveness);
        String selfieUrl = null;
        if (res.sessionId() != null && selfie != null && selfie.length > 0) {
            Long sid = res.sessionId();
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                String url = storeSelfie(selfie, selfieType);
                if (url != null) timeService.attachKioskSelfie(sid, checkIn, url);
            });
        }
        log.info("Kiosk {} {} employee={} method={} outcome={} value={} weak={} liveness={}", kiosk.getId(), checkIn ? "IN" : "OUT",
                employee.getId(), method, res.outcome(), String.format(java.util.Locale.ROOT, "%.3f", value), weak, liveness);
        boolean recorded = res.outcome().equals("CHECKED_IN") || res.outcome().equals("CHECKED_OUT");
        return outcome(res.outcome(), employee, res.time() == null ? null : res.time().toString(),
                res.minutesWorked(), recorded ? selfieUrl : null, recorded && weak);
    }

    private static boolean parseAction(String action) {
        return switch (action == null ? "" : action.trim().toUpperCase()) {
            case "IN" -> true;
            case "OUT" -> false;
            default -> throw new IllegalArgumentException("Choose Check In or Check Out.");
        };
    }

    /** A kiosk set to FACE refuses fingerprints and the other way round; EITHER accepts both. */
    private static void requireMode(AttendanceKiosk kiosk, String method) {
        String mode = kiosk.getVerifyMode() == null ? "FACE" : kiosk.getVerifyMode();
        if (!mode.equals("EITHER") && !mode.equals(method)) {
            throw new IllegalArgumentException(method.equals("FACE")
                    ? "This kiosk checks fingerprints, not faces." : "This kiosk checks faces, not fingerprints.");
        }
    }

    // --- helpers -----------------------------------------------------------

    private Map<String, Object> outcome(String outcome, Employee e, String time, Long minutesWorked, String selfieUrl, Boolean needsApproval) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("outcome", outcome);
        if (e != null) {
            m.put("employeeId", e.getId());
            m.put("name", ((e.getFirstName() == null ? "" : e.getFirstName()) + " " + (e.getLastName() == null ? "" : e.getLastName())).trim());
            m.put("employeeCode", e.getEmployeeCode());
        }
        m.put("time", time);
        m.put("minutesWorked", minutesWorked);
        m.put("selfieUrl", selfieUrl);
        m.put("needsApproval", Boolean.TRUE.equals(needsApproval));
        return m;
    }

    /** A selfie that can't be stored never blocks the punch, it just leaves no photo evidence. */
    private String storeSelfie(byte[] bytes, String contentType) {
        if (bytes == null || bytes.length == 0) return null;
        if (bytes.length > MAX_SELFIE_BYTES || contentType == null || !SELFIE_TYPES.contains(contentType.toLowerCase())) return null;
        try {
            StoredFile f = storageService.store(bytes, contentType.toLowerCase(), "KIOSK", "kiosk-selfie.jpg");
            return f.fileUrl();
        } catch (Exception e) {
            log.warn("Kiosk selfie could not be stored: {}", e.getMessage());
            return null;
        }
    }

    private double[] parse(String json) {
        if (json == null || json.isBlank()) throw new IllegalArgumentException("No face captured. Try again.");
        try {
            double[] v = mapper.readValue(json, double[].class);
            if (v.length != FaceTemplateService.DESCRIPTOR_SIZE) throw new IllegalArgumentException("Invalid face capture. Try again.");
            for (double d : v) {
                if (Double.isNaN(d) || Double.isInfinite(d) || Math.abs(d) > 10) throw new IllegalArgumentException("Invalid face capture. Try again.");
            }
            return v;
        } catch (JsonProcessingException e) {
            return null; // unreadable input: callers skip a stored template, and reject a live capture
        }
    }

    private void throttleCheck(Long kioskId) {
        Deque<LocalDateTime> q = failures.get(kioskId);
        if (q == null) return;
        synchronized (q) {
            prune(q);
            if (q.size() >= MAX_FAILURES) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Wait a minute and try again.");
            }
        }
    }

    private void recordFailure(Long kioskId) {
        Deque<LocalDateTime> q = failures.computeIfAbsent(kioskId, k -> new ArrayDeque<>());
        synchronized (q) {
            prune(q);
            q.addLast(LocalDateTime.now());
        }
    }

    private static void prune(Deque<LocalDateTime> q) {
        LocalDateTime cutoff = LocalDateTime.now().minus(FAILURE_WINDOW);
        while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) q.pollFirst();
    }
}

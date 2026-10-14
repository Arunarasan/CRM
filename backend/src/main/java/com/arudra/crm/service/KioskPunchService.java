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

    @Autowired private EmployeeFaceTemplateRepository templateRepository;
    @Autowired private EmployeeTimeService timeService;
    @Autowired private StorageService storageService;

    /**
     * @param action     IN or OUT
     * @param descriptor JSON array of 128 numbers from the kiosk's face engine
     * @param liveness   the liveness challenge the kiosk says the person passed (BLINK | TURN), or null
     */
    public Map<String, Object> punch(AttendanceKiosk kiosk, String action, String descriptor, String liveness,
                                     byte[] selfie, String selfieType) {
        boolean checkIn = switch (action == null ? "" : action.trim().toUpperCase()) {
            case "IN" -> true;
            case "OUT" -> false;
            default -> throw new IllegalArgumentException("Choose Check In or Check Out.");
        };
        double[] live = parse(descriptor);
        if (live == null) throw new IllegalArgumentException("Invalid face capture. Try again.");
        throttleCheck(kiosk.getId());

        List<FaceMatcher.Sample> samples = new ArrayList<>();
        Map<Long, Employee> employees = new LinkedHashMap<>();
        for (EmployeeFaceTemplate t : templateRepository.findAllActive()) {
            Employee e = t.getEmployee();
            if (e == null || !"ACTIVE".equalsIgnoreCase(e.getStatus())) continue; // on leave / terminated can't punch
            double[] d = parse(t.getDescriptor());
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

        // The selfie is stored only if the punch is recorded (no orphan files for "already checked in" etc.).
        String[] stored = new String[1];
        EmployeeTimeService.KioskPunchOutcome res = timeService.kioskPunch(employee, kiosk, checkIn,
                match.distance(), weak, () -> stored[0] = storeSelfie(selfie, selfieType), cleanLiveness);
        String selfieUrl = stored[0];
        log.info("Kiosk {} {} employee={} outcome={} distance={} weak={} liveness={}", kiosk.getId(), checkIn ? "IN" : "OUT",
                employee.getId(), res.outcome(), String.format(java.util.Locale.ROOT, "%.3f", match.distance()), weak, cleanLiveness);
        boolean recorded = res.outcome().equals("CHECKED_IN") || res.outcome().equals("CHECKED_OUT");
        return outcome(res.outcome(), employee, res.time() == null ? null : res.time().toString(),
                res.minutesWorked(), recorded ? selfieUrl : null, recorded && weak);
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

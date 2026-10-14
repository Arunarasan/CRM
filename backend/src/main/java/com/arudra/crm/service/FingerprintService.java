package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeFingerprint;
import com.arudra.crm.repository.EmployeeFingerprintRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.machinezoo.sourceafis.FingerprintCompatibility;
import com.machinezoo.sourceafis.FingerprintImage;
import com.machinezoo.sourceafis.FingerprintImageOptions;
import com.machinezoo.sourceafis.FingerprintMatcher;
import com.machinezoo.sourceafis.FingerprintTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fingerprint enrolment and identification for the office kiosk, on SourceAFIS. The kiosk phone's
 * sensor hands over an image (or an ISO template); the server builds a template, and never stores the
 * image. Templates are tied to the SourceAFIS version that built them ({@code engine_version}); the
 * version is pinned in the pom and employees are re-enrolled if it is ever upgraded.
 */
@Service
public class FingerprintService {

    private static final Logger log = LoggerFactory.getLogger(FingerprintService.class);

    static final int MIN_SCANS = 2;
    static final int MAX_SCANS = 4;
    /** Two scans of the same finger must score at least this against each other. */
    static final double SELF_MATCH_MIN = 40;
    /** A finger scoring at least this against another employee's template already belongs to them. */
    static final double DUPLICATE_MIN = FingerprintPolicy.ACCEPT_MIN;
    /** A template smaller than this has almost no ridge detail (blank, faint or badly partial scans give about 84 bytes, a clean one 200+). Calibrate with real scans. */
    static final int MIN_TEMPLATE_BYTES = 150;
    static final double DEFAULT_DPI = 500;
    private static final int MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    private static final int MAX_SIDE = 2000;
    /** How long the in-memory template cache is trusted before it is reloaded. */
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    private static final Map<Integer, String> FINGER_NAMES = Map.of(
            1, "Right thumb", 2, "Right index", 3, "Right middle", 4, "Right ring", 5, "Right little",
            6, "Left thumb", 7, "Left index", 8, "Left middle", 9, "Left ring", 10, "Left little");

    /** One image or template from the sensor, as sent by the kiosk app. */
    public record Capture(String format, Integer width, Integer height, Double dpi, String data) {}

    private record CachedTemplate(long employeeId, FingerprintTemplate template) {}

    @Autowired private EmployeeFingerprintRepository fingerprintRepository;
    @Autowired private EmployeeRepository employeeRepository;

    private volatile List<CachedTemplate> cache;
    private volatile LocalDateTime cacheLoadedAt;

    // --- queries -----------------------------------------------------------

    public Map<String, Object> status(Long employeeId) {
        requireEmployee(employeeId);
        return statusOf(fingerprintRepository.findByEmployeeIdOrderByFingerAscSampleNoAsc(employeeId));
    }

    /** Enrolled employees only: employeeId -> {fingers, enrolledAt}. */
    public Map<Long, Map<String, Object>> summary() {
        Map<Long, Map<String, Object>> out = new LinkedHashMap<>();
        for (Object[] r : fingerprintRepository.summary()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fingers", ((Number) r[1]).intValue());
            m.put("enrolledAt", r[2]);
            out.put(((Number) r[0]).longValue(), m);
        }
        return out;
    }

    // --- enrol / remove ----------------------------------------------------

    /** Replaces one finger's samples with the given scans. Needs the employee's consent. */
    @Transactional
    public Map<String, Object> enroll(Long employeeId, int finger, List<Capture> captures, boolean consent, String enrolledBy) {
        if (!consent) throw new IllegalArgumentException("The employee must agree to fingerprint enrolment first.");
        if (!FINGER_NAMES.containsKey(finger)) throw new IllegalArgumentException("Choose a finger.");
        if (captures == null || captures.size() < MIN_SCANS || captures.size() > MAX_SCANS) {
            throw new IllegalArgumentException("Scan the same finger " + MIN_SCANS + " to " + MAX_SCANS + " times.");
        }
        Employee employee = requireEmployee(employeeId);

        List<FingerprintTemplate> templates = new ArrayList<>();
        for (Capture c : captures) templates.add(toTemplate(c));

        // Every scan must be the same finger as the first.
        FingerprintMatcher first = new FingerprintMatcher(templates.get(0));
        for (int i = 1; i < templates.size(); i++) {
            if (first.match(templates.get(i)) < SELF_MATCH_MIN) {
                throw new IllegalArgumentException(
                        "The scans do not match each other. Place the same finger flat, the same way, each time.");
            }
        }

        // The finger must not already belong to someone else.
        for (EmployeeFingerprint other : fingerprintRepository.findAllExcept(employeeId)) {
            FingerprintTemplate ot = deserialize(other.getTemplate());
            if (ot == null) continue;
            for (FingerprintTemplate t : templates) {
                if (new FingerprintMatcher(t).match(ot) >= DUPLICATE_MIN) {
                    Employee o = other.getEmployee();
                    String who = (nz(o.getFirstName()) + " " + nz(o.getLastName())).trim();
                    throw new IllegalArgumentException("This fingerprint already belongs to " + (who.isEmpty() ? "another employee" : who)
                            + ". Check you picked the right employee.");
                }
            }
        }

        fingerprintRepository.deleteFinger(employeeId, finger);
        fingerprintRepository.flush();
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < templates.size(); i++) {
            EmployeeFingerprint f = new EmployeeFingerprint();
            f.setEmployee(employee);
            f.setFinger(finger);
            f.setSampleNo(i + 1);
            f.setTemplate(templates.get(i).toByteArray());
            f.setEngineVersion(FingerprintCompatibility.version());
            f.setConsentAt(now);
            f.setEnrolledBy(enrolledBy);
            fingerprintRepository.save(f);
        }
        invalidate();
        return statusOf(fingerprintRepository.findByEmployeeIdOrderByFingerAscSampleNoAsc(employeeId));
    }

    /** Removes one finger, or all of the employee's fingerprints when {@code finger} is null. */
    @Transactional
    public void remove(Long employeeId, Integer finger) {
        requireEmployee(employeeId);
        if (finger == null) fingerprintRepository.deleteAllForEmployee(employeeId);
        else fingerprintRepository.deleteFinger(employeeId, finger);
        invalidate();
    }

    // --- identification ----------------------------------------------------

    /** Builds the probe from the capture and decides who it is; throws IllegalArgumentException on an unreadable capture. */
    public FingerprintPolicy.Decision identify(Capture capture) {
        FingerprintTemplate probe = toTemplate(capture);
        FingerprintMatcher matcher = new FingerprintMatcher(probe);
        Map<Long, Double> best = new HashMap<>();
        for (CachedTemplate c : templates()) {
            best.merge(c.employeeId(), matcher.match(c.template()), Math::max);
        }
        return FingerprintPolicy.decide(best);
    }

    // --- helpers -----------------------------------------------------------

    /** Image (PNG/JPEG/BMP bytes), raw 8-bit grayscale (RAW + width + height) or an ISO 19794-2 template. */
    FingerprintTemplate toTemplate(Capture c) {
        if (c == null || c.data() == null || c.data().isBlank()) throw new IllegalArgumentException("No fingerprint captured. Try again.");
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(c.data().trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid fingerprint capture. Try again.");
        }
        if (bytes.length == 0 || bytes.length > MAX_IMAGE_BYTES) throw new IllegalArgumentException("Invalid fingerprint capture. Try again.");

        String format = c.format() == null ? "PNG" : c.format().trim().toUpperCase();
        double dpi = c.dpi() == null ? DEFAULT_DPI : Math.max(300, Math.min(1000, c.dpi()));
        int rawWidth = c.width() == null ? 0 : c.width();
        int rawHeight = c.height() == null ? 0 : c.height();
        if (format.equals("RAW") && (rawWidth < 50 || rawHeight < 50 || rawWidth > MAX_SIDE || rawHeight > MAX_SIDE
                || (long) rawWidth * rawHeight != bytes.length)) {
            throw new IllegalArgumentException("Invalid fingerprint capture. Try again.");
        }
        FingerprintTemplate template;
        try {
            switch (format) {
                case "ISO" -> template = FingerprintCompatibility.importTemplate(bytes);
                case "RAW" -> template = new FingerprintTemplate(
                        new FingerprintImage(rawWidth, rawHeight, bytes, new FingerprintImageOptions().dpi(dpi)));
                default -> template = new FingerprintTemplate(new FingerprintImage(bytes, new FingerprintImageOptions().dpi(dpi)));
            }
        } catch (RuntimeException e) {
            // SourceAFIS messages are technical; the person at the kiosk gets a plain one.
            log.info("Fingerprint capture ({}) could not be read: {}", format, e.toString());
            throw new IllegalArgumentException("Could not read the fingerprint. Press the finger flat on the sensor and try again.");
        }
        if (template.toByteArray().length < MIN_TEMPLATE_BYTES) {
            throw new IllegalArgumentException("The fingerprint is too faint. Press the finger flat on the sensor and try again.");
        }
        return template;
    }

    private List<CachedTemplate> templates() {
        List<CachedTemplate> c = cache;
        LocalDateTime at = cacheLoadedAt;
        if (c != null && at != null && Duration.between(at, LocalDateTime.now()).compareTo(CACHE_TTL) < 0) return c;
        synchronized (this) {
            List<CachedTemplate> loaded = new ArrayList<>();
            for (EmployeeFingerprint f : fingerprintRepository.findAllActive()) {
                Employee e = f.getEmployee();
                if (e == null || !"ACTIVE".equalsIgnoreCase(e.getStatus())) continue; // on leave / terminated can't punch
                FingerprintTemplate t = deserialize(f.getTemplate());
                if (t != null) loaded.add(new CachedTemplate(e.getId(), t));
            }
            cache = loaded;
            cacheLoadedAt = LocalDateTime.now();
            return loaded;
        }
    }

    private void invalidate() {
        cache = null;
        cacheLoadedAt = null;
    }

    private FingerprintTemplate deserialize(byte[] bytes) {
        try {
            return new FingerprintTemplate(bytes);
        } catch (RuntimeException e) {
            return null; // built by another engine version: needs re-enrolment
        }
    }

    private Map<String, Object> statusOf(List<EmployeeFingerprint> rows) {
        Map<Integer, Integer> perFinger = new java.util.TreeMap<>();
        for (EmployeeFingerprint f : rows) perFinger.merge(f.getFinger(), 1, Integer::sum);
        List<Map<String, Object>> fingers = new ArrayList<>();
        perFinger.forEach((finger, samples) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("finger", finger);
            m.put("name", FINGER_NAMES.getOrDefault(finger, "Finger " + finger));
            m.put("samples", samples);
            fingers.add(m);
        });
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enrolled", !rows.isEmpty());
        m.put("fingers", fingers);
        m.put("enrolledAt", rows.stream().map(EmployeeFingerprint::getCreatedAt).filter(d -> d != null).max(LocalDateTime::compareTo).orElse(null));
        m.put("consentAt", rows.stream().map(EmployeeFingerprint::getConsentAt).filter(d -> d != null).max(LocalDateTime::compareTo).orElse(null));
        m.put("enrolledBy", rows.isEmpty() ? null : rows.get(0).getEnrolledBy());
        return m;
    }

    private Employee requireEmployee(Long id) {
        return employeeRepository.findById(id).filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}

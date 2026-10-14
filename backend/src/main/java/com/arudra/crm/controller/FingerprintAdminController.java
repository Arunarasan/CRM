package com.arudra.crm.controller;

import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.FingerprintService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * HR enrolment of employee fingerprints for the office kiosk. The scans come from the sensor on the
 * kiosk phone (through the kiosk app), so this is only usable from a device that has one.
 */
@RestController
@RequestMapping("/api/hr/attendance/fingerprints")
@CrossOrigin(origins = "*")
public class FingerprintAdminController {

    private static final String HR_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired private FingerprintService fingerprintService;
    @Autowired private CurrentUserService currentUserService;

    /** Enrolled employees: employeeId -> {fingers, enrolledAt}. */
    @GetMapping
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<Long, Map<String, Object>>> summary() {
        return ResponseEntity.ok(fingerprintService.summary());
    }

    @GetMapping("/employees/{employeeId}")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> status(@PathVariable Long employeeId) {
        return ResponseEntity.ok(fingerprintService.status(employeeId));
    }

    /** Body: {consent: true, captures: [{format, width?, height?, dpi?, data}, ...]} for one finger. */
    @SuppressWarnings("unchecked")
    @PutMapping("/employees/{employeeId}/fingers/{finger}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> enroll(@PathVariable Long employeeId, @PathVariable int finger,
                                                      @RequestBody Map<String, Object> body) {
        boolean consent = Boolean.parseBoolean(String.valueOf(body.get("consent")));
        List<FingerprintService.Capture> captures = new ArrayList<>();
        Object raw = body.get("captures");
        if (raw instanceof List<?> list) {
            for (Object o : list) if (o instanceof Map<?, ?> m) captures.add(toCapture((Map<String, Object>) m));
        }
        String by = currentUserService.getCurrentUser().getEmail();
        return ResponseEntity.ok(fingerprintService.enroll(employeeId, finger, captures, consent, by));
    }

    @DeleteMapping("/employees/{employeeId}/fingers/{finger}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> removeFinger(@PathVariable Long employeeId, @PathVariable int finger) {
        fingerprintService.remove(employeeId, finger);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/employees/{employeeId}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> remove(@PathVariable Long employeeId) {
        fingerprintService.remove(employeeId, null);
        return ResponseEntity.noContent().build();
    }

    /** Parses the {@code capture} JSON the kiosk app sends with a fingerprint punch. */
    @SuppressWarnings("unchecked")
    static FingerprintService.Capture parseCapture(String json) {
        try {
            return toCapture(MAPPER.readValue(json, Map.class));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid fingerprint capture. Try again.");
        }
    }

    private static FingerprintService.Capture toCapture(Map<String, Object> m) {
        return new FingerprintService.Capture(
                m.get("format") == null ? null : String.valueOf(m.get("format")),
                num(m.get("width")), num(m.get("height")),
                m.get("dpi") instanceof Number n ? n.doubleValue() : null,
                m.get("data") == null ? null : String.valueOf(m.get("data")));
    }

    private static Integer num(Object o) {
        return o instanceof Number n ? n.intValue() : null;
    }
}

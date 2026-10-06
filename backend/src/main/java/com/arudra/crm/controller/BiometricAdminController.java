package com.arudra.crm.controller;

import com.arudra.crm.service.BiometricService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * HR → Employees → Employee → Biometric. Enrollment is started here and completed on the chosen
 * terminal; the CRM only ever stores the template reference.
 */
@RestController
@RequestMapping("/api/hr/biometric")
public class BiometricAdminController {

    private static final String HR_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    private final BiometricService biometricService;

    public BiometricAdminController(BiometricService biometricService) {
        this.biometricService = biometricService;
    }

    public record EnrollRequest(Long employeeId, Long deviceId, String fingerPosition) {}

    public record RevokeRequest(String reason) {}

    @GetMapping("/{employeeId}/status")
    @PreAuthorize(HR_READ)
    public Map<String, Object> status(@PathVariable Long employeeId) {
        return biometricService.status(employeeId);
    }

    @PostMapping("/enroll")
    @PreAuthorize(HR_WRITE)
    public Map<String, Object> enroll(@RequestBody EnrollRequest req) {
        if (req == null || req.employeeId() == null) throw new IllegalArgumentException("employeeId is required.");
        if (req.deviceId() == null) throw new IllegalArgumentException("Select an attendance device.");
        return biometricService.startEnrollment(req.employeeId(), req.deviceId(), req.fingerPosition());
    }

    @GetMapping("/sessions/{id}")
    @PreAuthorize(HR_READ)
    public Map<String, Object> session(@PathVariable Long id) {
        return biometricService.session(id);
    }

    @PostMapping("/sessions/{id}/cancel")
    @PreAuthorize(HR_WRITE)
    public Map<String, Object> cancel(@PathVariable Long id) {
        return biometricService.cancelSession(id);
    }

    /** Removes all of the employee's biometric enrollments (terminals wipe the templates on next sync). */
    @DeleteMapping("/{employeeId}")
    @PreAuthorize(HR_WRITE)
    public Map<String, Object> revokeAll(@PathVariable Long employeeId, @RequestBody(required = false) RevokeRequest req) {
        int n = biometricService.revokeEmployee(employeeId, req == null ? null : req.reason());
        return Map.of("revoked", n);
    }

    @DeleteMapping("/enrollments/{biometricId}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> revokeOne(@PathVariable Long biometricId) {
        biometricService.revokeEnrollment(biometricId);
        return ResponseEntity.noContent().build();
    }
}

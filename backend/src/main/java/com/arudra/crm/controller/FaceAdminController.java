package com.arudra.crm.controller;

import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.FaceTemplateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** HR enrolment of employee faces for the office kiosk (capture happens in the browser). */
@RestController
@RequestMapping("/api/hr/attendance/faces")
@CrossOrigin(origins = "*")
public class FaceAdminController {

    private static final String HR_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    @Autowired private FaceTemplateService faceService;
    @Autowired private CurrentUserService currentUserService;

    /** Enrolled employees: employeeId -> {samples, enrolledAt}. */
    @GetMapping
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<Long, Map<String, Object>>> summary() {
        return ResponseEntity.ok(faceService.summary());
    }

    @GetMapping("/employees/{employeeId}")
    @PreAuthorize(HR_READ)
    public ResponseEntity<Map<String, Object>> status(@PathVariable Long employeeId) {
        return ResponseEntity.ok(faceService.status(employeeId));
    }

    @SuppressWarnings("unchecked")
    @PutMapping("/employees/{employeeId}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> enroll(@PathVariable Long employeeId, @RequestBody Map<String, Object> body) {
        List<List<Double>> descriptors = toDoubleLists((List<Object>) body.get("descriptors"));
        List<Double> qualities = body.get("qualities") == null ? null : toDoubles((List<Object>) body.get("qualities"));
        String photoUrl = body.get("photoUrl") == null ? null : String.valueOf(body.get("photoUrl"));
        String by = currentUserService.getCurrentUser().getEmail();
        return ResponseEntity.ok(faceService.enroll(employeeId, descriptors, qualities, photoUrl, by));
    }

    @DeleteMapping("/employees/{employeeId}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> remove(@PathVariable Long employeeId) {
        faceService.remove(employeeId);
        return ResponseEntity.noContent().build();
    }

    private static List<List<Double>> toDoubleLists(List<Object> raw) {
        if (raw == null) return null;
        return raw.stream().map(o -> o instanceof List<?> l ? toDoubles(new java.util.ArrayList<Object>(l)) : null).toList();
    }

    private static List<Double> toDoubles(List<Object> raw) {
        return raw.stream().map(o -> o instanceof Number n ? Double.valueOf(n.doubleValue()) : null).toList();
    }
}

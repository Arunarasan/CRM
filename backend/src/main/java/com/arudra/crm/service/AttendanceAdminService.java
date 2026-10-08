package com.arudra.crm.service;

import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.AttendanceLocation;
import com.arudra.crm.entity.AttendanceSession;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.repository.AttendanceLocationRepository;
import com.arudra.crm.repository.AttendanceSessionRepository;
import com.arudra.crm.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin side of attendance verification: managing office geofences and reviewing the clock-ins that
 * failed their auto-check (flagged PENDING). Approve/reject only resolves the review workflow — it
 * does not change worked-hours/earnings, which are computed from the clock times regardless.
 */
@Service
public class AttendanceAdminService {

    @Autowired private AttendanceLocationRepository locationRepository;
    @Autowired private AttendanceSessionRepository sessionRepository;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private EmployeeTimeService timeService;
    @Autowired private com.arudra.crm.repository.UserRepository userRepository;
    @Autowired private NotificationService notificationService;

    // --- office geofences --------------------------------------------------

    public List<AttendanceLocation> listLocations() {
        return locationRepository.findByIsDeletedFalseOrderByNameAsc();
    }

    @Transactional
    public AttendanceLocation saveLocation(AttendanceLocation body) {
        AttendanceLocation loc = body.getId() == null ? new AttendanceLocation()
                : locationRepository.findById(body.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Location not found."));
        loc.setName(body.getName());
        loc.setLatitude(body.getLatitude());
        loc.setLongitude(body.getLongitude());
        // Clamp the radius to a sane geofence range. A tiny radius is unusable; an absurdly large one
        // (e.g. 50000 m) would accept clock-ins from kilometres away, defeating the fence entirely.
        int radius = body.getRadiusMeters() == null ? 150 : body.getRadiusMeters();
        loc.setRadiusMeters(Math.max(20, Math.min(2000, radius)));
        loc.setAddress(body.getAddress());
        loc.setActive(body.getActive() == null ? Boolean.TRUE : body.getActive());
        return locationRepository.save(loc);
    }

    @Transactional
    public void deleteLocation(Long id) {
        locationRepository.findById(id).ifPresent(loc -> {
            loc.setIsDeleted(true);
            loc.setDeletedAt(LocalDateTime.now());
            locationRepository.save(loc);
        });
    }

    // --- flagged-clock-in review ------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPending() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (AttendanceSession s : sessionRepository.findByFlaggedTrueAndApprovalStatusOrderByIdDesc("PENDING")) {
            out.add(toReviewRow(s));
        }
        return out;
    }

    /** How many clock-ins are waiting for an admin — drives the menu badge. */
    @Transactional(readOnly = true)
    public long countPending() {
        return sessionRepository.countByFlaggedTrueAndApprovalStatus("PENDING");
    }

    @Transactional
    public Map<String, Object> resolve(Long sessionId, boolean approve, String username) {
        return resolve(sessionId, approve, username, null);
    }

    /**
     * Approve or reject a flagged session. The day's hours/earnings are recomputed straight away:
     * approved time starts counting toward pay, rejected time never does.
     */
    @Transactional
    public Map<String, Object> resolve(Long sessionId, boolean approve, String username, String note) {
        AttendanceSession s = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Attendance session not found."));
        s.setApprovalStatus(approve ? "APPROVED" : "REJECTED");
        s.setApprovedBy(username);
        s.setApprovedAt(LocalDateTime.now());
        s.setApprovalNote(note == null || note.isBlank() ? null : note.trim().substring(0, Math.min(255, note.trim().length())));
        sessionRepository.save(s);
        timeService.recomputeAggregate(s.getAttendance());
        notifyEmployee(s, approve);
        return toReviewRow(s);
    }

    /** Approve several flagged sessions at once; returns how many were approved. */
    @Transactional
    public int approveMany(List<Long> sessionIds, String username) {
        int n = 0;
        for (Long id : sessionIds == null ? List.<Long>of() : sessionIds) {
            AttendanceSession s = sessionRepository.findById(id).orElse(null);
            if (s == null || !s.isAwaitingApproval()) continue;
            resolve(id, true, username, null);
            n++;
        }
        return n;
    }

    private void notifyEmployee(AttendanceSession s, boolean approve) {
        try {
            Employee e = s.getAttendance().getEmployee();
            if (e == null || e.getEmail() == null) return;
            userRepository.findByEmail(e.getEmail()).ifPresent(u -> notificationService.dispatch(
                    approve ? "Attendance approved" : "Attendance rejected",
                    "Your punch on " + s.getAttendance().getDate()
                            + (s.getCheckInTime() != null ? " at " + s.getCheckInTime().toString().substring(0, 5) : "")
                            + (approve ? " was approved." : " was rejected"
                            + (s.getApprovalNote() != null ? ": " + s.getApprovalNote() : ".")),
                    "ATTENDANCE", u.getId(), "/employee"));
        } catch (Exception ignored) {
            // notification is best-effort; the decision itself is already saved
        }
    }

    // --- biometric method-change requests (self-service from the portal) ---

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listMethodRequests() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Employee e : employeeRepository.findByAttendanceMethodRequestedIsNotNullAndIsDeletedFalse()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("employeeId", e.getId());
            m.put("employeeCode", e.getEmployeeCode());
            m.put("employeeName", (nz(e.getFirstName()) + " " + nz(e.getLastName())).trim());
            m.put("currentMethod", e.getAttendanceMethod());
            m.put("requestedMethod", e.getAttendanceMethodRequested());
            m.put("requestedAt", e.getAttendanceMethodRequestedAt());
            out.add(m);
        }
        return out;
    }

    /** Approve → the requested method becomes the employee's method. Reject → request cleared. */
    @Transactional
    public void resolveMethodRequest(Long employeeId, boolean approve) {
        Employee e = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        if (approve && e.getAttendanceMethodRequested() != null) {
            e.setAttendanceMethod(e.getAttendanceMethodRequested());
        }
        e.setAttendanceMethodRequested(null);
        e.setAttendanceMethodRequestedAt(null);
        employeeRepository.save(e);
    }

    private Map<String, Object> toReviewRow(AttendanceSession s) {
        Attendance att = s.getAttendance();
        Employee emp = att == null ? null : att.getEmployee();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sessionId", s.getId());
        m.put("employeeId", emp == null ? null : emp.getId());
        m.put("employeeCode", emp == null ? null : emp.getEmployeeCode());
        m.put("employeeName", emp == null ? "—"
                : (nz(emp.getFirstName()) + " " + nz(emp.getLastName())).trim());
        m.put("date", att == null ? null : att.getDate());
        m.put("checkInTime", s.getCheckInTime());
        m.put("checkOutTime", s.getCheckOutTime());
        m.put("checkInSource", s.getCheckInSource());
        m.put("checkOutSource", s.getCheckOutSource());
        m.put("fieldNote", s.getFieldNote());
        m.put("outLat", s.getCheckOutLat());
        m.put("outLng", s.getCheckOutLng());
        m.put("outAccuracyMeters", s.getCheckOutAccuracy());
        m.put("machineName", s.getMachine() == null ? null : s.getMachine().getName());
        m.put("approvalNote", s.getApprovalNote());
        m.put("verificationMethod", s.getVerificationMethod());
        m.put("flagReason", s.getFlagReason());
        m.put("deviceVerified", Boolean.TRUE.equals(s.getDeviceVerified()));
        m.put("deviceMismatchReason", s.getDeviceMismatchReason());
        m.put("distanceMeters", s.getDistanceMeters());
        m.put("accuracyMeters", s.getAccuracyMeters());
        m.put("officeLocation", s.getOfficeLocation() == null ? null : s.getOfficeLocation().getName());
        m.put("lat", s.getCheckInLat());
        m.put("lng", s.getCheckInLng());
        m.put("deviceInfo", s.getDeviceInfo());
        m.put("approvalStatus", s.getApprovalStatus());
        return m;
    }

    private static String nz(String s) { return s == null ? "" : s; }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Attendance regularization. An employee requests a correction to a day's clock times — a late/early
 * clock-in, a missed clock-out, or a fully-missed day — and an admin approves it; on approval the
 * day's session times are rewritten so worked-hours/earnings recompute from them (via
 * {@link EmployeeTimeService#recomputeAggregate}). Admins may also apply a day directly (no request).
 *
 * The correction works on a whole DATE: the day's first session takes the corrected check-in and its
 * last session the corrected check-out; a day with no session yet gets a new MANUAL session created.
 */
@Service
public class AttendanceCorrectionService {

    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AttendanceRepository attendanceRepository;
    @Autowired private AttendanceSessionRepository sessionRepository;
    @Autowired private AttendanceCorrectionRequestRepository correctionRepository;
    @Autowired private EmployeeTimeService timeService;
    @Autowired private NotificationService notificationService;
    @Autowired private UserRepository userRepository;

    // --- employee side -----------------------------------------------------

    @Transactional
    public AttendanceCorrectionRequest request(User user, LocalDate date, LocalTime reqIn, LocalTime reqOut, String reason) {
        Employee emp = timeService.requireEmployee(user);
        if (date == null) throw new IllegalArgumentException("Pick the date to correct.");
        if (reqIn == null && reqOut == null) throw new IllegalArgumentException("Enter a corrected clock-in and/or clock-out time.");

        Attendance att = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(emp.getId(), date).orElse(null);
        List<AttendanceSession> sessions = att == null ? List.of()
                : sessionRepository.findByAttendanceIdOrderByIdAsc(att.getId());

        AttendanceCorrectionRequest r = new AttendanceCorrectionRequest();
        r.setEmployee(emp);
        r.setCorrectionDate(date);
        r.setRequestedCheckIn(reqIn);
        r.setRequestedCheckOut(reqOut);
        r.setReason(reason);
        r.setStatus("PENDING");
        if (sessions.isEmpty()) {
            r.setType("ADD_DAY");
            if (reqIn == null || reqOut == null)
                throw new IllegalArgumentException("For a missed day, enter both clock-in and clock-out.");
        } else {
            // Snapshot what it is now, so the admin sees original vs requested.
            r.setOriginalCheckIn(sessions.get(0).getCheckInTime());
            r.setOriginalCheckOut(sessions.get(sessions.size() - 1).getCheckOutTime());
            r.setType(reqOut != null && reqIn == null ? "FIX_OUT" : "FIX_IN");
        }
        AttendanceCorrectionRequest saved = correctionRepository.save(r);

        String name = (nz(emp.getFirstName()) + " " + nz(emp.getLastName())).trim();
        notificationService.dispatchToAdmins("Attendance correction request",
                (name.isBlank() ? "An employee" : name) + " requested a time correction for " + date + ".",
                "ATTENDANCE", "/tasks", null);
        return saved;
    }

    public List<Map<String, Object>> myRequests(User user) {
        Employee emp = timeService.requireEmployee(user);
        List<Map<String, Object>> out = new ArrayList<>();
        for (AttendanceCorrectionRequest r : correctionRepository.findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(emp.getId())) {
            out.add(toRow(r));
        }
        return out;
    }

    // --- admin side --------------------------------------------------------

    public List<Map<String, Object>> listPending() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (AttendanceCorrectionRequest r : correctionRepository.findByStatusAndIsDeletedFalseOrderByIdDesc("PENDING")) {
            out.add(toRow(r));
        }
        return out;
    }

    @Transactional
    public Map<String, Object> approve(Long id, String adminEmail) {
        AttendanceCorrectionRequest r = correctionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Correction request not found."));
        if (!"PENDING".equals(r.getStatus())) throw new IllegalStateException("This request is already " + r.getStatus().toLowerCase() + ".");
        applyDay(r.getEmployee(), r.getCorrectionDate(), r.getRequestedCheckIn(), r.getRequestedCheckOut());
        r.setStatus("APPROVED");
        r.setReviewedBy(adminEmail);
        r.setReviewedAt(LocalDateTime.now());
        correctionRepository.save(r);
        notifyEmployee(r.getEmployee(), "Attendance correction approved",
                "Your time correction for " + r.getCorrectionDate() + " was approved.");
        return toRow(r);
    }

    @Transactional
    public Map<String, Object> reject(Long id, String adminEmail, String remarks) {
        AttendanceCorrectionRequest r = correctionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Correction request not found."));
        if (!"PENDING".equals(r.getStatus())) throw new IllegalStateException("This request is already " + r.getStatus().toLowerCase() + ".");
        r.setStatus("REJECTED");
        r.setReviewedBy(adminEmail);
        r.setReviewedAt(LocalDateTime.now());
        r.setReviewRemarks(remarks);
        correctionRepository.save(r);
        notifyEmployee(r.getEmployee(), "Attendance correction rejected",
                "Your time correction for " + r.getCorrectionDate() + " was rejected."
                        + (remarks != null && !remarks.isBlank() ? " Reason: " + remarks : ""));
        return toRow(r);
    }

    /** Admin applies a correction directly (edit an existing day or add a missed one) — no request. */
    @Transactional
    public void adminApplyDay(Long employeeId, LocalDate date, LocalTime reqIn, LocalTime reqOut) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));
        if (date == null || (reqIn == null && reqOut == null))
            throw new IllegalArgumentException("Pick a date and at least one time.");
        applyDay(emp, date, reqIn, reqOut);
    }

    // --- core apply --------------------------------------------------------

    /**
     * Rewrites the given day's clock times: the first session takes {@code reqIn}, the last takes
     * {@code reqOut}; a day with no session yet gets a new MANUAL session. Then recomputes the
     * aggregate so worked-hours/earnings reflect the change.
     */
    private void applyDay(Employee emp, LocalDate date, LocalTime reqIn, LocalTime reqOut) {
        Attendance att = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(emp.getId(), date).orElse(null);
        if (att == null) {
            att = new Attendance();
            att.setEmployee(emp);
            att.setDate(date);
            att.setStatus("PRESENT");
            att = attendanceRepository.save(att);
        }
        List<AttendanceSession> sessions = sessionRepository.findByAttendanceIdOrderByIdAsc(att.getId());

        if (sessions.isEmpty()) {
            AttendanceSession s = new AttendanceSession();
            s.setAttendance(att);
            s.setCheckInTime(reqIn);
            s.setCheckOutTime(reqOut);
            s.setVerified(true);
            s.setFlagged(false);
            s.setVerificationMethod("MANUAL");
            sessionRepository.save(s);
        } else {
            if (reqIn != null) {
                AttendanceSession first = sessions.get(0);
                first.setCheckInTime(reqIn);
                sessionRepository.save(first);
            }
            if (reqOut != null) {
                AttendanceSession last = sessions.get(sessions.size() - 1);
                last.setCheckOutTime(reqOut);
                sessionRepository.save(last);
            }
        }
        att.setStatus("PRESENT");
        timeService.recomputeAggregate(att);
    }

    // --- helpers -----------------------------------------------------------

    private Map<String, Object> toRow(AttendanceCorrectionRequest r) {
        Employee e = r.getEmployee();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("employeeId", e == null ? null : e.getId());
        m.put("employeeName", e == null ? "—" : (nz(e.getFirstName()) + " " + nz(e.getLastName())).trim());
        m.put("employeeCode", e == null ? null : e.getEmployeeCode());
        m.put("date", r.getCorrectionDate());
        m.put("type", r.getType());
        m.put("requestedCheckIn", r.getRequestedCheckIn());
        m.put("requestedCheckOut", r.getRequestedCheckOut());
        m.put("originalCheckIn", r.getOriginalCheckIn());
        m.put("originalCheckOut", r.getOriginalCheckOut());
        m.put("reason", r.getReason());
        m.put("status", r.getStatus());
        m.put("reviewRemarks", r.getReviewRemarks());
        return m;
    }

    private void notifyEmployee(Employee emp, String title, String message) {
        if (emp == null || emp.getEmail() == null) return;
        userRepository.findByEmail(emp.getEmail()).ifPresent(u ->
                notificationService.dispatch(title, message, "ATTENDANCE", u.getId(), "/employee/attendance"));
    }

    private static String nz(String s) { return s == null ? "" : s; }
}

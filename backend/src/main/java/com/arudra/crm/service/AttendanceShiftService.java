package com.arudra.crm.service;

import com.arudra.crm.entity.AttendanceShift;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.AttendanceShiftRepository;
import com.arudra.crm.repository.BranchRepository;
import com.arudra.crm.repository.EmployeeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/** Shift master data (HR → Attendance → Shifts) and employee shift / branch assignment. */
@Service
public class AttendanceShiftService {

    private final AttendanceShiftRepository shiftRepository;
    private final EmployeeRepository employeeRepository;
    private final BranchRepository branchRepository;
    private final AttendanceAuditService audit;

    public AttendanceShiftService(AttendanceShiftRepository shiftRepository, EmployeeRepository employeeRepository,
                                  BranchRepository branchRepository, AttendanceAuditService audit) {
        this.shiftRepository = shiftRepository;
        this.employeeRepository = employeeRepository;
        this.branchRepository = branchRepository;
        this.audit = audit;
    }

    public List<AttendanceShift> list() {
        return shiftRepository.findByIsDeletedFalseOrderByNameAsc();
    }

    /** The employee's own shift, else the default shift, else null (no shift rules apply). */
    public AttendanceShift resolve(Employee e) {
        if (e != null && e.getAttendanceShift() != null && !Boolean.TRUE.equals(e.getAttendanceShift().getIsDeleted())) {
            return e.getAttendanceShift();
        }
        return defaultShift();
    }

    public AttendanceShift defaultShift() {
        return shiftRepository.findFirstByDefaultShiftTrueAndActiveTrueAndIsDeletedFalseOrderByIdAsc().orElse(null);
    }

    @Transactional
    public AttendanceShift save(AttendanceShift body) {
        if (body.getName() == null || body.getName().isBlank()) throw new IllegalArgumentException("Shift name is required.");
        if (body.getStartTime() == null || body.getEndTime() == null) throw new IllegalArgumentException("Start and end times are required.");
        AttendanceShift s = body.getId() == null ? new AttendanceShift()
                : shiftRepository.findById(body.getId()).filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                    .orElseThrow(() -> new ResourceNotFoundException("Shift not found."));
        boolean created = s.getId() == null;
        int grace = clamp(body.getGracePeriodMinutes(), 0, 240, 15);
        int brk = clamp(body.getBreakMinutes(), 0, 480, 60);
        int span = AttendanceShiftCalculator.spanMinutes(body.getStartTime(), body.getEndTime());
        if (brk >= span) throw new IllegalArgumentException("Break must be shorter than the shift.");

        s.setName(body.getName().trim());
        s.setStartTime(body.getStartTime().withSecond(0).withNano(0));
        s.setEndTime(body.getEndTime().withSecond(0).withNano(0));
        s.setGracePeriodMinutes(grace);
        s.setBreakMinutes(brk);
        s.setWorkingHours(AttendanceShiftCalculator.netWorkingHours(s.getStartTime(), s.getEndTime(), brk));
        s.setOvertimeEnabled(body.getOvertimeEnabled() == null || body.getOvertimeEnabled());
        s.setHalfDayThresholdMinutes(clamp(body.getHalfDayThresholdMinutes(), 0, span, Math.min(240, span / 2)));
        s.setWeekOffDays(normalizeWeekOff(body.getWeekOffDays()));
        s.setActive(body.getActive() == null || body.getActive());
        boolean makeDefault = Boolean.TRUE.equals(body.getDefaultShift());
        s.setDefaultShift(makeDefault);
        s = shiftRepository.save(s);
        if (makeDefault) {
            for (AttendanceShift other : shiftRepository.findByDefaultShiftTrueAndIsDeletedFalse()) {
                if (!other.getId().equals(s.getId())) {
                    other.setDefaultShift(false);
                    shiftRepository.save(other);
                }
            }
        }
        audit.audit(AttendanceAuditService.MODULE_DEVICE, created ? "SHIFT_CREATED" : "SHIFT_UPDATED", s.getId(), s.getName(),
                (created ? "Created" : "Updated") + " shift " + s.getName() + " " + s.getStartTime() + "–" + s.getEndTime()
                        + ", grace " + grace + "m, break " + brk + "m");
        return s;
    }

    @Transactional
    public void delete(Long id) {
        AttendanceShift s = shiftRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Shift not found."));
        s.setIsDeleted(true);
        s.setDeletedAt(LocalDateTime.now());
        s.setDefaultShift(false);
        shiftRepository.save(s);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "SHIFT_DELETED", s.getId(), s.getName(), "Deleted shift " + s.getName());
    }

    /** Employees currently assigned to each shift (for the Shifts page). */
    @Transactional(readOnly = true)
    public Map<Long, Long> assignmentCounts() {
        return employeeRepository.findActiveForAttendance().stream()
                .filter(e -> e.getAttendanceShift() != null)
                .collect(Collectors.groupingBy(e -> e.getAttendanceShift().getId(), Collectors.counting()));
    }

    /**
     * Bulk assignment. {@code shiftId}/{@code branchId} null = leave unchanged; {@code clearShift}
     * resets employees to the default shift.
     */
    @Transactional
    public int assign(Collection<Long> employeeIds, Long shiftId, Long branchId, boolean clearShift) {
        if (employeeIds == null || employeeIds.isEmpty()) throw new IllegalArgumentException("Select at least one employee.");
        AttendanceShift shift = shiftId == null ? null : shiftRepository.findById(shiftId)
                .filter(s -> !Boolean.TRUE.equals(s.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Shift not found."));
        var branch = branchId == null ? null : branchRepository.findById(branchId)
                .filter(b -> !Boolean.TRUE.equals(b.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Branch not found."));
        int n = 0;
        for (Employee e : employeeRepository.findAllById(employeeIds)) {
            if (clearShift) e.setAttendanceShift(null);
            else if (shift != null) e.setAttendanceShift(shift);
            if (branch != null) e.setBranch(branch);
            employeeRepository.save(e);
            n++;
        }
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "SHIFT_ASSIGNED", shift == null ? 0L : shift.getId(),
                shift == null ? null : shift.getName(), "Assigned " + n + " employee(s)"
                        + (clearShift ? " to the default shift" : shift == null ? "" : " to shift " + shift.getName())
                        + (branch == null ? "" : ", branch " + branch.getName()));
        return n;
    }

    static String normalizeWeekOff(String csv) {
        String norm = AttendanceShiftCalculator.weekOffDays(csv).stream()
                .sorted()
                .map(d -> d.name().toUpperCase(Locale.ROOT))
                .collect(Collectors.joining(","));
        return norm; // empty = no weekly off
    }

    private static int clamp(Integer v, int min, int max, int dflt) {
        int x = v == null ? dflt : v;
        return Math.max(min, Math.min(max, x));
    }
}

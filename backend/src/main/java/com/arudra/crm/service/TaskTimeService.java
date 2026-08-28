package com.arudra.crm.service;

import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.TaskTimeLog;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.TaskAssignmentRepository;
import com.arudra.crm.repository.TaskRepository;
import com.arudra.crm.repository.TaskTimeLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Task time tracking + payroll-approval flow (spec §21–22). Employees clock actual work per task
 * (START → PAUSE → RESUME → STOP); each session is a {@link TaskTimeLog}. Time then moves
 * DRAFT → SUBMITTED → APPROVED/REJECTED. Only APPROVED minutes are exposed to HR/Payroll — and this
 * service deliberately does NO pay calculation (rates/OT/PF live in PayrollService); it only records
 * and aggregates hours.
 */
@Service
public class TaskTimeService {

    @Autowired private TaskTimeLogRepository timeLogRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;

    // ---------------------------------------------------------------- tracking (start/pause/resume/stop)

    @Transactional
    public Map<String, Object> startWork(Long taskId, User employee) {
        Task task = requireAssignedTask(taskId, employee);
        TaskTimeLog open = openLog(taskId, employee.getId());
        if (open != null) {
            // A paused timer resumes; an already-running one is returned unchanged (idempotent).
            if (open.getPausedAt() != null) {
                open.setResumedAt(LocalDateTime.now());
                open.setPausedAt(null);
                timeLogRepository.save(open);
            }
            return toLogSummary(open);
        }
        TaskTimeLog log = new TaskTimeLog();
        log.setTask(task);
        log.setEmployee(employee);
        log.setWorkDate(LocalDate.now());
        log.setStartedAt(LocalDateTime.now());
        log.setResumedAt(LocalDateTime.now()); // running anchor
        log.setWorkingTimeMinutes(0);
        log.setStatus("DRAFT");
        return toLogSummary(timeLogRepository.save(log));
    }

    @Transactional
    public Map<String, Object> pauseWork(Long taskId, User employee) {
        TaskTimeLog log = requireOpenLog(taskId, employee.getId());
        if (log.getPausedAt() == null) {
            accrueSinceAnchor(log);
            log.setPausedAt(LocalDateTime.now());
            timeLogRepository.save(log);
        }
        return toLogSummary(log);
    }

    @Transactional
    public Map<String, Object> resumeWork(Long taskId, User employee) {
        TaskTimeLog log = requireOpenLog(taskId, employee.getId());
        if (log.getPausedAt() != null) {
            log.setResumedAt(LocalDateTime.now());
            log.setPausedAt(null);
            timeLogRepository.save(log);
        }
        return toLogSummary(log);
    }

    @Transactional
    public Map<String, Object> stopWork(Long taskId, User employee) {
        TaskTimeLog log = requireOpenLog(taskId, employee.getId());
        if (log.getPausedAt() == null) {
            accrueSinceAnchor(log);
        }
        log.setCompletedAt(LocalDateTime.now());
        return toLogSummary(timeLogRepository.save(log));
    }

    /** Add the elapsed minutes since the running anchor (start/last resume) into the accrued total. */
    private void accrueSinceAnchor(TaskTimeLog log) {
        LocalDateTime anchor = log.getResumedAt() != null ? log.getResumedAt() : log.getStartedAt();
        if (anchor == null) return;
        long mins = ChronoUnit.MINUTES.between(anchor, LocalDateTime.now());
        if (mins > 0) {
            log.setWorkingTimeMinutes(nz(log.getWorkingTimeMinutes()) + (int) mins);
        }
    }

    // ---------------------------------------------------------------- timesheet / submission

    public Map<String, Object> getTimesheet(User employee, LocalDate from, LocalDate to) {
        List<TaskTimeLog> logs = timeLogRepository
                .findByEmployeeIdAndWorkDateBetweenOrderByWorkDateDescIdDesc(employee.getId(), from, to);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", from);
        out.put("to", to);
        out.put("logs", logs.stream().map(this::toLogSummary).collect(Collectors.toList()));
        out.put("draftMinutes", sumMinutes(logs, "DRAFT"));
        out.put("submittedMinutes", sumMinutes(logs, "SUBMITTED"));
        out.put("approvedMinutes", sumMinutes(logs, "APPROVED"));
        return out;
    }

    /** Submit every finished DRAFT log in the range for approval. Returns how many were submitted. */
    @Transactional
    public int submitRange(User employee, LocalDate from, LocalDate to) {
        List<TaskTimeLog> logs = timeLogRepository
                .findByEmployeeIdAndStatusAndWorkDateBetween(employee.getId(), "DRAFT", from, to);
        int count = 0;
        for (TaskTimeLog log : logs) {
            if (log.getCompletedAt() == null) continue; // only finished sessions are submittable
            log.setStatus("SUBMITTED");
            log.setSubmittedAt(LocalDateTime.now());
            timeLogRepository.save(log);
            count++;
        }
        return count;
    }

    // ---------------------------------------------------------------- approval (supervisor/admin)

    public List<Map<String, Object>> pendingApprovals() {
        return timeLogRepository.findByStatusOrderByIdDesc("SUBMITTED").stream()
                .map(this::toLogSummary).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> approve(Long logId, User approver) {
        TaskTimeLog log = getLog(logId);
        if (!"SUBMITTED".equals(log.getStatus())) {
            throw new IllegalStateException("Only submitted time can be approved.");
        }
        log.setStatus("APPROVED");
        log.setApprovedBy(approver);
        log.setApprovedAt(LocalDateTime.now());
        return toLogSummary(timeLogRepository.save(log));
    }

    @Transactional
    public Map<String, Object> reject(Long logId, User approver, String remarks) {
        TaskTimeLog log = getLog(logId);
        if (!"SUBMITTED".equals(log.getStatus())) {
            throw new IllegalStateException("Only submitted time can be rejected.");
        }
        log.setStatus("REJECTED");
        log.setApprovedBy(approver);
        log.setApprovedAt(LocalDateTime.now());
        log.setRemarks(remarks);
        return toLogSummary(timeLogRepository.save(log));
    }

    // ---------------------------------------------------------------- payroll read (APPROVED only)

    /**
     * Approved task hours for an employee over a period — the data payroll consumes. No rate/OT/PF
     * math here; that stays in PayrollService.
     */
    public Map<String, Object> approvedHours(Long employeeId, LocalDate from, LocalDate to) {
        long regularMin = timeLogRepository.sumApprovedWorkingMinutes(employeeId, from, to);
        long overtimeMin = timeLogRepository.sumApprovedOvertimeMinutes(employeeId, from, to);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("employeeId", employeeId);
        out.put("from", from);
        out.put("to", to);
        out.put("regularMinutes", regularMin);
        out.put("overtimeMinutes", overtimeMin);
        out.put("regularHours", hours(regularMin));
        out.put("overtimeHours", hours(overtimeMin));
        out.put("totalHours", hours(regularMin + overtimeMin));
        return out;
    }

    // ---------------------------------------------------------------- helpers

    private Task requireAssignedTask(Long taskId, User employee) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new RuntimeException("Task not found"));
        if (assignmentRepository.findByTaskIdAndEmployeeId(taskId, employee.getId()).isEmpty()) {
            throw new IllegalStateException("You can only track time on a task you are assigned to.");
        }
        return task;
    }

    private TaskTimeLog openLog(Long taskId, Long employeeId) {
        return timeLogRepository
                .findFirstByTaskIdAndEmployeeIdAndCompletedAtIsNullOrderByIdDesc(taskId, employeeId)
                .orElse(null);
    }

    private TaskTimeLog requireOpenLog(Long taskId, Long employeeId) {
        TaskTimeLog log = openLog(taskId, employeeId);
        if (log == null) throw new IllegalStateException("No active timer on this task — start work first.");
        return log;
    }

    private TaskTimeLog getLog(Long id) {
        return timeLogRepository.findById(id).orElseThrow(() -> new RuntimeException("Time log not found"));
    }

    private int sumMinutes(List<TaskTimeLog> logs, String status) {
        return logs.stream().filter(l -> status.equals(l.getStatus()))
                .mapToInt(l -> nz(l.getWorkingTimeMinutes())).sum();
    }

    private static BigDecimal hours(long minutes) {
        return BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    private static int nz(Integer v) { return v == null ? 0 : v; }

    private Map<String, Object> toLogSummary(TaskTimeLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("taskId", l.getTask() != null ? l.getTask().getId() : null);
        m.put("taskName", l.getTask() != null ? l.getTask().getTaskName() : null);
        m.put("employeeName", l.getEmployee() != null ? l.getEmployee().getName() : null);
        m.put("workDate", l.getWorkDate());
        m.put("startedAt", l.getStartedAt());
        m.put("pausedAt", l.getPausedAt());
        m.put("completedAt", l.getCompletedAt());
        m.put("running", l.getCompletedAt() == null && l.getPausedAt() == null);
        m.put("workingTimeMinutes", nz(l.getWorkingTimeMinutes()));
        m.put("status", l.getStatus());
        m.put("remarks", l.getRemarks());
        m.put("approvedBy", l.getApprovedBy() != null ? l.getApprovedBy().getName() : null);
        return m;
    }
}

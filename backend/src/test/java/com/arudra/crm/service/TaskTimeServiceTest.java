package com.arudra.crm.service;

import com.arudra.crm.entity.TaskTimeLog;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.TaskAssignmentRepository;
import com.arudra.crm.repository.TaskRepository;
import com.arudra.crm.repository.TaskTimeLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Approval-lifecycle + payroll-aggregation guards for TaskTimeService (mocked repos, no DB).
 */
class TaskTimeServiceTest {

    @Mock TaskTimeLogRepository timeLogRepository;
    @Mock TaskRepository taskRepository;
    @Mock TaskAssignmentRepository assignmentRepository;

    @InjectMocks TaskTimeService svc;

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        when(timeLogRepository.save(any(TaskTimeLog.class))).thenAnswer(i -> i.getArgument(0));
    }

    private TaskTimeLog log(String status) {
        TaskTimeLog l = new TaskTimeLog();
        l.setStatus(status);
        l.setWorkingTimeMinutes(120);
        return l;
    }

    @Test
    void approve_submittedLog_becomesApproved() {
        when(timeLogRepository.findById(1L)).thenReturn(Optional.of(log("SUBMITTED")));
        Map<String, Object> out = svc.approve(1L, new User());
        assertEquals("APPROVED", out.get("status"));
    }

    @Test
    void approve_nonSubmitted_isRejected() {
        when(timeLogRepository.findById(1L)).thenReturn(Optional.of(log("DRAFT")));
        assertThrows(IllegalStateException.class, () -> svc.approve(1L, new User()));
    }

    @Test
    void reject_submittedLog_becomesRejectedWithRemarks() {
        when(timeLogRepository.findById(2L)).thenReturn(Optional.of(log("SUBMITTED")));
        Map<String, Object> out = svc.reject(2L, new User(), "Hours look inflated");
        assertEquals("REJECTED", out.get("status"));
        assertEquals("Hours look inflated", out.get("remarks"));
    }

    @Test
    void approvedHours_convertsApprovedMinutesToHours() {
        LocalDate from = LocalDate.of(2026, 8, 1), to = LocalDate.of(2026, 8, 31);
        when(timeLogRepository.sumApprovedWorkingMinutes(9L, from, to)).thenReturn(450L); // 7.5h
        when(timeLogRepository.sumApprovedOvertimeMinutes(9L, from, to)).thenReturn(60L); // 1.0h
        Map<String, Object> out = svc.approvedHours(9L, from, to);
        assertEquals(new java.math.BigDecimal("7.50"), out.get("regularHours"));
        assertEquals(new java.math.BigDecimal("1.00"), out.get("overtimeHours"));
        assertEquals(new java.math.BigDecimal("8.50"), out.get("totalHours"));
    }
}

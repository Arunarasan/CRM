package com.arudra.crm.service;

import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.AttendanceSession;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.repository.AttendanceRepository;
import com.arudra.crm.repository.AttendanceSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Approval decides pay: unflagged and APPROVED sessions count toward hours/earnings, PENDING ones are
 * reported separately and not paid, REJECTED ones never count.
 */
@ExtendWith(MockitoExtension.class)
class AttendancePayableTest {

    @Mock private AttendanceRepository attendanceRepository;
    @Mock private AttendanceSessionRepository sessionRepository;
    @InjectMocks private EmployeeTimeService service;

    private Employee employee;
    private Attendance day;

    @BeforeEach
    void setUp() {
        employee = new Employee();
        employee.setId(1L);
        employee.setHourlyRate(new BigDecimal("100"));
        employee.setStandardDailyHours(new BigDecimal("8"));
        day = new Attendance();
        day.setId(10L);
        day.setEmployee(employee);
        day.setDate(LocalDate.of(2026, 10, 7)); // a Wednesday — no weekend rate
    }

    private static AttendanceSession session(int fromHour, int toHour, boolean flagged, String approval) {
        AttendanceSession s = new AttendanceSession();
        s.setCheckInTime(LocalTime.of(fromHour, 0));
        s.setCheckOutTime(LocalTime.of(toHour, 0));
        s.setFlagged(flagged);
        s.setApprovalStatus(approval);
        return s;
    }

    private Map<String, Object> summaryOf(AttendanceSession... sessions) {
        when(attendanceRepository.findByEmployeeIdAndDateBetween(anyLong(), any(), any())).thenReturn(List.of(day));
        when(sessionRepository.findByAttendanceIdOrderByIdAsc(10L)).thenReturn(List.of(sessions));
        return service.hourlySummary(employee, day.getDate(), day.getDate());
    }

    @Test
    void payableRules() {
        assertTrue(session(9, 10, false, null).isPayable());
        assertTrue(session(9, 10, true, "APPROVED").isPayable());
        assertFalse(session(9, 10, true, "PENDING").isPayable());
        assertFalse(session(9, 10, true, "REJECTED").isPayable());
        assertTrue(session(9, 10, true, "PENDING").isAwaitingApproval());
        assertTrue(session(9, 10, true, null).isAwaitingApproval());
        assertFalse(session(9, 10, true, "REJECTED").isAwaitingApproval());
    }

    @Test
    void onlyVerifiedAndApprovedTimeIsPaid() {
        Map<String, Object> m = summaryOf(
                session(9, 12, false, null),        // verified office punch: 3h
                session(13, 15, true, "APPROVED"),  // approved field punch: 2h
                session(15, 17, true, "PENDING"),   // waiting: 2h, not paid
                session(17, 18, true, "REJECTED")); // rejected: 1h, never paid
        assertEquals(0, new BigDecimal("5.00").compareTo((BigDecimal) m.get("workedHours")));
        assertEquals(0, new BigDecimal("500.00").compareTo((BigDecimal) m.get("regularEarnings")));
        assertEquals(0, new BigDecimal("2.00").compareTo((BigDecimal) m.get("pendingHours")));
        assertEquals(1, m.get("pendingSessions"));
        assertEquals(1, m.get("attendanceDays"));
    }

    @Test
    void dayWithOnlyRejectedTimeIsNotAnAttendanceDay() {
        Map<String, Object> m = summaryOf(session(9, 17, true, "REJECTED"));
        assertEquals(0, BigDecimal.ZERO.compareTo((BigDecimal) m.get("workedHours")));
        assertEquals(0, m.get("attendanceDays"));
        assertEquals(0, m.get("pendingSessions"));
    }
}

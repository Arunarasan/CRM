package com.arudra.crm.service;

import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.AttendanceSession;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.repository.AttendanceSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Time-clock watchdog: if an employee is still clocked in past their standard shift (default 8h)
 * without having clocked out, alert the admins once (deduped via {@code overtime_alert_sent}). This
 * is notify-only — it never auto-clocks-out. Runs every 30 minutes.
 */
@Component
public class AttendanceOvertimeScheduler {

    private static final Logger log = LoggerFactory.getLogger(AttendanceOvertimeScheduler.class);
    private static final BigDecimal DEFAULT_SHIFT_HOURS = new BigDecimal("8");

    @Autowired private AttendanceSessionRepository sessionRepository;
    @Autowired private NotificationService notificationService;

    @Scheduled(cron = "0 */30 * * * *")
    @Transactional
    public void alertLongOpenSessions() {
        LocalDateTime now = LocalDateTime.now();
        int alerted = 0;
        for (AttendanceSession s : sessionRepository.findByCheckOutTimeIsNullAndOvertimeAlertSentFalse()) {
            Attendance att = s.getAttendance();
            if (att == null || att.getDate() == null || s.getCheckInTime() == null) continue;
            // Ignore ancient still-open sessions (e.g. a forgotten clock-out surfaced by the V27
            // backfill); only recent ones are worth alerting on.
            if (att.getDate().isBefore(LocalDate.now().minusDays(1))) continue;

            Employee emp = att.getEmployee();
            BigDecimal shift = emp != null && emp.getStandardDailyHours() != null && emp.getStandardDailyHours().signum() > 0
                    ? emp.getStandardDailyHours() : DEFAULT_SHIFT_HOURS;
            long thresholdMinutes = shift.multiply(BigDecimal.valueOf(60)).longValue();

            long elapsed = Duration.between(LocalDateTime.of(att.getDate(), s.getCheckInTime()), now).toMinutes();
            if (elapsed < thresholdMinutes) continue;

            String name = emp == null ? "An employee"
                    : (nz(emp.getFirstName()) + " " + nz(emp.getLastName())).trim();
            if (name.isBlank()) name = "An employee";
            notificationService.dispatchToAdmins(
                    "Employee not clocked out",
                    name + " has been clocked in for " + (elapsed / 60) + "h " + (elapsed % 60) + "m without clocking out"
                            + " (since " + s.getCheckInTime() + " on " + att.getDate() + ").",
                    "ATTENDANCE", "/hr", null);

            s.setOvertimeAlertSent(true);
            sessionRepository.save(s);
            alerted++;
        }
        if (alerted > 0) log.info("Attendance overtime alert: notified admins about {} open session(s).", alerted);
    }

    private static String nz(String s) { return s == null ? "" : s; }
}

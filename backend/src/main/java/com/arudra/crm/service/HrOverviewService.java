package com.arudra.crm.service;

import com.arudra.crm.entity.Attendance;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeBonus;
import com.arudra.crm.entity.LeaveRequest;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/**
 * The HR & Payroll landing page in one read-only call: who's in today, what's waiting for HR
 * (punches, corrections, leave, profile changes, daily reports, money requests, bonuses) and where
 * this month's payroll stands. Nothing here changes data.
 */
@Service
public class HrOverviewService {

    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AttendanceRepository attendanceRepository;
    @Autowired private LeaveRequestRepository leaveRequestRepository;
    @Autowired private AttendanceCorrectionRequestRepository correctionRepository;
    @Autowired private ProfileChangeRequestRepository profileChangeRepository;
    @Autowired private DailyReportRepository dailyReportRepository;
    @Autowired private PayrollRequestRepository payrollRequestRepository;
    @Autowired private EmployeeBonusRepository bonusRepository;
    @Autowired private AttendanceAdminService attendanceAdminService;
    @Autowired private PayrollService payrollService;

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        LocalDate today = LocalDate.now();

        // --- staff + today ---------------------------------------------------
        List<Employee> staff = employeeRepository.findAll().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .filter(e -> e.getStatus() == null || !"TERMINATED".equalsIgnoreCase(e.getStatus()))
                .toList();
        Set<Long> staffIds = new HashSet<>();
        staff.forEach(e -> staffIds.add(e.getId()));

        Set<Long> present = new HashSet<>();
        for (Attendance a : attendanceRepository.findByDate(today)) {
            if (a.getEmployee() == null || !staffIds.contains(a.getEmployee().getId())) continue;
            boolean in = a.getCheckInTime() != null
                    || "PRESENT".equalsIgnoreCase(a.getStatus()) || "HALF_DAY".equalsIgnoreCase(a.getStatus());
            if (in) present.add(a.getEmployee().getId());
        }
        Set<Long> onLeave = new HashSet<>();
        List<LeaveRequest> leaves = leaveRequestRepository.findAll();
        int leavePending = 0;
        for (LeaveRequest l : leaves) {
            if ("PENDING".equalsIgnoreCase(l.getStatus())) leavePending++;
            if (!"APPROVED".equalsIgnoreCase(l.getStatus()) || l.getEmployee() == null) continue;
            if (l.getStartDate() != null && l.getEndDate() != null
                    && !today.isBefore(l.getStartDate()) && !today.isAfter(l.getEndDate())) {
                onLeave.add(l.getEmployee().getId());
            }
        }
        onLeave.removeAll(present);

        List<Map<String, Object>> notIn = new ArrayList<>();
        for (Employee e : staff) {
            if (present.contains(e.getId()) || onLeave.contains(e.getId())) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("name", ((e.getFirstName() == null ? "" : e.getFirstName()) + " "
                    + (e.getLastName() == null ? "" : e.getLastName())).trim());
            m.put("code", e.getEmployeeCode());
            m.put("designation", e.getDesignation());
            notIn.add(m);
        }
        notIn.sort(Comparator.comparing(m -> String.valueOf(m.get("name"))));

        Map<String, Object> todayOut = new LinkedHashMap<>();
        todayOut.put("date", today);
        todayOut.put("staff", staff.size());
        todayOut.put("present", present.size());
        todayOut.put("onLeave", onLeave.size());
        todayOut.put("notIn", notIn.size());
        todayOut.put("notInPeople", notIn.size() > 40 ? notIn.subList(0, 40) : notIn);

        // --- waiting for HR ----------------------------------------------------
        int bonusesWaiting = 0;
        for (EmployeeBonus b : bonusRepository.findByIsDeletedFalseOrderByIdDesc()) {
            if ("PENDING".equalsIgnoreCase(b.getStatus()) || "RECOMMENDED".equalsIgnoreCase(b.getStatus())) bonusesWaiting++;
        }
        Map<String, Object> waiting = new LinkedHashMap<>();
        waiting.put("punches", attendanceAdminService.countPending());
        waiting.put("corrections", correctionRepository.findByStatusAndIsDeletedFalseOrderByIdDesc("PENDING").size());
        waiting.put("leave", leavePending);
        waiting.put("profileChanges", profileChangeRepository.findByStatusAndIsDeletedFalseOrderByIdDesc("PENDING").size());
        waiting.put("dailyReports", dailyReportRepository.countByIsDeletedFalseAndStatus("SUBMITTED"));
        waiting.put("moneyRequests", payrollRequestRepository.findByStatusAndIsDeletedFalseOrderByIdDesc("PENDING").size());
        waiting.put("bonuses", bonusesWaiting);

        // --- this month's payroll ----------------------------------------------
        int month = today.getMonthValue(), year = today.getYear();
        Map<String, Object> summary = payrollService.payrollSummary(month, year);
        Map<String, Object> payroll = new LinkedHashMap<>();
        payroll.put("month", month);
        payroll.put("year", year);
        payroll.put("payrollStaff", employeeRepository.findByPayrollEnabledTrueAndIsDeletedFalse().size());
        payroll.put("made", summary.get("employees"));
        payroll.put("toApprove", summary.get("toApprove"));
        payroll.put("toPay", summary.get("toPay"));
        payroll.put("paid", summary.get("paid"));
        payroll.put("netPayout", summary.get("employeeNetPayout"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("today", todayOut);
        out.put("waiting", waiting);
        out.put("payroll", payroll);
        return out;
    }
}

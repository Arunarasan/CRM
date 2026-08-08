package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class HrService {

    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AttendanceRepository attendanceRepository;
    @Autowired private LeaveRequestRepository leaveRequestRepository;
    @Autowired private EmployeeDocumentRepository documentRepository;
    @Autowired private SalaryRecordRepository salaryRepository;
    @Autowired private PerformanceReviewRepository performanceRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RoleRepository roleRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private TaskAssignmentRepository taskAssignmentRepository;

    /** Notifies an employee via their own login account (resolved by shared email), if one exists. */
    private void notifyEmployee(Employee employee, String title, String message, String type, String url) {
        if (employee == null || employee.getEmail() == null || employee.getEmail().isBlank()) return;
        userRepository.findByEmail(employee.getEmail())
                .ifPresent(u -> notificationService.dispatch(title, message, type, u.getId(), url));
    }

    // --- Departments ---
    public List<Department> getAllDepartments() {
        return departmentRepository.findAll();
    }
    public Department createDepartment(Department department) {
        return departmentRepository.save(department);
    }

    // --- Employees ---
    @Transactional
    public void syncEmployeesToUsers() {
        List<Employee> allEmployees = employeeRepository.findAll();
        for (Employee saved : allEmployees) {
            try {
                syncUserForEmployee(saved);
            } catch (Exception e) {
                System.err.println("Failed to sync user for employee " + saved.getId() + ": " + e.getMessage());
            }
        }
    }

    /**
     * Creates the login account for an employee if missing, and keeps the account's roles in step
     * with the employee's designation either way. Additive only — designation grants extra roles
     * (e.g. "Project Manager" → ROLE_PROJECT_MANAGER, so BOQ/Quotation access works), but roles are
     * never removed here, since an admin may have granted them independently of HR data.
     */
    private void syncUserForEmployee(Employee employee) {
        if (employee.getEmail() == null || employee.getEmail().trim().isEmpty()) {
            return;
        }
        User user = userRepository.findByEmail(employee.getEmail()).orElse(null);
        if (user == null) {
            user = new User();
            user.setName(employee.getFirstName() + " " + employee.getLastName());
            user.setEmail(employee.getEmail());
            user.setPassword(passwordEncoder.encode("password123")); // Default password
            user.setEmailVerified(true);
            user.setRoles(new java.util.HashSet<>());
        }
        java.util.Set<Role> roles = user.getRoles() != null ? user.getRoles() : new java.util.HashSet<>();
        roleRepository.findByName("ROLE_EMPLOYEE").ifPresent(roles::add);
        if (employee.getDesignation() != null && employee.getDesignation().toLowerCase().contains("manager")) {
            roleRepository.findByName("ROLE_PROJECT_MANAGER").ifPresent(roles::add);
        }
        user.setRoles(roles);
        userRepository.save(user);
    }

    public Page<Employee> getEmployees(int page, int size) {
        return employeeRepository.findAllByOrderByFirstNameAsc(PageRequest.of(page, size));
    }
    public Optional<Employee> getEmployee(Long id) {
        return employeeRepository.findById(id);
    }
    @Transactional
    public Employee createEmployee(Employee employee) {
        Employee saved = employeeRepository.save(employee);

        // Auto-create a corresponding User account for the employee so they can log in
        try {
            syncUserForEmployee(saved);
        } catch (Exception e) {
            System.err.println("Failed to auto-create user for employee: " + e.getMessage());
            // Proceed anyway so the Employee record is still saved
        }

        return saved;
    }

    @Transactional
    public Employee updateEmployee(Long id, Employee details) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new com.arudra.crm.exception.ResourceNotFoundException("Employee not found with id: " + id));
        if (details.getFirstName() != null) employee.setFirstName(details.getFirstName());
        if (details.getLastName() != null) employee.setLastName(details.getLastName());
        if (details.getEmail() != null) employee.setEmail(details.getEmail());
        if (details.getPhone() != null) employee.setPhone(details.getPhone());
        if (details.getDesignation() != null) employee.setDesignation(details.getDesignation());
        if (details.getDepartment() != null) employee.setDepartment(details.getDepartment());
        Employee saved = employeeRepository.save(employee);
        try {
            syncUserForEmployee(saved); // designation change may grant e.g. ROLE_PROJECT_MANAGER
        } catch (Exception e) {
            System.err.println("Failed to sync user roles for employee " + saved.getId() + ": " + e.getMessage());
        }
        return saved;
    }

    // --- Attendance ---
    public List<Attendance> getAttendanceForEmployee(Long employeeId) {
        return attendanceRepository.findByEmployeeId(employeeId);
    }
    
    public Attendance markAttendance(Attendance attendance) {
        if (attendance.getDate() == null) {
            attendance.setDate(LocalDate.now());
        }
        return attendanceRepository.save(attendance);
    }

    // --- Leaves ---
    public Page<LeaveRequest> getLeaveRequests(int page, int size) {
        return leaveRequestRepository.findAllByOrderByStartDateDesc(PageRequest.of(page, size));
    }
    public List<LeaveRequest> getLeaveRequestsForEmployee(Long employeeId) {
        return leaveRequestRepository.findByEmployeeId(employeeId);
    }
    
    public LeaveRequest createLeaveRequest(LeaveRequest request) {
        return leaveRequestRepository.save(request);
    }

    @Transactional
    public LeaveRequest approveLeaveRequest(Long id, String approvedBy) {
        LeaveRequest request = leaveRequestRepository.findById(id).orElseThrow();
        request.setStatus("APPROVED");
        request.setApprovedBy(approvedBy);
        
        // Auto-generate Attendance records for approved leave
        LocalDate currentDate = request.getStartDate();
        while (!currentDate.isAfter(request.getEndDate())) {
            Attendance attendance = new Attendance();
            attendance.setEmployee(request.getEmployee());
            attendance.setDate(currentDate);
            attendance.setStatus("LEAVE");
            attendance.setRemarks("Approved " + request.getType() + " leave");
            attendanceRepository.save(attendance);
            
            currentDate = currentDate.plusDays(1);
        }

        LeaveRequest saved = leaveRequestRepository.save(request);
        notifyEmployee(saved.getEmployee(), "Leave Approved",
                "Your " + saved.getType() + " leave (" + saved.getStartDate() + " → " + saved.getEndDate() + ") was approved.",
                "LEAVE", "/employee/leave");
        return saved;
    }

    public LeaveRequest rejectLeaveRequest(Long id) {
        LeaveRequest request = leaveRequestRepository.findById(id).orElseThrow();
        request.setStatus("REJECTED");
        LeaveRequest saved = leaveRequestRepository.save(request);
        notifyEmployee(saved.getEmployee(), "Leave Rejected",
                "Your " + saved.getType() + " leave (" + saved.getStartDate() + " → " + saved.getEndDate() + ") was rejected.",
                "LEAVE", "/employee/leave");
        return saved;
    }

    // --- Documents ---
    public List<EmployeeDocument> getDocumentsForEmployee(Long employeeId) {
        return documentRepository.findByEmployeeId(employeeId);
    }
    public EmployeeDocument addDocument(EmployeeDocument doc) {
        return documentRepository.save(doc);
    }

    // --- Payroll / Salary ---
    public Page<SalaryRecord> getSalaryRecords(int page, int size) {
        return salaryRepository.findAllByOrderByYearDescMonthDesc(PageRequest.of(page, size));
    }
    public List<SalaryRecord> getSalaryRecordsForEmployee(Long employeeId) {
        return salaryRepository.findByEmployeeIdOrderByYearDescMonthDesc(employeeId);
    }
    
    public SalaryRecord generateSalaryRecord(SalaryRecord record) {
        if (record.getNetSalary() == null) {
            record.setNetSalary(record.getBasic().add(record.getAllowances()).subtract(record.getDeductions()));
        }
        return salaryRepository.save(record);
    }
    
    public SalaryRecord markSalaryPaid(Long id) {
        SalaryRecord record = salaryRepository.findById(id).orElseThrow();
        record.setStatus("PAID");
        record.setPaymentDate(LocalDate.now());
        SalaryRecord saved = salaryRepository.save(record);
        notifyEmployee(saved.getEmployee(), "Salary Paid",
                "Your salary for " + saved.getMonth() + "/" + saved.getYear() + " has been paid"
                        + (saved.getNetSalary() != null ? " (₹" + saved.getNetSalary() + ")" : "") + ".",
                "SALARY", "/employee/salary");
        return saved;
    }

    // --- Performance Reviews ---
    public List<PerformanceReview> getPerformanceReviewsForEmployee(Long employeeId) {
        return performanceRepository.findByEmployeeIdOrderByReviewDateDesc(employeeId);
    }
    public PerformanceReview addPerformanceReview(PerformanceReview review) {
        return performanceRepository.save(review);
    }

    // --- Performance Scoring (auto-calculated) --------------------------------
    // A single 0–100 performance score is derived from three signals, each scored
    // 0–100 and combined with weights redistributed over whatever data exists:
    //   • Attendance (40%): present/half-day credit over marked days (last 90d).
    //   • Tasks (35%): completion rate (70%) blended with on-time delivery (30%).
    //   • Reviews (25%): average manual star rating (1–5) scaled to 100.
    // If a signal has no data it is dropped and the remaining weights re-normalise;
    // an employee with no data at all scores null / grade "N/A".
    private static final double W_ATTENDANCE = 0.40, W_TASKS = 0.35, W_REVIEWS = 0.25;
    private static final int PERFORMANCE_WINDOW_DAYS = 90;

    public Map<String, Object> computePerformance(Long employeeId) {
        Employee emp = employeeRepository.findById(employeeId).orElseThrow();
        LocalDate today = LocalDate.now();
        LocalDate windowStart = today.minusDays(PERFORMANCE_WINDOW_DAYS);

        // --- Attendance ---
        List<Attendance> attendance =
                attendanceRepository.findByEmployeeIdAndDateBetween(employeeId, windowStart, today);
        int present = 0, absent = 0, halfDay = 0, leave = 0;
        double countable = 0, credited = 0;
        for (Attendance a : attendance) {
            String s = a.getStatus() == null ? "" : a.getStatus().toUpperCase();
            switch (s) {
                case "PRESENT":  present++;  countable++; credited += 1.0; break;
                case "HALF_DAY": halfDay++;  countable++; credited += 0.5; break;
                case "ABSENT":   absent++;   countable++;                  break;
                case "LEAVE":    leave++;                                  break; // approved leave excluded
                default: break;
            }
        }
        boolean hasAttendance = countable > 0;
        double attendanceScore = hasAttendance ? credited / countable * 100.0 : 0;

        // --- Tasks --- (EMPLOYEE assignments key off users.id, resolved by email)
        List<TaskAssignment> tasks = new ArrayList<>();
        if (emp.getEmail() != null && !emp.getEmail().isBlank()) {
            userRepository.findByEmail(emp.getEmail()).ifPresent(u ->
                    tasks.addAll(taskAssignmentRepository.findByResourceTypeAndResourceId("EMPLOYEE", u.getId())));
        }
        int totalTasks = tasks.size(), completed = 0, onTime = 0, overdue = 0;
        for (TaskAssignment t : tasks) {
            if ("COMPLETED".equalsIgnoreCase(t.getStatus())) {
                completed++;
                if (t.getExpectedCompletion() != null && t.getCompletedAt() != null) {
                    if (t.getCompletedAt().isAfter(t.getExpectedCompletion())) overdue++; else onTime++;
                }
            }
        }
        boolean hasTasks = totalTasks > 0;
        double taskScore = 0;
        if (hasTasks) {
            double completionRate = (double) completed / totalTasks;
            int decided = onTime + overdue;
            double punctuality = decided > 0 ? (double) onTime / decided : 1.0;
            taskScore = (completionRate * 0.7 + punctuality * 0.3) * 100.0;
        }

        // --- Reviews ---
        List<PerformanceReview> reviews = performanceRepository.findByEmployeeIdOrderByReviewDateDesc(employeeId);
        boolean hasReviews = !reviews.isEmpty();
        double avgRating = 0, reviewScore = 0;
        if (hasReviews) {
            double sum = 0;
            for (PerformanceReview r : reviews) sum += r.getRating() == null ? 0 : r.getRating();
            avgRating = sum / reviews.size();
            reviewScore = avgRating / 5.0 * 100.0;
        }

        // --- Weighted composite over available signals ---
        double num = 0, den = 0;
        if (hasAttendance) { num += attendanceScore * W_ATTENDANCE; den += W_ATTENDANCE; }
        if (hasTasks)      { num += taskScore      * W_TASKS;      den += W_TASKS; }
        if (hasReviews)    { num += reviewScore    * W_REVIEWS;    den += W_REVIEWS; }
        Double score = den > 0 ? round1(num / den) : null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("employeeId", emp.getId());
        result.put("employeeCode", emp.getEmployeeCode());
        result.put("employeeName", emp.getFirstName() + " " + emp.getLastName());
        result.put("designation", emp.getDesignation());
        result.put("department", emp.getDepartment() != null ? emp.getDepartment().getName() : null);
        result.put("status", emp.getStatus());
        result.put("score", score);
        result.put("grade", grade(score));
        result.put("hasData", den > 0);

        Map<String, Object> att = new LinkedHashMap<>();
        att.put("score", hasAttendance ? round1(attendanceScore) : null);
        att.put("weight", W_ATTENDANCE);
        att.put("present", present);
        att.put("absent", absent);
        att.put("halfDay", halfDay);
        att.put("leave", leave);
        att.put("windowDays", PERFORMANCE_WINDOW_DAYS);
        result.put("attendance", att);

        Map<String, Object> tsk = new LinkedHashMap<>();
        tsk.put("score", hasTasks ? round1(taskScore) : null);
        tsk.put("weight", W_TASKS);
        tsk.put("total", totalTasks);
        tsk.put("completed", completed);
        tsk.put("onTime", onTime);
        tsk.put("overdue", overdue);
        result.put("tasks", tsk);

        Map<String, Object> rev = new LinkedHashMap<>();
        rev.put("score", hasReviews ? round1(reviewScore) : null);
        rev.put("weight", W_REVIEWS);
        rev.put("count", reviews.size());
        rev.put("avgRating", hasReviews ? round1(avgRating) : null);
        result.put("reviews", rev);

        return result;
    }

    /** Performance scorecards for every non-deleted employee, best score first (for the HR dashboard). */
    public List<Map<String, Object>> getPerformanceScores() {
        return employeeRepository.findAll().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .map(e -> computePerformance(e.getId()))
                .sorted((x, y) -> Double.compare(scoreOf(y), scoreOf(x)))
                .collect(Collectors.toList());
    }

    private static double scoreOf(Map<String, Object> card) {
        Object s = card.get("score");
        return s instanceof Number ? ((Number) s).doubleValue() : -1;
    }

    private static Double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static String grade(Double score) {
        if (score == null) return "N/A";
        if (score >= 85) return "A";
        if (score >= 70) return "B";
        if (score >= 55) return "C";
        return "D";
    }
}

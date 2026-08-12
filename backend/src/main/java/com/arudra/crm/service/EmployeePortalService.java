package com.arudra.crm.service;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The employee's own view of the HR system, scoped to the {@link Employee} master record linked
 * to the signed-in {@link User} by shared email. Every read and write here re-derives that
 * employee from the security context — an employee can never address another employee's
 * attendance, leave, salary or documents by id (the URL-manipulation guard the spec requires).
 *
 * <p>Task/project data lives on the assignment layer (keyed by {@code users.id}); this service
 * delegates those to {@link EmployeeTaskService} with the current {@link User}. HR master data
 * (profile, attendance, leave, salary, documents) is keyed by {@code employees.id}.
 */
@Service
public class EmployeePortalService {

    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private AttendanceRepository attendanceRepository;
    @Autowired private LeaveRequestRepository leaveRequestRepository;
    @Autowired private SalaryRecordRepository salaryRecordRepository;
    @Autowired private SalaryStructureRepository salaryStructureRepository;
    @Autowired private EmployeeDocumentRepository documentRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private EmployeeTaskService employeeTaskService;
    @Autowired private EmployeeTimeService employeeTimeService;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    // Phase 2 — operational self-service (reuse the existing company services, self-scoped here).
    @Autowired private MaterialRequestService materialRequestService;
    @Autowired private MaterialRequestRepository materialRequestRepository;
    @Autowired private LeadService leadService;
    @Autowired private LeadRepository leadRepository;
    @Autowired private ProductRepository productRepository;
    // Phase 3 — net-new self-service modules
    @Autowired private ManpowerRequestRepository manpowerRequestRepository;
    @Autowired private DailyReportRepository dailyReportRepository;
    @Autowired private PersonalReminderRepository personalReminderRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private EmployeeBonusRepository bonusRepository;

    /** Annual leave allowance used to derive a simple balance until a policy engine exists. */
    private static final int DEFAULT_ANNUAL_LEAVE = 24;

    /** Resolves the employee behind the signed-in user, or fails loudly. */
    public Employee requireEmployee(User currentUser) {
        if (currentUser == null) {
            throw new IllegalStateException("Not authenticated.");
        }
        return employeeRepository.findByEmailIgnoreCaseAndIsDeletedFalse(currentUser.getEmail())
                .orElseThrow(() -> new IllegalStateException(
                        "This login is not linked to an employee record."));
    }

    // =====================================================================
    // Profile
    // =====================================================================

    public Employee getProfile(User currentUser) {
        return requireEmployee(currentUser);
    }

    // =====================================================================
    // Dashboard
    // =====================================================================

    public Map<String, Object> getDashboard(User currentUser) {
        Employee employee = requireEmployee(currentUser);
        Long empId = employee.getId();
        LocalDate today = LocalDate.now();

        Map<String, Object> dash = new LinkedHashMap<>();
        dash.put("employee", employee);

        // Today's attendance (own record for today, if any)
        Attendance todayAtt = attendanceRepository.findByEmployeeIdAndDateBetween(empId, today, today)
                .stream().findFirst().orElse(null);
        dash.put("todayAttendance", todayAtt == null ? "NOT_MARKED" : todayAtt.getStatus());
        dash.put("todayCheckIn", todayAtt == null ? null : todayAtt.getCheckInTime());
        dash.put("todayCheckOut", todayAtt == null ? null : todayAtt.getCheckOutTime());

        // Tasks (assignment layer — keyed by the user)
        Map<String, Object> taskHome = employeeTaskService.getHome(currentUser);
        dash.put("todaysTasks", taskHome.get("dueToday"));
        dash.put("overdueTasks", taskHome.get("overdue"));
        dash.put("upcomingDeadlines", taskHome.get("upcoming"));

        // Projects
        dash.put("assignedProjects", employeeTaskService.getMyProjects(currentUser).size());

        // Leave
        List<LeaveRequest> pendingLeaves = leaveRequestRepository.findByEmployeeIdAndStatus(empId, "PENDING");
        dash.put("pendingLeaves", pendingLeaves.size());
        dash.put("leaveBalance", leaveBalanceRemaining(empId, today.getYear()));

        // Salary status (latest record)
        List<SalaryRecord> records = salaryRecordRepository.findByEmployeeIdOrderByYearDescMonthDesc(empId);
        SalaryRecord latest = records.isEmpty() ? null : records.get(0);
        dash.put("lastSalaryStatus", latest == null ? "NONE" : latest.getStatus());
        dash.put("lastSalaryMonth", latest == null ? null : latest.getMonth() + "/" + latest.getYear());

        // Notifications (recipient = user id)
        dash.put("unreadNotifications", notificationRepository.countByRecipientIdAndIsReadFalse(currentUser.getId()));

        // Live time-clock + hourly earnings (today / week / month + running)
        Map<String, Object> time = employeeTimeService.getStatus(currentUser);
        dash.put("time", time);

        // Profile completion
        dash.put("profileCompletion", profileCompletion(employee));

        // --- My Performance (personal stats only) ---------------------------
        Map<String, Object> weekly = employeeTimeService.getTimesheet(currentUser, "WEEKLY");
        int attendancePct = attendancePercentage(empId, today);
        long completedWeek = ((Number) taskHome.getOrDefault("completedThisWeek", 0)).longValue();
        long tasksPending = ((Number) taskHome.getOrDefault("pending", 0)).longValue();
        long completedToday = ((Number) taskHome.getOrDefault("completedToday", 0)).longValue();
        long taskDenom = completedWeek + tasksPending;
        int taskCompletionRate = taskDenom == 0 ? 0 : (int) Math.round(completedWeek * 100.0 / taskDenom);

        Map<String, Object> performance = new LinkedHashMap<>();
        performance.put("tasksCompletedThisWeek", completedWeek);
        performance.put("tasksCompletedToday", completedToday);
        performance.put("tasksPending", tasksPending);
        performance.put("hoursToday", time.get("todayHours"));
        performance.put("hoursThisWeek", weekly.get("totalHours"));
        performance.put("overtimeHours", weekly.get("totalOvertime"));
        performance.put("monthEarnings", time.get("monthEarnings"));
        performance.put("attendancePercentage", attendancePct);
        // Transparent heuristic: mean of attendance % and this-week task completion rate.
        performance.put("productivityScore", (int) Math.round((attendancePct + taskCompletionRate) / 2.0));
        dash.put("performance", performance);

        // --- My Requests (own counts) ---------------------------------------
        List<MaterialRequest> myMaterial = materialRequestRepository.findByRequestedByIdOrderByIdDesc(currentUser.getId());
        List<ManpowerRequest> myManpower = manpowerRequestRepository.findByRequestedByIdAndIsDeletedFalseOrderByIdDesc(currentUser.getId());
        List<Map<String, Object>> myLeads = getMyLeads(currentUser);
        List<DailyReport> myReports = dailyReportRepository.findByEmployeeIdAndIsDeletedFalseOrderByReportDateDescIdDesc(currentUser.getId());

        Map<String, Object> requests = new LinkedHashMap<>();
        requests.put("materialRequests", myMaterial.size());
        requests.put("manpowerRequests", myManpower.size());
        requests.put("leaveRequests", pendingLeaves.size());
        requests.put("leads", myLeads.size());
        requests.put("dailyReports", myReports.size());
        long pendingApprovals = myMaterial.stream().filter(m -> "PENDING".equals(m.getStatus())).count()
                + myManpower.stream().filter(m -> "PENDING".equals(m.getStatus())).count()
                + pendingLeaves.size();
        requests.put("pendingApprovals", pendingApprovals);
        dash.put("requests", requests);

        // --- Recent Activity ------------------------------------------------
        Map<String, Object> recent = new LinkedHashMap<>();
        recent.put("latestMaterialRequest", myMaterial.isEmpty() ? null
                : Map.of("label", myMaterial.get(0).getRequestNumber(), "status", myMaterial.get(0).getStatus()));
        recent.put("latestManpowerRequest", myManpower.isEmpty() ? null
                : Map.of("label", myManpower.get(0).getRequestNumber(), "status", myManpower.get(0).getStatus()));
        recent.put("latestLead", myLeads.isEmpty() ? null
                : Map.of("label", String.valueOf(myLeads.get(0).get("name")),
                         "status", String.valueOf(myLeads.get(0).getOrDefault("status", ""))));
        recent.put("latestDailyReport", myReports.isEmpty() ? null
                : Map.of("label", String.valueOf(myReports.get(0).getReportDate()), "status", myReports.get(0).getStatus()));
        recent.put("lastAttendance", todayAtt == null ? null
                : Map.of("label", String.valueOf(today), "status", todayAtt.getStatus()));
        dash.put("recentActivity", recent);

        return dash;
    }

    /**
     * Attendance % for the current month so far: present-equivalent days over elapsed working days
     * (every day except Sunday counts as a working day — the business runs a 6-day week). Returns
     * 0 when no working days have elapsed.
     */
    private int attendancePercentage(Long employeeId, LocalDate today) {
        LocalDate monthStart = today.withDayOfMonth(1);
        int workingDays = 0;
        for (LocalDate d = monthStart; !d.isAfter(today); d = d.plusDays(1)) {
            if (d.getDayOfWeek() != java.time.DayOfWeek.SUNDAY) workingDays++;
        }
        if (workingDays == 0) return 0;
        double present = attendanceRepository.findByEmployeeIdAndDateBetween(employeeId, monthStart, today).stream()
                .mapToDouble(a -> "PRESENT".equals(a.getStatus()) ? 1.0 : "HALF_DAY".equals(a.getStatus()) ? 0.5 : 0.0)
                .sum();
        return (int) Math.round(Math.min(100.0, present * 100.0 / workingDays));
    }

    // =====================================================================
    // Profile self-edit + password
    // =====================================================================

    /**
     * Updates the fields an employee is allowed to change themselves. Read-only master data
     * (code, salary, hourly rate, department, designation, manager, joining date) is never touched
     * here, and the email that links this record to the login account is intentionally excluded.
     */
    @LogActivity(module = "EMPLOYEE_PORTAL", action = "PROFILE_UPDATE")
    @Transactional
    public Employee updateProfile(User currentUser, Map<String, String> updates) {
        Employee employee = requireEmployee(currentUser);
        if (updates.containsKey("phone")) employee.setPhone(trimToNull(updates.get("phone")));
        if (updates.containsKey("emergencyContactName")) employee.setEmergencyContactName(trimToNull(updates.get("emergencyContactName")));
        if (updates.containsKey("emergencyContactPhone")) employee.setEmergencyContactPhone(trimToNull(updates.get("emergencyContactPhone")));
        if (updates.containsKey("profilePhotoUrl")) employee.setProfilePhotoUrl(trimToNull(updates.get("profilePhotoUrl")));
        return employeeRepository.save(employee);
    }

    @LogActivity(module = "EMPLOYEE_PORTAL", action = "PASSWORD_CHANGE")
    @Transactional
    public void changePassword(User currentUser, String currentPassword, String newPassword) {
        requireEmployee(currentUser); // must be a linked employee
        User user = userRepository.findByEmail(currentUser.getEmail())
                .orElseThrow(() -> new IllegalStateException("Login account not found."));
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect.");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("New password must be at least 6 characters.");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    // =====================================================================
    // Attendance
    // =====================================================================

    public List<Attendance> getAttendance(User currentUser, LocalDate from, LocalDate to) {
        Employee employee = requireEmployee(currentUser);
        if (from == null) from = LocalDate.now().withDayOfMonth(1);
        if (to == null) to = from.plusMonths(1).minusDays(1);
        return attendanceRepository.findByEmployeeIdAndDateBetween(employee.getId(), from, to);
    }

    // =====================================================================
    // Leave
    // =====================================================================

    public List<LeaveRequest> getLeaves(User currentUser) {
        return leaveRequestRepository.findByEmployeeId(requireEmployee(currentUser).getId());
    }

    public Map<String, Object> getLeaveBalance(User currentUser) {
        Employee employee = requireEmployee(currentUser);
        int year = LocalDate.now().getYear();
        int taken = leaveDaysTaken(employee.getId(), year);
        Map<String, Object> balance = new LinkedHashMap<>();
        balance.put("annualAllowance", DEFAULT_ANNUAL_LEAVE);
        balance.put("taken", taken);
        balance.put("remaining", Math.max(0, DEFAULT_ANNUAL_LEAVE - taken));
        return balance;
    }

    /** Applies for leave against the signed-in employee. Employee id is server-set, never trusted from the body. */
    @Transactional
    public LeaveRequest applyLeave(User currentUser, LeaveRequest request) {
        Employee employee = requireEmployee(currentUser);
        if (request.getStartDate() == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("Start and end date are required.");
        }
        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new IllegalArgumentException("End date cannot be before start date.");
        }
        request.setId(null);
        request.setEmployee(employee);
        request.setStatus("PENDING");
        request.setApprovedBy(null);
        // HR/admins action pending leave from their existing leave queue (/api/hr/leaves).
        return leaveRequestRepository.save(request);
    }

    // =====================================================================
    // Salary
    // =====================================================================

    public List<SalaryRecord> getPayslips(User currentUser) {
        return salaryRecordRepository.findByEmployeeIdOrderByYearDescMonthDesc(requireEmployee(currentUser).getId());
    }

    public SalaryRecord getPayslip(User currentUser, Long recordId) {
        Employee employee = requireEmployee(currentUser);
        SalaryRecord record = salaryRecordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalStateException("Payslip not found."));
        if (record.getEmployee() == null || !record.getEmployee().getId().equals(employee.getId())) {
            throw new IllegalStateException("This payslip does not belong to you.");
        }
        return record;
    }

    public Map<String, Object> getSalarySummary(User currentUser) {
        Employee employee = requireEmployee(currentUser);
        SalaryStructure structure = salaryStructureRepository
                .findFirstByEmployeeIdAndActiveTrueOrderByIdDesc(employee.getId()).orElse(null);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("structure", structure);
        summary.put("baseSalary", employee.getBaseSalary());
        summary.put("salaryType", employee.getSalaryType());
        summary.put("hourlyRate", employee.getHourlyRate());
        summary.put("payslips", salaryRecordRepository.findByEmployeeIdOrderByYearDescMonthDesc(employee.getId()));
        summary.putAll(getMyBonuses(currentUser));
        return summary;
    }

    /**
     * The employee's own bonus ledger (project-completion / performance / other), as compact maps so the
     * account view never leaks other employees' data or trips Jackson on lazy relations. Totals included.
     */
    public Map<String, Object> getMyBonuses(User currentUser) {
        Employee employee = requireEmployee(currentUser);
        List<EmployeeBonus> list = bonusRepository.findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(employee.getId());
        java.math.BigDecimal paid = java.math.BigDecimal.ZERO, pending = java.math.BigDecimal.ZERO;
        List<Map<String, Object>> rows = new java.util.ArrayList<>();
        for (EmployeeBonus b : list) {
            java.math.BigDecimal amt = b.getAmount() == null ? java.math.BigDecimal.ZERO : b.getAmount();
            if ("PAID".equals(b.getStatus())) paid = paid.add(amt);
            else pending = pending.add(amt); // PENDING + APPROVED are both "coming to you"
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", b.getId());
            row.put("bonusType", b.getBonusType());
            row.put("amount", amt);
            row.put("status", b.getStatus());
            row.put("reason", b.getReason());
            row.put("awardDate", b.getAwardDate());
            row.put("projectName", b.getProject() != null ? b.getProject().getProjectName() : null);
            rows.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("bonuses", rows);
        out.put("bonusPaidTotal", paid);
        out.put("bonusPendingTotal", pending);
        return out;
    }

    // =====================================================================
    // Documents
    // =====================================================================

    public List<EmployeeDocument> getDocuments(User currentUser) {
        return documentRepository.findByEmployeeId(requireEmployee(currentUser).getId());
    }

    // =====================================================================
    // Projects (assignment layer)
    // =====================================================================

    public List<Map<String, Object>> getProjects(User currentUser) {
        requireEmployee(currentUser); // guard: only employees reach this view
        return employeeTaskService.getMyProjects(currentUser);
    }

    /** Other active projects (not the employee's own) that have tasks they can pick up. */
    public List<Map<String, Object>> getOtherProjects(User currentUser) {
        requireEmployee(currentUser);
        return employeeTaskService.getOtherProjects(currentUser);
    }

    /** The unassigned, pickable tasks in a project. */
    public List<Map<String, Object>> getProjectOpenTasks(User currentUser, Long projectId) {
        requireEmployee(currentUser);
        return employeeTaskService.getProjectOpenTasks(projectId, currentUser);
    }

    /** Pick up (self-assign) an unassigned task in any project. */
    @Transactional
    public void pickUpTask(User currentUser, Long taskId) {
        requireEmployee(currentUser);
        employeeTaskService.selfAssign(taskId, currentUser);
    }

    // =====================================================================
    // Material Requests (operational — reuses MaterialRequestService, self-scoped)
    // =====================================================================

    /** Only the material requests this user raised. */
    public List<MaterialRequest> getMyMaterialRequests(User currentUser) {
        requireEmployee(currentUser);
        return materialRequestService.getMine(currentUser.getId());
    }

    /** One of the user's own material requests, guarded against reading someone else's by id. */
    public MaterialRequest getMyMaterialRequest(User currentUser, Long id) {
        requireEmployee(currentUser);
        MaterialRequest mr = materialRequestRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("Material request not found."));
        if (mr.getRequestedBy() == null || !mr.getRequestedBy().getId().equals(currentUser.getId())) {
            throw new IllegalStateException("This material request does not belong to you.");
        }
        return mr;
    }

    /**
     * Raises a material request for the signed-in employee. requestedBy is server-set from the
     * security context (never trusted from the body). Priority and expected date aren't columns on
     * the request entity, so they're folded into the remarks note for the approver to see.
     */
    @LogActivity(module = "EMPLOYEE_PORTAL", action = "MATERIAL_REQUEST_CREATE")
    @Transactional
    @SuppressWarnings("unchecked")
    public MaterialRequest createMaterialRequest(User currentUser, Map<String, Object> body) {
        requireEmployee(currentUser);
        Long taskId = asLong(body.get("taskId"));
        Long projectId = asLong(body.get("projectId"));
        Long warehouseId = asLong(body.get("warehouseId"));
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("At least one material line is required.");
        }
        StringBuilder remarks = new StringBuilder();
        if (notBlank((String) body.get("reason"))) remarks.append(body.get("reason"));
        if (notBlank((String) body.get("priority"))) remarks.append(" | Priority: ").append(body.get("priority"));
        if (notBlank((String) body.get("expectedDate"))) remarks.append(" | Expected: ").append(body.get("expectedDate"));
        return materialRequestService.create(taskId, projectId, warehouseId, items,
                remarks.length() == 0 ? null : remarks.toString().trim(), currentUser);
    }

    /** Product-name lookup for the mobile material picker — names/units only, never stock levels. */
    public List<Map<String, Object>> searchMaterials(User currentUser, String q) {
        requireEmployee(currentUser);
        var page = productRepository.searchProducts(q == null ? "" : q.trim(),
                org.springframework.data.domain.PageRequest.of(0, 20));
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (Product p : page.getContent()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            m.put("unit", p.getUnit());
            out.add(m);
        }
        return out;
    }

    // =====================================================================
    // Leads (create-only + own-leads — reuses LeadService)
    // =====================================================================

    /** Leads this employee raised (owns), most recent first. */
    public List<Map<String, Object>> getMyLeads(User currentUser) {
        requireEmployee(currentUser);
        return leadRepository.findByLeadOwnerIdAndIsDeletedFalseOrderByIdDesc(currentUser.getId())
                .stream().map(this::leadSummary).toList();
    }

    /**
     * Creates a lead from the field. The employee owns it (lead_owner_id) so it shows up under
     * "My Leads"; status is forced to New for the manager-review workflow and conversion is never
     * exposed here. Only a safe subset of fields is accepted from the body.
     */
    @LogActivity(module = "EMPLOYEE_PORTAL", action = "LEAD_CREATE")
    @Transactional
    public Map<String, Object> createLead(User currentUser, Map<String, Object> body) {
        requireEmployee(currentUser);
        String name = trimToNull((String) body.get("name"));
        if (name == null) {
            throw new IllegalArgumentException("Customer / lead name is required.");
        }
        Lead lead = new Lead();
        lead.setName(name);
        lead.setMobileNumber(trimToNull((String) body.get("mobileNumber")));
        lead.setEmail(trimToNull((String) body.get("email")));
        lead.setAddress(trimToNull((String) body.get("address")));
        lead.setCity(trimToNull((String) body.get("city")));
        lead.setRequirementCategory(trimToNull((String) body.get("requirementCategory")));
        lead.setCustomerRequirements(trimToNull((String) body.get("requirement")));
        lead.setRemarks(trimToNull((String) body.get("notes")));
        lead.setEstimatedBudget(asDecimal(body.get("estimatedBudget")));
        LocalDate visit = asDate(body.get("preferredVisitDate"));
        if (visit != null) {
            lead.setSiteVisitDate(visit);
            lead.setSiteVisitRequired(true);
        }
        lead.setStatus("New");
        lead.setLeadSource("Employee");
        lead.setLeadOwner(currentUser);
        Lead saved = leadService.createLead(lead, currentUser);
        return leadSummary(saved);
    }

    private Map<String, Object> leadSummary(Lead l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("leadNumber", l.getLeadNumber());
        m.put("name", l.getName());
        m.put("mobileNumber", l.getMobileNumber());
        m.put("email", l.getEmail());
        m.put("city", l.getCity());
        m.put("status", l.getStatus());
        m.put("stage", l.getStage());
        m.put("requirementCategory", l.getRequirementCategory());
        m.put("estimatedBudget", l.getEstimatedBudget());
        m.put("siteVisitDate", l.getSiteVisitDate());
        m.put("createdAt", l.getCreatedAt());
        return m;
    }

    private static Long asLong(Object v) {
        if (v == null || String.valueOf(v).isBlank()) return null;
        return Long.valueOf(String.valueOf(v));
    }

    private static java.math.BigDecimal asDecimal(Object v) {
        if (v == null || String.valueOf(v).isBlank()) return null;
        return new java.math.BigDecimal(String.valueOf(v));
    }

    private static LocalDate asDate(Object v) {
        if (v == null || String.valueOf(v).isBlank()) return null;
        return LocalDate.parse(String.valueOf(v));
    }

    private static Integer asInt(Object v) {
        if (v == null || String.valueOf(v).isBlank()) return null;
        return Integer.valueOf(String.valueOf(v));
    }

    /** Notifies the project's manager (if any) AND all admins about an employee portal action. */
    private void notifyManagementFor(Project project, User actor, String title, String message, String type, String link) {
        if (project != null && project.getProjectManager() != null) {
            notificationService.dispatch(title, message, type, project.getProjectManager().getId(), link);
        }
        notificationService.dispatchToAdmins(title, message, type, link, actor != null ? actor.getId() : null);
    }

    // =====================================================================
    // Manpower Requests (net-new — self-scoped)
    // =====================================================================

    public List<ManpowerRequest> getMyManpowerRequests(User currentUser) {
        requireEmployee(currentUser);
        return manpowerRequestRepository.findByRequestedByIdAndIsDeletedFalseOrderByIdDesc(currentUser.getId());
    }

    @LogActivity(module = "EMPLOYEE_PORTAL", action = "MANPOWER_REQUEST_CREATE")
    @Transactional
    public ManpowerRequest createManpowerRequest(User currentUser, Map<String, Object> body) {
        requireEmployee(currentUser);
        Integer required = asInt(body.get("requiredWorkers"));
        if (required == null || required <= 0) {
            throw new IllegalArgumentException("Required workers must be at least 1.");
        }
        ManpowerRequest r = new ManpowerRequest();
        r.setRequestNumber("MPR-" + System.currentTimeMillis());
        r.setRequestedBy(currentUser);
        Long projectId = asLong(body.get("projectId"));
        if (projectId != null) r.setProject(projectRepository.findById(projectId).orElseThrow());
        Long taskId = asLong(body.get("taskId"));
        if (taskId != null) r.setTask(taskRepository.findById(taskId).orElseThrow());
        r.setCurrentWorkers(asInt(body.get("currentWorkers")));
        r.setRequiredWorkers(required);
        r.setSkillRequired(trimToNull((String) body.get("skillRequired")));
        r.setReason(trimToNull((String) body.get("reason")));
        r.setPriority(trimToNull((String) body.get("priority")));
        r.setRequiredDate(asDate(body.get("requiredDate")));
        r.setStatus("PENDING");
        ManpowerRequest saved = manpowerRequestRepository.save(r);
        notifyManagementFor(saved.getProject(), currentUser, "Manpower Request",
                saved.getRequestNumber() + " raised by " + currentUser.getName(),
                "MANPOWER_REQUEST", "/projects");
        return saved;
    }

    // =====================================================================
    // Daily Reports (net-new — self-scoped)
    // =====================================================================

    public List<DailyReport> getMyDailyReports(User currentUser) {
        requireEmployee(currentUser);
        return dailyReportRepository.findByEmployeeIdAndIsDeletedFalseOrderByReportDateDescIdDesc(currentUser.getId());
    }

    @LogActivity(module = "EMPLOYEE_PORTAL", action = "DAILY_REPORT_CREATE")
    @Transactional
    @SuppressWarnings("unchecked")
    public DailyReport createDailyReport(User currentUser, Map<String, Object> body) {
        requireEmployee(currentUser);
        DailyReport report = new DailyReport();
        report.setEmployee(currentUser);
        LocalDate date = asDate(body.get("reportDate"));
        report.setReportDate(date != null ? date : LocalDate.now());
        Long projectId = asLong(body.get("projectId"));
        if (projectId != null) report.setProject(projectRepository.findById(projectId).orElseThrow());
        Long taskId = asLong(body.get("taskId"));
        if (taskId != null) report.setTask(taskRepository.findById(taskId).orElseThrow());
        report.setTodaysWork(trimToNull((String) body.get("todaysWork")));
        report.setHoursWorked(asDecimal(body.get("hoursWorked")));
        report.setCompletedWork(trimToNull((String) body.get("completedWork")));
        report.setPendingWork(trimToNull((String) body.get("pendingWork")));
        report.setProblems(trimToNull((String) body.get("problems")));
        report.setMaterialUsed(trimToNull((String) body.get("materialUsed")));
        report.setMaterialRequired(trimToNull((String) body.get("materialRequired")));
        report.setRemarks(trimToNull((String) body.get("remarks")));
        report.setStatus("SUBMITTED");

        List<Map<String, Object>> media = (List<Map<String, Object>>) body.get("media");
        if (media != null) {
            for (Map<String, Object> m : media) {
                String url = trimToNull((String) m.get("fileUrl"));
                if (url == null) continue;
                DailyReportMedia item = new DailyReportMedia();
                item.setReport(report);
                item.setMediaType(m.get("mediaType") != null ? String.valueOf(m.get("mediaType")) : "PHOTO");
                item.setFileUrl(url);
                item.setCaption(trimToNull((String) m.get("caption")));
                report.getMedia().add(item);
            }
        }
        DailyReport saved = dailyReportRepository.save(report);
        notifyManagementFor(saved.getProject(), currentUser, "Daily Report",
                currentUser.getName() + " submitted a report for " + saved.getReportDate(),
                "DAILY_REPORT", "/projects");
        return saved;
    }

    // =====================================================================
    // Personal Reminders — "Task Management" (net-new, private to the user)
    // =====================================================================

    public List<PersonalReminder> getMyReminders(User currentUser) {
        requireEmployee(currentUser);
        return personalReminderRepository
                .findByOwnerIdAndIsDeletedFalseOrderByStatusAscDueDateAscIdDesc(currentUser.getId());
    }

    @Transactional
    public PersonalReminder createReminder(User currentUser, Map<String, Object> body) {
        requireEmployee(currentUser);
        String title = trimToNull((String) body.get("title"));
        if (title == null) {
            throw new IllegalArgumentException("Reminder title is required.");
        }
        PersonalReminder r = new PersonalReminder();
        r.setOwner(currentUser);
        r.setTitle(title);
        r.setNotes(trimToNull((String) body.get("notes")));
        r.setDueDate(asDate(body.get("dueDate")));
        r.setPriority(trimToNull((String) body.get("priority")));
        r.setStatus("PENDING");
        return personalReminderRepository.save(r);
    }

    private PersonalReminder requireOwnReminder(User currentUser, Long id) {
        requireEmployee(currentUser);
        PersonalReminder r = personalReminderRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("Reminder not found."));
        if (r.getOwner() == null || !r.getOwner().getId().equals(currentUser.getId()) || Boolean.TRUE.equals(r.getIsDeleted())) {
            throw new IllegalStateException("This reminder does not belong to you.");
        }
        return r;
    }

    @Transactional
    public PersonalReminder toggleReminder(User currentUser, Long id) {
        PersonalReminder r = requireOwnReminder(currentUser, id);
        if ("DONE".equals(r.getStatus())) {
            r.setStatus("PENDING");
            r.setCompletedAt(null);
        } else {
            r.setStatus("DONE");
            r.setCompletedAt(java.time.LocalDateTime.now());
        }
        return personalReminderRepository.save(r);
    }

    @Transactional
    public void deleteReminder(User currentUser, Long id) {
        PersonalReminder r = requireOwnReminder(currentUser, id);
        r.setIsDeleted(true);
        r.setDeletedAt(java.time.LocalDateTime.now());
        personalReminderRepository.save(r);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private int leaveDaysTaken(Long employeeId, int year) {
        return leaveRequestRepository.findByEmployeeIdAndStatus(employeeId, "APPROVED").stream()
                .filter(l -> l.getStartDate() != null && l.getStartDate().getYear() == year)
                .mapToInt(l -> (int) (l.getStartDate().datesUntil(l.getEndDate().plusDays(1)).count()))
                .sum();
    }

    private int leaveBalanceRemaining(Long employeeId, int year) {
        return Math.max(0, DEFAULT_ANNUAL_LEAVE - leaveDaysTaken(employeeId, year));
    }

    /** A rough completeness score over the fields an employee is expected to keep current. */
    private int profileCompletion(Employee e) {
        int total = 10, filled = 0;
        if (notBlank(e.getFirstName())) filled++;
        if (notBlank(e.getEmail())) filled++;
        if (notBlank(e.getPhone())) filled++;
        if (notBlank(e.getProfilePhotoUrl())) filled++;
        if (e.getDepartment() != null) filled++;
        if (notBlank(e.getDesignation())) filled++;
        if (notBlank(e.getEmergencyContactPhone())) filled++;
        if (notBlank(e.getBankAccount())) filled++;
        if (notBlank(e.getPfNumber())) filled++;
        if (e.getDateOfJoining() != null) filled++;
        return (int) Math.round(filled * 100.0 / total);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}

package com.arudra.crm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.util.*;

/**
 * Wipes an employee's work history (attendance, leave, tasks, reports, payroll, rewards, notifications)
 * while keeping the person: employee row, documents, login, salary structure and biometrics.
 * Used to clear test data. Hard deletes, all inside one transaction, so any FK failure rolls back everything.
 *
 * Two id spaces: HR tables key on employees.id (:E); task/portal tables key on the login users.id (:U,
 * employees.user_id).
 */
@Service
public class EmployeeWorkResetService {

    private static final Logger log = LoggerFactory.getLogger(EmployeeWorkResetService.class);

    private record Step(String table, String where) {}

    // Children first so FKs never block a delete.
    private static final List<Step> STEPS = List.of(
            // --- task / portal work (users.id) ---
            new Step("task_progress_media", "progress_update_id IN (SELECT id FROM task_progress_updates WHERE employee_id IN (:U))"),
            new Step("task_progress_updates", "employee_id IN (:U)"),
            new Step("task_checkins", "employee_id IN (:U)"),
            new Step("task_issues", "employee_id IN (:U)"),
            new Step("task_material_usage", "used_by_id IN (:U)"),
            new Step("task_time_logs", "employee_id IN (:U)"),
            new Step("task_assignments", "employee_id IN (:U) OR (resource_type = 'EMPLOYEE' AND resource_id IN (:U))"),
            new Step("task_join_requests", "requester_id IN (:U)"),
            new Step("task_cancel_requests", "requester_id IN (:U)"),
            new Step("daily_report_media", "report_id IN (SELECT id FROM daily_reports WHERE employee_id IN (:U))"),
            new Step("daily_reports", "employee_id IN (:U)"),
            new Step("project_daily_log_employees", "employee_id IN (:U)"),
            new Step("project_team", "employee_id IN (:U)"),
            // self-FK (replaced_history_id): newest rows go first
            new Step("assignment_history", "(employee_id IN (:U) OR (resource_type = 'EMPLOYEE' AND resource_id IN (:U))) ORDER BY id DESC"),
            new Step("notifications", "recipient_id IN (:U)"),
            // --- attendance (employees.id) ---
            new Step("machine_punches", "employee_id IN (:E)"),
            new Step("attendance_correction_requests", "employee_id IN (:E)"),
            new Step("attendance_sessions", "attendance_id IN (SELECT id FROM attendance WHERE employee_id IN (:E))"),
            new Step("attendance", "employee_id IN (:E)"),
            // --- HR ---
            new Step("leave_requests", "employee_id IN (:E)"),
            new Step("performance_reviews", "employee_id IN (:E)"),
            new Step("employee_reviews", "employee_id IN (:E)"),
            new Step("employee_celebrations", "employee_id IN (:E)"),
            new Step("profile_change_requests", "employee_id IN (:E)"),
            // --- payroll ---
            new Step("payroll_requests", "employee_id IN (:E)"),
            new Step("employee_deductions", "employee_id IN (:E)"),
            new Step("payroll_recoveries", "salary_record_id IN (SELECT id FROM salary_records WHERE employee_id IN (:E))"),
            new Step("payslip_line_items", "salary_record_id IN (SELECT id FROM salary_records WHERE employee_id IN (:E))"),
            new Step("salary_records", "employee_id IN (:E)"),
            new Step("employee_bonuses", "employee_id IN (:E)"),
            new Step("employee_advances", "employee_id IN (:E)"),
            new Step("employee_loans", "employee_id IN (:E)")
    );

    private final NamedParameterJdbcTemplate jdbc;

    @Autowired
    public EmployeeWorkResetService(DataSource dataSource) {
        this.jdbc = new NamedParameterJdbcTemplate(dataSource);
    }

    /**
     * @param employeeIds employees to reset; null/empty = every employee
     * @param dryRun      true = only count what would be deleted
     */
    @Transactional
    public Map<String, Object> reset(List<Long> employeeIds, boolean dryRun) {
        List<Long> empIds = resolveEmployeeIds(employeeIds);
        if (empIds.isEmpty()) throw new IllegalArgumentException("No employees found to reset");

        List<Long> userIds = jdbc.queryForList(
                "SELECT user_id FROM employees WHERE id IN (:E) AND user_id IS NOT NULL",
                new MapSqlParameterSource("E", empIds), Long.class);

        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("E", empIds)
                // empty IN () is invalid SQL; -1 matches nothing
                .addValue("U", userIds.isEmpty() ? List.of(-1L) : userIds);

        Map<String, Integer> counts = new LinkedHashMap<>();
        List<String> skipped = new ArrayList<>();
        int total = 0;
        for (Step s : STEPS) {
            if (!tableExists(s.table())) { skipped.add(s.table() + " (table not present)"); continue; }
            try {
                int n;
                if (dryRun) {
                    String where = s.where().replaceAll("(?i)\\s+ORDER BY id DESC$", "");
                    Integer c = jdbc.queryForObject("SELECT COUNT(*) FROM " + s.table() + " WHERE " + where, p, Integer.class);
                    n = c == null ? 0 : c;
                } else {
                    n = jdbc.update("DELETE FROM " + s.table() + " WHERE " + s.where(), p);
                }
                counts.put(s.table(), n);
                total += n;
            } catch (org.springframework.jdbc.BadSqlGrammarException e) {
                // schema differs from the migrations (renamed/missing column) - report, don't guess
                skipped.add(s.table() + " (schema mismatch)");
                log.warn("Employee work reset: skipped {}: {}", s.table(), e.getMessage());
            }
        }
        log.warn("Employee work reset {} for {} employee(s): {} rows", dryRun ? "DRY RUN" : "EXECUTED", empIds.size(), total);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("dryRun", dryRun);
        out.put("employees", empIds.size());
        out.put("totalRows", total);
        out.put("counts", counts);
        out.put("skipped", skipped);
        return out;
    }

    private List<Long> resolveEmployeeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return jdbc.queryForList("SELECT id FROM employees", new MapSqlParameterSource(), Long.class);
        }
        return jdbc.queryForList("SELECT id FROM employees WHERE id IN (:ids)",
                new MapSqlParameterSource("ids", ids), Long.class);
    }

    private boolean tableExists(String table) {
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t",
                new MapSqlParameterSource("t", table), Integer.class);
        return c != null && c > 0;
    }
}

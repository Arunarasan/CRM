package com.arudra.crm.controller;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.Expense;
import com.arudra.crm.entity.SalaryRecord;
import com.arudra.crm.repository.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.HrService;
import com.arudra.crm.service.PayrollService;
import com.arudra.crm.service.TaskChecklistService;
import com.arudra.crm.service.TaskService;
import com.arudra.crm.service.WorkforceAlertService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * BLK-004 regression guard: asserts that endpoints hardened in the authorization sweep return
 * 403 for authenticated-but-under-privileged users, and admit users who hold the required
 * authority. Runs as a web-layer slice (no database) with method security enabled.
 */
@WebMvcTest(controllers = {ExpenseController.class, DashboardController.class,
        HrController.class, TaskController.class, ReportController.class})
@Import(ControllerAuthorizationTest.MethodSecurityTestConfig.class)
class ControllerAuthorizationTest {

    /** Permissive filter chain (URL rules off) so tests exercise method-level @PreAuthorize only. */
    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurityTestConfig {
        @Bean
        SecurityFilterChain testChain(HttpSecurity http) throws Exception {
            return http.csrf(c -> c.disable())
                    .authorizeHttpRequests(a -> a.anyRequest().permitAll())
                    .build();
        }
    }

    @Autowired private MockMvc mvc;

    // Expense
    @MockBean private ExpenseRepository expenseRepository;
    // Dashboard
    @MockBean private CustomerRepository customerRepository;
    @MockBean private LeadRepository leadRepository;
    @MockBean private ProjectRepository projectRepository;
    @MockBean private TaskRepository taskRepository;
    @MockBean private QuotationRepository quotationRepository;
    // Hr
    @MockBean private HrService hrService;
    @MockBean private PayrollService payrollService;
    @MockBean private WorkforceAlertService workforceAlertService;
    @MockBean private com.arudra.crm.service.HrOverviewService hrOverviewService;
    @MockBean private com.arudra.crm.service.PayslipEditService payslipEditService;
    @MockBean private com.arudra.crm.service.ProfileChangeRequestService profileChangeRequestService;
    @MockBean private com.arudra.crm.service.EmployeeReviewService employeeReviewService;
    @MockBean private com.arudra.crm.service.GoogleBusinessReviewService googleBusinessReviewService;
    @MockBean private com.arudra.crm.service.GoogleReviewCountService googleReviewCountService;
    @MockBean private CurrentUserService currentUserService;
    // Task
    @MockBean private TaskService taskService;
    @MockBean private TaskChecklistService taskChecklistService;
    @MockBean(name = "taskAccess") private com.arudra.crm.security.TaskAccessGuard taskAccess;
    // Reports
    @MockBean private com.arudra.crm.service.ReportService reportService;
    @MockBean private com.arudra.crm.service.InventoryReportService inventoryReportService;
    @MockBean private com.arudra.crm.service.PurchaseReportService purchaseReportService;
    // The JWT auth filter is a Filter bean pulled into the slice; satisfy its collaborators so
    // the context loads. With no token on the request it simply passes through, and @WithMockUser
    // supplies the authentication that method security evaluates.
    @MockBean private com.arudra.crm.security.JwtUtil jwtUtil;
    @MockBean private com.arudra.crm.security.CustomUserDetailsService customUserDetailsService;
    @MockBean private com.arudra.crm.idempotency.IdempotencyStore idempotencyStore;

    // ---- Expenses (financial data → FINANCE_READ / FINANCE_WRITE) ----

    @Test
    @WithMockUser(authorities = "ROLE_EMPLOYEE")
    void expensesList_forbiddenForNonFinanceUser() throws Exception {
        mvc.perform(get("/api/expenses")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "FINANCE_READ")
    void expensesList_allowedForFinanceReader() throws Exception {
        when(expenseRepository.findAll()).thenReturn(Collections.emptyList());
        mvc.perform(get("/api/expenses")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(authorities = "FINANCE_READ")
    void expenseCreate_forbiddenForReadOnlyFinanceUser() throws Exception {
        mvc.perform(post("/api/expenses").with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "FINANCE_WRITE")
    void expenseCreate_allowedForFinanceWriter() throws Exception {
        when(expenseRepository.save(any(Expense.class))).thenReturn(new Expense());
        mvc.perform(post("/api/expenses").with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isOk());
    }

    // ---- Dashboard (company-wide KPIs → office/management) ----

    @Test
    @WithMockUser(authorities = "ROLE_EMPLOYEE")
    void dashboardSummary_forbiddenForFieldEmployee() throws Exception {
        mvc.perform(get("/api/dashboard/summary")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "ROLE_MANAGER")
    void dashboardSummary_allowedForManager() throws Exception {
        when(quotationRepository.getMonthlyRevenue()).thenReturn(Collections.emptyList());
        when(leadRepository.countLeadsByStatus()).thenReturn(Collections.emptyList());
        when(taskRepository.findTasksDueToday(any())).thenReturn(Collections.emptyList());
        when(leadRepository.findLeadsForFollowUp(any())).thenReturn(Collections.emptyList());
        when(projectRepository.findByStatus(any())).thenReturn(Collections.emptyList());
        when(customerRepository.findAllByOrderByCreatedAtDesc(any())).thenReturn(new PageImpl<>(Collections.emptyList()));
        mvc.perform(get("/api/dashboard/summary")).andExpect(status().isOk());
    }

    // ---- HR core PII (WORKFORCE_READ / WORKFORCE_WRITE) ----

    @Test
    @WithMockUser(authorities = "ROLE_EMPLOYEE")
    void employeeList_forbiddenForNonHrUser() throws Exception {
        mvc.perform(get("/api/hr/employees")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "WORKFORCE_READ")
    void employeeList_allowedForWorkforceReader() throws Exception {
        Page<Employee> empty = new PageImpl<>(Collections.emptyList());
        when(hrService.getEmployees(anyInt(), anyInt())).thenReturn(empty);
        mvc.perform(get("/api/hr/employees")).andExpect(status().isOk());
    }

    // ---- HR payroll (PAYROLL_READ / PAYROLL_PROCESS) ----

    @Test
    @WithMockUser(authorities = "ROLE_EMPLOYEE")
    void payrollList_forbiddenForFieldEmployee() throws Exception {
        mvc.perform(get("/api/hr/payroll")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "WORKFORCE_WRITE")
    void generateSalary_forbiddenWithoutPayrollProcess() throws Exception {
        mvc.perform(post("/api/hr/payroll").with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "PAYROLL_PROCESS")
    void generateSalary_allowedForPayrollProcessor() throws Exception {
        when(hrService.generateSalaryRecord(any(SalaryRecord.class))).thenReturn(new SalaryRecord());
        mvc.perform(post("/api/hr/payroll").with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isOk());
    }

    // ---- Task deletion (destructive → manager/PM/TASK_APPROVE) ----

    @Test
    @WithMockUser(authorities = "ROLE_EMPLOYEE")
    void deleteTask_forbiddenForFieldEmployee() throws Exception {
        mvc.perform(delete("/api/tasks/1").with(csrf())).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "ROLE_PROJECT_MANAGER")
    void deleteTask_allowedForProjectManager() throws Exception {
        mvc.perform(delete("/api/tasks/1").with(csrf())).andExpect(status().isOk());
    }

    // ---- Task CRUD (staff roles; employees only on tasks assigned to them) ----

    @Test
    @WithMockUser(authorities = "ROLE_CUSTOMER")
    void allTasks_forbiddenForCustomer() throws Exception {
        mvc.perform(get("/api/tasks/all")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "ROLE_CUSTOMER")
    void taskStatus_forbiddenForCustomer() throws Exception {
        mvc.perform(put("/api/tasks/1/status").with(csrf())
                        .contentType("application/json").content("{\"status\":\"DONE\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "TASK_READ")
    void allTasks_allowedForTaskReader() throws Exception {
        when(taskService.getAllTasks()).thenReturn(Collections.emptyList());
        mvc.perform(get("/api/tasks/all")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(authorities = {"ROLE_EMPLOYEE", "EMPLOYEE_TASK_EXECUTE"})
    void comment_forbiddenForUnassignedEmployee() throws Exception {
        when(taskAccess.canAct(1L)).thenReturn(false);
        mvc.perform(post("/api/tasks/1/comments").with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = {"ROLE_EMPLOYEE", "EMPLOYEE_TASK_EXECUTE"})
    void comment_allowedForAssignedEmployee() throws Exception {
        when(taskAccess.canAct(1L)).thenReturn(true);
        mvc.perform(post("/api/tasks/1/comments").with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isOk());
    }

    // ---- Financial reports (revenue / payroll / profit → admin or FINANCE_READ) ----

    @Test
    @WithMockUser(authorities = "ROLE_CUSTOMER")
    void reportDashboard_forbiddenForCustomer() throws Exception {
        mvc.perform(get("/api/reports/dashboard")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "FINANCE_READ")
    void reportDashboard_allowedForFinanceReader() throws Exception {
        when(reportService.getDashboardMetrics(any(), any())).thenReturn(Collections.emptyMap());
        mvc.perform(get("/api/reports/dashboard")).andExpect(status().isOk());
    }
}

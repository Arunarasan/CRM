package com.arudra.crm.config;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Configuration
public class DataSeeder {

    /**
     * Hibernate's ddl-auto=update (this project has no migration tool — see class-level context in
     * the other seeder methods) only ever adds columns/tables, it never drops or relaxes old ones.
     * The BOQ module's 2026-07 restructure (BoqItem split into item + BoqItemMaterial/BoqItemLabour)
     * left legacy NOT NULL columns (rate, quantity, unit, waste_percent, final_quantity, item_type,
     * vendor, room) on boq_items that Hibernate no longer writes, which breaks every insert. Drop
     * them here, guarded by information_schema so it's a no-op once already cleaned up.
     */
    @Bean
    @Order(1)
    public CommandLineRunner cleanupLegacyBoqItemColumns(DataSource dataSource) {
        return args -> {
            // NOTE: quantity/unit are NOT legacy — the new BoqItem schema reuses those column names.
            String[] legacyColumns = {"rate", "waste_percent", "final_quantity", "item_type", "vendor", "room"};
            try (Connection conn = dataSource.getConnection()) {
                for (String column : legacyColumns) {
                    try (ResultSet rs = conn.getMetaData().getColumns(null, null, "boq_items", column)) {
                        if (!rs.next()) continue;
                    }
                    try (Statement stmt = conn.createStatement()) {
                        stmt.executeUpdate("ALTER TABLE boq_items DROP COLUMN " + column);
                    }
                }
            } catch (Exception e) {
                System.out.println("BOQ legacy column cleanup skipped: " + e.getMessage());
            }
        };
    }

    @Bean
    @Order(2)
    @Transactional
    public CommandLineRunner initDatabase(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            CustomerRepository customerRepository,
            LeadRepository leadRepository,
            ProjectRepository projectRepository,
            TaskRepository taskRepository,
            PasswordEncoder passwordEncoder,
            org.springframework.core.env.Environment environment) {

        return args -> {
            // A profile is treated as "production" if any active profile is named prod/production.
            // Roles and permissions are seeded on every profile (they are reference data the app
            // needs to function); default credentials and sample business data are NOT.
            boolean isProd = false;
            for (String profile : environment.getActiveProfiles()) {
                if (profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production")) {
                    isProd = true;
                    break;
                }
            }
            // 1. Seed Roles
            List<String> roleNames = Arrays.asList("ROLE_ADMIN", "ROLE_SALES", "ROLE_PROJECT_MANAGER",
                    "ROLE_EMPLOYEE", "ROLE_MANAGER", "ROLE_DESIGNER", "ROLE_ENGINEER", "ROLE_SUPERVISOR",
                    "ROLE_ESTIMATOR", "ROLE_ACCOUNTS", "ROLE_INVENTORY_MANAGER", "ROLE_STORE_KEEPER",
                    "ROLE_FINANCE_MANAGER", "ROLE_CONTRACTOR",
                    // Website customer portal login role.
                    "ROLE_CUSTOMER");
            for (String roleName : roleNames) {
                if (roleRepository.findByName(roleName).isEmpty()) {
                    Role role = new Role();
                    role.setName(roleName);
                    roleRepository.save(role);
                }
            }

            // 1.5 Seed Permissions and assign them to roles. These permission names are
            // referenced by @PreAuthorize checks in CustomerController/CustomerProfileController
            // but were never actually created here, which meant only ROLE_ADMIN (via its
            // separate hasAuthority('ROLE_ADMIN') bypass) could ever pass those checks.
            List<String> permissionNames = Arrays.asList(
                    "CUSTOMER_READ", "CUSTOMER_WRITE", "CUSTOMER_DELETE",
                    "CUSTOMER_FINANCIAL_READ", "CUSTOMER_EXPORT",
                    "LEAD_READ", "LEAD_WRITE", "LEAD_DELETE",
                    "LEAD_ASSIGN", "LEAD_CONVERT", "LEAD_EXPORT",
                    "MEASUREMENT_READ", "MEASUREMENT_WRITE", "MEASUREMENT_DELETE",
                    "MEASUREMENT_ASSIGN", "MEASUREMENT_APPROVE", "MEASUREMENT_EXPORT",
                    "SITE_VISIT_READ", "SITE_VISIT_WRITE", "SITE_VISIT_DELETE", "SITE_VISIT_ASSIGN",
                    "BOQ_READ", "BOQ_WRITE", "BOQ_DELETE", "BOQ_APPROVE",
                    "QUOTATION_READ", "QUOTATION_WRITE", "QUOTATION_DELETE", "QUOTATION_APPROVE",
                    "PROJECT_READ", "PROJECT_WRITE", "PROJECT_DELETE", "PROJECT_APPROVE",
                    "TASK_READ", "TASK_WRITE", "TASK_ASSIGN", "TASK_APPROVE",
                    "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL",
                    "EMPLOYEE_PORTAL",
                    "CHANGE_REQUEST_READ", "CHANGE_REQUEST_WRITE", "CHANGE_REQUEST_APPROVE",
                    "INVENTORY_READ", "INVENTORY_WRITE",
                    "WAREHOUSE_READ", "WAREHOUSE_WRITE",
                    "PURCHASE_READ", "PURCHASE_WRITE", "PURCHASE_APPROVE",
                    "STOCK_TRANSFER_READ", "STOCK_TRANSFER_WRITE", "STOCK_TRANSFER_APPROVE",
                    "MATERIAL_REQUEST_READ", "MATERIAL_REQUEST_WRITE", "MATERIAL_REQUEST_APPROVE",
                    "DAMAGE_READ", "DAMAGE_WRITE",
                    "FINANCE_READ", "FINANCE_WRITE", "FINANCE_APPROVE", "FINANCE_COLLECT",
                    "CONTRACTOR_READ", "CONTRACTOR_WRITE", "CONTRACTOR_DELETE",
                    "WORK_PACKAGE_READ", "WORK_PACKAGE_WRITE", "WORK_PACKAGE_ASSIGN",
                    "WORK_PACKAGE_APPROVE", "WORK_PACKAGE_EXECUTE",
                    "CONTRACTOR_MATERIAL_ISSUE",
                    "CONTRACTOR_BILL_READ", "CONTRACTOR_BILL_WRITE", "CONTRACTOR_BILL_APPROVE",
                    "CONTRACTOR_PAYMENT", "CONTRACTOR_PORTAL",
                    "WORKFORCE_READ", "WORKFORCE_WRITE",
                    "ASSIGNMENT_READ", "ASSIGNMENT_WRITE",
                    "PAYROLL_READ", "PAYROLL_WRITE", "PAYROLL_PROCESS",
                    "WEBSITE_READ", "WEBSITE_WRITE");
            for (String permissionName : permissionNames) {
                if (permissionRepository.findByName(permissionName).isEmpty()) {
                    Permission permission = new Permission();
                    permission.setName(permissionName);
                    permissionRepository.save(permission);
                }
            }

            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "CUSTOMER_READ", "CUSTOMER_WRITE", "CUSTOMER_DELETE", "CUSTOMER_FINANCIAL_READ", "CUSTOMER_EXPORT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "CUSTOMER_READ", "CUSTOMER_WRITE", "CUSTOMER_FINANCIAL_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "CUSTOMER_READ", "CUSTOMER_WRITE", "CUSTOMER_FINANCIAL_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_EMPLOYEE",
                    "CUSTOMER_READ");

            // Lead Management permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "LEAD_READ", "LEAD_WRITE", "LEAD_DELETE", "LEAD_ASSIGN", "LEAD_CONVERT", "LEAD_EXPORT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "CUSTOMER_READ", "CUSTOMER_WRITE", "CUSTOMER_FINANCIAL_READ",
                    "LEAD_READ", "LEAD_WRITE", "LEAD_DELETE", "LEAD_ASSIGN", "LEAD_CONVERT", "LEAD_EXPORT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "LEAD_READ", "LEAD_WRITE", "LEAD_ASSIGN", "LEAD_CONVERT", "LEAD_EXPORT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "LEAD_READ", "LEAD_WRITE", "LEAD_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_DESIGNER",
                    "LEAD_READ", "LEAD_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ENGINEER",
                    "LEAD_READ", "LEAD_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_EMPLOYEE",
                    "LEAD_READ");

            // Measurement Management permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "MEASUREMENT_READ", "MEASUREMENT_WRITE", "MEASUREMENT_DELETE",
                    "MEASUREMENT_ASSIGN", "MEASUREMENT_APPROVE", "MEASUREMENT_EXPORT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "MEASUREMENT_READ", "MEASUREMENT_WRITE", "MEASUREMENT_DELETE",
                    "MEASUREMENT_ASSIGN", "MEASUREMENT_APPROVE", "MEASUREMENT_EXPORT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "MEASUREMENT_READ", "MEASUREMENT_WRITE", "MEASUREMENT_ASSIGN", "MEASUREMENT_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SUPERVISOR",
                    "MEASUREMENT_READ", "MEASUREMENT_WRITE", "MEASUREMENT_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_DESIGNER",
                    "MEASUREMENT_READ", "MEASUREMENT_WRITE", "MEASUREMENT_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ENGINEER",
                    "MEASUREMENT_READ", "MEASUREMENT_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "MEASUREMENT_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_EMPLOYEE",
                    "MEASUREMENT_READ");

            // Site Visit Management permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "SITE_VISIT_READ", "SITE_VISIT_WRITE", "SITE_VISIT_DELETE", "SITE_VISIT_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "SITE_VISIT_READ", "SITE_VISIT_WRITE", "SITE_VISIT_DELETE", "SITE_VISIT_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "SITE_VISIT_READ", "SITE_VISIT_WRITE", "SITE_VISIT_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "SITE_VISIT_READ", "SITE_VISIT_WRITE", "SITE_VISIT_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_DESIGNER",
                    "SITE_VISIT_READ", "SITE_VISIT_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ENGINEER",
                    "SITE_VISIT_READ", "SITE_VISIT_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SUPERVISOR",
                    "SITE_VISIT_READ", "SITE_VISIT_WRITE", "SITE_VISIT_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_EMPLOYEE",
                    "SITE_VISIT_READ");

            // BOQ Management permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "BOQ_READ", "BOQ_WRITE", "BOQ_DELETE", "BOQ_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "BOQ_READ", "BOQ_WRITE", "BOQ_DELETE", "BOQ_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ESTIMATOR",
                    "BOQ_READ", "BOQ_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ENGINEER",
                    "BOQ_READ", "BOQ_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "BOQ_READ");

            // Quotation Management permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "QUOTATION_READ", "QUOTATION_WRITE", "QUOTATION_DELETE", "QUOTATION_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "QUOTATION_READ", "QUOTATION_WRITE", "QUOTATION_DELETE", "QUOTATION_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ESTIMATOR",
                    "QUOTATION_READ", "QUOTATION_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "QUOTATION_READ", "QUOTATION_WRITE", "QUOTATION_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "QUOTATION_READ");

            // Project Management permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "PROJECT_READ", "PROJECT_WRITE", "PROJECT_DELETE", "PROJECT_APPROVE",
                    "TASK_READ", "TASK_WRITE", "TASK_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "PROJECT_READ", "PROJECT_WRITE", "PROJECT_DELETE", "PROJECT_APPROVE",
                    "TASK_READ", "TASK_WRITE", "TASK_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "PROJECT_READ", "PROJECT_WRITE", "PROJECT_APPROVE",
                    "TASK_READ", "TASK_WRITE", "TASK_ASSIGN");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ENGINEER",
                    "PROJECT_READ", "PROJECT_WRITE", "TASK_READ", "TASK_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SUPERVISOR",
                    "PROJECT_READ", "PROJECT_WRITE", "TASK_READ", "TASK_WRITE", "TASK_ASSIGN");
            // Smart Employee Auto Assignment — recommend / assign / settings / history / dashboard.
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "ASSIGNMENT_READ", "ASSIGNMENT_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "ASSIGNMENT_READ", "ASSIGNMENT_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "ASSIGNMENT_READ", "ASSIGNMENT_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SUPERVISOR",
                    "ASSIGNMENT_READ", "ASSIGNMENT_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ACCOUNTS",
                    "PROJECT_READ", "PROJECT_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "PROJECT_READ", "TASK_READ");

            // Employee Task & Work Execution (mobile field-execution module) permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "TASK_APPROVE", "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "TASK_APPROVE");
            // Sales/Pre-sales pick the lead-workflow pool tasks (Review Lead, Contact, Quotation…),
            // so they need the field-execution module too — otherwise they're notified about a
            // pickable task but get 403 on the pool. PM likewise picks BOQ/Project-scope tasks.
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "TASK_APPROVE", "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SUPERVISOR",
                    "TASK_APPROVE", "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ENGINEER",
                    "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_EMPLOYEE",
                    "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL",
                    "EMPLOYEE_PORTAL");
            // Single-role phase: the "general employee" drives a lead end-to-end for now (specialist
            // roles come later). Grant the module WRITE/APPROVE permissions the module-driven lead tasks
            // (Measure Site → Measurement, Site Visit, Prepare BOQ → BOQ) actually need, plus LEAD_WRITE
            // so they can schedule visits from the lead page. Narrow these per role when roles are split.
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_EMPLOYEE",
                    "LEAD_WRITE",
                    "MEASUREMENT_WRITE", "MEASUREMENT_ASSIGN", "MEASUREMENT_APPROVE",
                    "SITE_VISIT_WRITE", "SITE_VISIT_ASSIGN",
                    "BOQ_READ", "BOQ_WRITE", "BOQ_APPROVE",
                    "QUOTATION_READ", "QUOTATION_WRITE", "QUOTATION_APPROVE");

            // Dynamic BOQ Management + Project Change Request permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "CHANGE_REQUEST_READ", "CHANGE_REQUEST_WRITE", "CHANGE_REQUEST_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "CHANGE_REQUEST_READ", "CHANGE_REQUEST_WRITE", "CHANGE_REQUEST_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "CHANGE_REQUEST_READ", "CHANGE_REQUEST_WRITE", "CHANGE_REQUEST_APPROVE",
                    "BOQ_READ", "BOQ_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ESTIMATOR",
                    "CHANGE_REQUEST_READ", "CHANGE_REQUEST_WRITE");

            // Inventory Management permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "INVENTORY_READ", "INVENTORY_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "INVENTORY_READ", "INVENTORY_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ESTIMATOR",
                    "INVENTORY_READ", "INVENTORY_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "INVENTORY_READ", "INVENTORY_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "INVENTORY_READ");

            // Enterprise Inventory: warehouses, purchase requests/orders, stock transfers, material requests, damage
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "WAREHOUSE_READ", "WAREHOUSE_WRITE",
                    "PURCHASE_READ", "PURCHASE_WRITE", "PURCHASE_APPROVE",
                    "STOCK_TRANSFER_READ", "STOCK_TRANSFER_WRITE", "STOCK_TRANSFER_APPROVE",
                    "MATERIAL_REQUEST_READ", "MATERIAL_REQUEST_WRITE", "MATERIAL_REQUEST_APPROVE",
                    "DAMAGE_READ", "DAMAGE_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_INVENTORY_MANAGER",
                    "INVENTORY_READ", "INVENTORY_WRITE",
                    "WAREHOUSE_READ", "WAREHOUSE_WRITE",
                    "PURCHASE_READ", "PURCHASE_WRITE", "PURCHASE_APPROVE",
                    "STOCK_TRANSFER_READ", "STOCK_TRANSFER_WRITE", "STOCK_TRANSFER_APPROVE",
                    "MATERIAL_REQUEST_READ", "MATERIAL_REQUEST_WRITE", "MATERIAL_REQUEST_APPROVE",
                    "DAMAGE_READ", "DAMAGE_WRITE");
            // Purchase Management: managers are the primary PR/PO approvers
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "WAREHOUSE_READ",
                    "PURCHASE_READ", "PURCHASE_WRITE", "PURCHASE_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ACCOUNTS",
                    "PURCHASE_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_STORE_KEEPER",
                    "INVENTORY_READ", "INVENTORY_WRITE",
                    "WAREHOUSE_READ",
                    "PURCHASE_READ", "PURCHASE_WRITE",
                    "STOCK_TRANSFER_READ", "STOCK_TRANSFER_WRITE",
                    "MATERIAL_REQUEST_READ", "MATERIAL_REQUEST_APPROVE",
                    "DAMAGE_READ", "DAMAGE_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "WAREHOUSE_READ", "PURCHASE_READ", "PURCHASE_WRITE",
                    "STOCK_TRANSFER_READ", "STOCK_TRANSFER_WRITE",
                    "MATERIAL_REQUEST_READ", "MATERIAL_REQUEST_WRITE", "MATERIAL_REQUEST_APPROVE",
                    "DAMAGE_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_EMPLOYEE",
                    "WAREHOUSE_READ", "MATERIAL_REQUEST_READ", "MATERIAL_REQUEST_WRITE", "DAMAGE_READ", "DAMAGE_WRITE");

            // Billing & Finance permissions
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "FINANCE_READ", "FINANCE_WRITE", "FINANCE_APPROVE", "FINANCE_COLLECT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_FINANCE_MANAGER",
                    "FINANCE_READ", "FINANCE_WRITE", "FINANCE_APPROVE", "FINANCE_COLLECT",
                    "CUSTOMER_READ", "CUSTOMER_FINANCIAL_READ", "PROJECT_READ", "QUOTATION_READ", "PURCHASE_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ACCOUNTS",
                    "FINANCE_READ", "FINANCE_WRITE", "FINANCE_COLLECT",
                    "CUSTOMER_READ", "CUSTOMER_FINANCIAL_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "FINANCE_READ", "FINANCE_WRITE", "FINANCE_APPROVE", "FINANCE_COLLECT");
            // Project managers see project finances; sales sees invoices/outstanding for their customers
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "FINANCE_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SALES",
                    "FINANCE_READ", "FINANCE_COLLECT");

            // Contractor Management permissions. Work packages are project execution, so the
            // project-side roles (PM, site engineer, supervisor) own assignment and verification;
            // store keepers issue material; finance approves and pays bills.
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "CONTRACTOR_READ", "CONTRACTOR_WRITE", "CONTRACTOR_DELETE",
                    "WORK_PACKAGE_READ", "WORK_PACKAGE_WRITE", "WORK_PACKAGE_ASSIGN",
                    "WORK_PACKAGE_APPROVE", "WORK_PACKAGE_EXECUTE", "CONTRACTOR_MATERIAL_ISSUE",
                    "CONTRACTOR_BILL_READ", "CONTRACTOR_BILL_WRITE", "CONTRACTOR_BILL_APPROVE",
                    "CONTRACTOR_PAYMENT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "CONTRACTOR_READ", "CONTRACTOR_WRITE", "CONTRACTOR_DELETE",
                    "WORK_PACKAGE_READ", "WORK_PACKAGE_WRITE", "WORK_PACKAGE_ASSIGN",
                    "WORK_PACKAGE_APPROVE", "WORK_PACKAGE_EXECUTE", "CONTRACTOR_MATERIAL_ISSUE",
                    "CONTRACTOR_BILL_READ", "CONTRACTOR_BILL_WRITE", "CONTRACTOR_BILL_APPROVE",
                    "CONTRACTOR_PAYMENT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "CONTRACTOR_READ", "CONTRACTOR_WRITE",
                    "WORK_PACKAGE_READ", "WORK_PACKAGE_WRITE", "WORK_PACKAGE_ASSIGN",
                    "WORK_PACKAGE_APPROVE", "WORK_PACKAGE_EXECUTE",
                    "CONTRACTOR_BILL_READ", "CONTRACTOR_BILL_WRITE", "CONTRACTOR_BILL_APPROVE");
            // Site engineers run execution and certify the first rung of the bill ladder.
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ENGINEER",
                    "CONTRACTOR_READ",
                    "WORK_PACKAGE_READ", "WORK_PACKAGE_WRITE", "WORK_PACKAGE_EXECUTE", "WORK_PACKAGE_APPROVE",
                    "CONTRACTOR_BILL_READ", "CONTRACTOR_BILL_WRITE", "CONTRACTOR_BILL_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SUPERVISOR",
                    "CONTRACTOR_READ",
                    "WORK_PACKAGE_READ", "WORK_PACKAGE_WRITE", "WORK_PACKAGE_EXECUTE", "WORK_PACKAGE_APPROVE",
                    "CONTRACTOR_BILL_READ");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_STORE_KEEPER",
                    "CONTRACTOR_READ", "WORK_PACKAGE_READ", "CONTRACTOR_MATERIAL_ISSUE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_INVENTORY_MANAGER",
                    "CONTRACTOR_READ", "WORK_PACKAGE_READ", "CONTRACTOR_MATERIAL_ISSUE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_FINANCE_MANAGER",
                    "CONTRACTOR_READ", "WORK_PACKAGE_READ",
                    "CONTRACTOR_BILL_READ", "CONTRACTOR_BILL_APPROVE", "CONTRACTOR_PAYMENT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ACCOUNTS",
                    "CONTRACTOR_READ", "WORK_PACKAGE_READ",
                    "CONTRACTOR_BILL_READ", "CONTRACTOR_BILL_APPROVE", "CONTRACTOR_PAYMENT");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ESTIMATOR",
                    "CONTRACTOR_READ", "WORK_PACKAGE_READ");
            // The portal role sees only its own records — ContractorPortalService re-derives the
            // contractor from the login, so no cross-contractor read is possible.
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_CONTRACTOR",
                    "CONTRACTOR_PORTAL", "MATERIAL_REQUEST_WRITE");

            // Unified Workforce Management: manage the shared directory + creation of employees and
            // contractors. Kept alongside the module-specific permissions above.
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "WORKFORCE_READ", "WORKFORCE_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "WORKFORCE_READ", "WORKFORCE_WRITE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "WORKFORCE_READ");

            // Payroll: HR/Finance/Admin process; PM reads (view contractor payment status).
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "PAYROLL_READ", "PAYROLL_WRITE", "PAYROLL_PROCESS");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_MANAGER",
                    "PAYROLL_READ", "PAYROLL_WRITE", "PAYROLL_PROCESS");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_FINANCE_MANAGER",
                    "PAYROLL_READ", "PAYROLL_WRITE", "PAYROLL_PROCESS");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ACCOUNTS",
                    "PAYROLL_READ", "PAYROLL_WRITE", "PAYROLL_PROCESS");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "PAYROLL_READ");

            // Website / CMS management — admin-only for now.
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ADMIN",
                    "WEBSITE_READ", "WEBSITE_WRITE");

            // 2. Seed the bootstrap admin.
            //
            // BLK-001: never seed a hardcoded/well-known credential in production. Behaviour:
            //   * Non-prod (dev/test): seed admin@arudra.com / Admin@123 for local convenience.
            //   * Prod: seed an admin ONLY when BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD
            //     are both supplied via env, and flag it must_change_password so the operator is
            //     forced to change it on first login. With no env vars set, no admin is created
            //     (provision one out-of-band) — there is never a default password in prod.
            Role adminRole = roleRepository.findByName("ROLE_ADMIN").orElseThrow();
            if (isProd) {
                String bootstrapEmail = environment.getProperty("BOOTSTRAP_ADMIN_EMAIL");
                String bootstrapPassword = environment.getProperty("BOOTSTRAP_ADMIN_PASSWORD");
                if (bootstrapEmail != null && !bootstrapEmail.isBlank()
                        && bootstrapPassword != null && !bootstrapPassword.isBlank()) {
                    bootstrapEmail = bootstrapEmail.trim();
                    if (userRepository.findByEmail(bootstrapEmail).isEmpty()) {
                        User admin = new User();
                        admin.setName("Administrator");
                        admin.setEmail(bootstrapEmail);
                        admin.setPassword(passwordEncoder.encode(bootstrapPassword));
                        admin.setEmailVerified(true);
                        admin.setMustChangePassword(true);
                        Set<Role> roles = new HashSet<>();
                        roles.add(adminRole);
                        admin.setRoles(roles);
                        userRepository.save(admin);
                        System.out.println("Seeded bootstrap admin '" + bootstrapEmail
                                + "' (must change password on first login).");
                    }
                } else {
                    System.out.println("No bootstrap admin seeded: set BOOTSTRAP_ADMIN_EMAIL and "
                            + "BOOTSTRAP_ADMIN_PASSWORD to provision one, or create an admin out-of-band.");
                }
            } else if (userRepository.findByEmail("admin@arudra.com").isEmpty()) {
                User admin = new User();
                admin.setName("Default Admin");
                admin.setEmail("admin@arudra.com");
                admin.setPassword(passwordEncoder.encode("Admin@123"));
                admin.setEmailVerified(true);

                Set<Role> roles = new HashSet<>();
                roles.add(adminRole);
                admin.setRoles(roles);

                userRepository.save(admin);
            }

            // 3. Seed Sample Data if no customers exist (non-prod only — never seed demo
            //    business records into a production database).
            if (!isProd && customerRepository.count() == 0) {
                // Customer
                Customer customer = new Customer();
                customer.setName("Acme Corp");
                customer.setEmail("contact@acmecorp.com");
                customer.setPhone("+1234567890");
                customer.setCity("Mumbai");
                customer.setState("Maharashtra");
                customerRepository.save(customer);

                // Lead
                Lead lead = new Lead();
                lead.setCompanyName(customer.getName());
                lead.setName("Acme New Project Inquiry");
                lead.setEmail("contact@acmecorp.com");
                lead.setMobileNumber(customer.getPhone());
                lead.setStatus("NEW");
                lead.setEstimatedBudget(new BigDecimal("50000.00"));
                leadRepository.save(lead);

                // Project
                Project project = new Project();
                project.setCustomer(customer);
                project.setProjectName("Acme Infrastructure Setup");
                project.setStatus("PLANNING");
                project.setStartDate(LocalDate.now());
                project.setBudget(new BigDecimal("100000.00"));
                projectRepository.save(project);

                // Task
                Task task = new Task();
                task.setProject(project);
                task.setTaskName("Site Inspection");
                task.setPriority("HIGH");
                task.setStatus("PENDING");
                task.setStartDate(LocalDate.now());
                task.setDueDate(LocalDate.now().plusDays(3));
                taskRepository.save(task);
            }
        };
    }

    /**
     * Idempotent: only adds permissions the role doesn't already have, so re-running the
     * seeder (or seeding additional permissions later) never clobbers manually-adjusted roles.
     */
    private void assignPermissionsToRole(RoleRepository roleRepository, PermissionRepository permissionRepository,
            String roleName, String... permissionNames) {
        Role role = roleRepository.findByName(roleName).orElse(null);
        if (role == null) {
            return;
        }
        for (String permissionName : permissionNames) {
            Permission permission = permissionRepository.findByName(permissionName).orElse(null);
            if (permission != null) {
                roleRepository.assignPermission(role.getId(), permission.getId());
            }
        }
    }

    /**
     * Seeds the public website catalog (categories, products, services, portfolio, materials,
     * hero slides, testimonials) idempotently — each block runs only when its table is empty, so
     * it populates a fresh database and is a no-op thereafter. Content, not sample business data,
     * so it seeds on every profile (the public site must never be empty).
     */
    @Bean
    @Order(3)
    @Transactional
    public CommandLineRunner seedWebsiteCatalog(
            ShopCategoryRepository categoryRepo, ShopProductRepository productRepo,
            com.arudra.crm.repository.ServiceRepository serviceRepo, PortfolioProjectRepository portfolioRepo,
            MaterialRepository materialRepo, HeroSlideRepository heroRepo, TestimonialRepository testimonialRepo) {
        return args -> {
            // Categories
            if (categoryRepo.count() == 0) {
                String[][] cats = {
                        {"Furniture", "furniture", "Armchair"}, {"Lighting", "lighting", "Lamp"},
                        {"Décor", "decor", "Flower2"}, {"Curtains", "curtains", "Blinds"},
                        {"Wallpaper", "wallpaper", "Wallpaper"}, {"Kitchen Accessories", "kitchen-accessories", "CookingPot"},
                        {"Wardrobes", "wardrobes", "DoorClosed"}, {"Bathroom", "bathroom", "Bath"},
                        {"Dining", "dining", "Utensils"}, {"Office", "office", "Briefcase"},
                };
                int i = 1;
                for (String[] c : cats) {
                    ShopCategory pc = new ShopCategory();
                    pc.setName(c[0]); pc.setSlug(c[1]); pc.setIcon(c[2]); pc.setDisplayOrder(i++); pc.setActive(true);
                    categoryRepo.save(pc);
                }
            }
            java.util.Map<String, ShopCategory> catBySlug = new java.util.HashMap<>();
            categoryRepo.findAll().forEach(c -> catBySlug.put(c.getSlug(), c));

            // Products
            if (productRepo.count() == 0) {
                seedProduct(productRepo, catBySlug, "Crystal Gold Chandelier", "crystal-gold-chandelier", "JBD-LT-001", "lighting",
                        "Hand-finished crystal chandelier with a warm gold frame.", img("1513506003901-1e6a229e2d15", 800), "24999", null, 5.0, 42, true, 12);
                seedProduct(productRepo, catBySlug, "Luxury Velvet Chair", "luxury-velvet-chair", "JBD-FN-014", "furniture",
                        "Deep-seated accent chair upholstered in forest velvet.", img("1595515106969-1ce29566ff1c", 800), "18999", null, 5.0, 31, true, 8);
                seedProduct(productRepo, catBySlug, "Marble Coffee Table", "marble-coffee-table", "JBD-FN-022", "furniture",
                        "Italian marble top on a sculpted gold-tone base.", img("1533090161767-e6ffed986c88", 800), "22999", null, 4.0, 27, true, 5);
                seedProduct(productRepo, catBySlug, "Designer Table Lamp", "designer-table-lamp", "JBD-LT-009", "lighting",
                        "Sculptural ceramic base with a linen drum shade.", img("1550581190-9c1c48d21d6c", 800), "6999", null, 5.0, 58, true, 20);
                seedProduct(productRepo, catBySlug, "Ivory Bouclé Sofa", "ivory-boucle-sofa", "JBD-FN-031", "furniture",
                        "Three-seater bouclé sofa with a low architectural profile.", img("1493663284031-b7e3aefcae8e", 800), "74999", "68999", 5.0, 19, true, 3);
                seedProduct(productRepo, catBySlug, "Walnut Display Sideboard", "walnut-display-sideboard", "JBD-FN-040", "furniture",
                        "Fluted walnut sideboard with brushed-brass detailing.", img("1524758631624-e2822e304c36", 800), "48999", null, 4.0, 23, false, 4);
                seedProduct(productRepo, catBySlug, "Sculpted Ceramic Vase", "sculpted-ceramic-vase", "JBD-DC-019", "decor",
                        "Matte ceramic vase with an organic hand-thrown form.", img("1550581190-9c1c48d21d6c", 800), "3499", null, 4.0, 45, false, 30);
                seedProduct(productRepo, catBySlug, "Executive Leather Desk Chair", "executive-leather-desk-chair", "JBD-OF-002", "office",
                        "Full-grain leather task chair with a brushed-steel frame.", img("1595515106969-1ce29566ff1c", 800), "32999", "28999", 5.0, 16, false, 6);

                // Colour/finish options for fresh installs (existing DBs get these via Flyway V57).
                java.util.Map<String, String> colorsBySlug = java.util.Map.of(
                        "crystal-gold-chandelier", """
                                [{"name":"Antique Gold","hex":"#c8a24a","image":"https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80"},{"name":"Brushed Brass","hex":"#b08d57","image":"https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?auto=format&fit=crop&w=800&q=80"},{"name":"Polished Chrome","hex":"#c9ccd1","image":"https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80"}]""",
                        "luxury-velvet-chair", """
                                [{"name":"Forest Green","hex":"#1f3d2b","image":"https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80"},{"name":"Royal Blue","hex":"#26456e","image":"https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80"},{"name":"Blush Pink","hex":"#d8a7a1","image":"https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=800&q=80"},{"name":"Charcoal","hex":"#2e2e2e","image":"https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80"}]""",
                        "marble-coffee-table", """
                                [{"name":"Carrara White","hex":"#eae7e0"},{"name":"Nero Marquina","hex":"#23211f"},{"name":"Emerald","hex":"#1f5c48"}]""",
                        "designer-table-lamp", """
                                [{"name":"Ivory","hex":"#efe9db"},{"name":"Charcoal","hex":"#2e2e2e"},{"name":"Terracotta","hex":"#c26b4a"}]""",
                        "ivory-boucle-sofa", """
                                [{"name":"Ivory Boucle","hex":"#efe9db"},{"name":"Sand","hex":"#d8c7a8"},{"name":"Slate Grey","hex":"#6b7078"}]""",
                        "walnut-display-sideboard", """
                                [{"name":"Walnut","hex":"#5a3a22"},{"name":"Natural Oak","hex":"#b08d57"},{"name":"Matte Black","hex":"#1c1c1c"}]""",
                        "sculpted-ceramic-vase", """
                                [{"name":"Matte White","hex":"#efe9db"},{"name":"Sage","hex":"#9aa88f"},{"name":"Ochre","hex":"#c9a24b"}]""",
                        "executive-leather-desk-chair", """
                                [{"name":"Tan Leather","hex":"#a4703c"},{"name":"Black Leather","hex":"#1c1c1c"},{"name":"Oxblood","hex":"#5e2129"}]""");
                productRepo.findAll().forEach(p -> {
                    String cj = colorsBySlug.get(p.getSlug());
                    if (cj != null && (p.getColorsJson() == null || p.getColorsJson().isBlank())) {
                        p.setColorsJson(cj);
                        productRepo.save(p);
                    }
                });
            }

            // Services
            if (serviceRepo.count() == 0) {
                seedService(serviceRepo, "Interior Design", "interior-design", "Full-scope residential and commercial design.", "PencilRuler");
                seedService(serviceRepo, "Modular Kitchen", "modular-kitchen", "Ergonomic, made-to-measure kitchens.", "CookingPot");
                seedService(serviceRepo, "Wardrobe Design", "wardrobe-design", "Bespoke wardrobes engineered around how you live.", "DoorClosed");
                seedService(serviceRepo, "Lighting Design", "lighting-design", "Layered lighting that shapes mood and depth.", "Lamp");
                seedService(serviceRepo, "False Ceiling", "false-ceiling", "Sculpted ceilings and cove detailing.", "Layers");
                seedService(serviceRepo, "Turnkey Interiors", "turnkey-interiors", "End-to-end design, sourcing, and execution.", "KeyRound");
            }

            // Portfolio
            if (portfolioRepo.count() == 0) {
                seedPortfolio(portfolioRepo, "The Emerald Residence", "emerald-residence", "Residential", "Bengaluru", 2025, img("1600210492486-724fe5c67fb0", 1000));
                seedPortfolio(portfolioRepo, "Hillcrest Villa", "hillcrest-villa", "Villa", "Coonoor", 2024, img("1616594039964-ae9021a400a0", 1000));
                seedPortfolio(portfolioRepo, "Skyline Apartment", "skyline-apartment", "Apartment", "Mumbai", 2025, img("1616137466211-f939a420be84", 1000));
                seedPortfolio(portfolioRepo, "Meridian Workspace", "meridian-workspace", "Office", "Hyderabad", 2024, img("1519710164239-da123dc03ef4", 1000));
            }

            // Materials
            if (materialRepo.count() == 0) {
                seedMaterial(materialRepo, "Natural Teak Wood", "natural-teak-wood", "Wood", "Golden Brown", "Hand-oiled matte");
                seedMaterial(materialRepo, "Carrara Marble", "carrara-marble", "Marble", "White & Grey", "Polished");
                seedMaterial(materialRepo, "Forest Green Granite", "forest-green-granite", "Granite", "Forest Green", "Leathered");
                seedMaterial(materialRepo, "Smoked Oak Veneer", "smoked-oak-veneer", "Veneer", "Ash Grey", "Natural PU");
                seedMaterial(materialRepo, "Fluted Glass", "fluted-glass", "Glass", "Clear", "Reeded");
                seedMaterial(materialRepo, "Belgian Linen Fabric", "belgian-linen-fabric", "Fabric", "Warm Ivory", "Woven");
            }

            // Hero slides
            if (heroRepo.count() == 0) {
                seedHero(heroRepo, img("1618221195710-dd6b41faaea6", 1920), "Crafting Spaces. Defining Luxury.",
                        "Designing Spaces That Inspire", "Luxury",
                        "Bespoke interiors that blend elegance, functionality, and craftsmanship.",
                        "Book Consultation", "/consultation", "Explore Portfolio", "/portfolio", 1);
                seedHero(heroRepo, img("1616486338812-3dadae4b4ace", 1920), "Turnkey Interior Solutions",
                        "From Blueprint to", "Masterpiece",
                        "End-to-end design, material sourcing, and flawless execution.",
                        "Start Your Project", "/consultation", "View Our Work", "/portfolio", 2);
            }

            // Testimonials
            if (testimonialRepo.count() == 0) {
                seedTestimonial(testimonialRepo, "Ananya Rao", "Homeowner", "Bengaluru",
                        "JB Decor turned our apartment into something we never want to leave.");
                seedTestimonial(testimonialRepo, "Rahul Menon", "Managing Director", "Hyderabad",
                        "They delivered our office fit-out on time and on budget. Truly professional.");
                seedTestimonial(testimonialRepo, "Priya & Karthik", "Villa Owners", "Coonoor",
                        "From the first sketch to handover, it was a calm, luxurious experience.");
            }
        };
    }

    /**
     * Seeds CMS-managed site settings + page content from the website's current hardcoded defaults,
     * so the CRM has something to view/edit and the public site reads identical values from the DB.
     * Idempotent (only seeds when empty), so it never clobbers admin edits.
     */
    @Bean
    @Order(4)
    @Transactional
    public CommandLineRunner seedWebsiteSettingsContent(SiteSettingRepository settingRepo,
                                                        ContentBlockRepository contentRepo) {
        return args -> {
            if (settingRepo.countByIsDeletedFalse() == 0) {
                int i = 1;
                // group, key, label, value, inputType
                i = seedSetting(settingRepo, "Brand", "brand.name", "Brand name", "JB Decor", "text", i);
                i = seedSetting(settingRepo, "Brand", "brand.tagline", "Tagline", "Premium Interior Design & Décor", "text", i);
                i = seedSetting(settingRepo, "Brand", "brand.positioning", "Positioning line", "Crafting Spaces. Defining Luxury.", "text", i);
                i = seedSetting(settingRepo, "Contact", "contact.phone", "Phone", "+91 90000 00000", "tel", i);
                i = seedSetting(settingRepo, "Contact", "contact.email", "Email", "hello@jbdecor.com", "email", i);
                i = seedSetting(settingRepo, "Contact", "contact.whatsapp", "WhatsApp number", "919000000000", "tel", i);
                i = seedSetting(settingRepo, "Contact", "contact.address", "Address", "JB Decor Studio, Bengaluru, India", "textarea", i);
                i = seedSetting(settingRepo, "Contact", "contact.businessHours", "Business hours", "Mon – Sat · 10:00 AM – 7:00 PM", "text", i);
                i = seedSetting(settingRepo, "Social", "social.instagram", "Instagram URL", "https://instagram.com", "url", i);
                i = seedSetting(settingRepo, "Social", "social.facebook", "Facebook URL", "https://facebook.com", "url", i);
                i = seedSetting(settingRepo, "Social", "social.pinterest", "Pinterest URL", "https://pinterest.com", "url", i);
                i = seedSetting(settingRepo, "Social", "social.linkedin", "LinkedIn URL", "https://linkedin.com", "url", i);
                seedSetting(settingRepo, "Portal", "portal.enabled", "Customer portal enabled", "true", "text", i);
            }

            if (contentRepo.countByIsDeletedFalse() == 0) {
                int i = 1;
                // page, section, title, subtitle, body
                i = seedContent(contentRepo, "home", "why_choose_us", "Why Choose JB Decor",
                        "Design-led, delivered end to end",
                        "From concept to handover, we craft interiors that balance timeless elegance with everyday livability.", i);
                i = seedContent(contentRepo, "home", "consultation_cta", "Let's design your space",
                        "Book a free consultation",
                        "Tell us about your project and our design team will be in touch within one business day.", i);
                i = seedContent(contentRepo, "about", "intro", "About JB Decor",
                        "Crafting Spaces. Defining Luxury.",
                        "JB Decor is a premium interior design studio delivering residential and commercial spaces across India, blending craftsmanship with a considered, client-first process.", i);
                seedContent(contentRepo, "contact", "intro", "Get in touch",
                        "We'd love to hear about your project",
                        "Reach us by phone, email or WhatsApp — or send an enquiry and we'll respond within one business day.", i);
            }
        };
    }

    private int seedSetting(SiteSettingRepository repo, String group, String key, String label,
                            String value, String inputType, int order) {
        com.arudra.crm.entity.SiteSetting s = new com.arudra.crm.entity.SiteSetting();
        s.setGroupName(group);
        s.setSettingKey(key);
        s.setLabel(label);
        s.setSettingValue(value);
        s.setInputType(inputType);
        s.setDisplayOrder(order);
        repo.save(s);
        return order + 1;
    }

    private int seedContent(ContentBlockRepository repo, String page, String section, String title,
                            String subtitle, String body, int order) {
        com.arudra.crm.entity.ContentBlock c = new com.arudra.crm.entity.ContentBlock();
        c.setPage(page);
        c.setSectionKey(section);
        c.setTitle(title);
        c.setSubtitle(subtitle);
        c.setBody(body);
        c.setDisplayOrder(order);
        c.setActive(true);
        repo.save(c);
        return order + 1;
    }

    private static String img(String id, int w) {
        return "https://images.unsplash.com/photo-" + id + "?auto=format&fit=crop&w=" + w + "&q=80";
    }

    private void seedProduct(ShopProductRepository repo, java.util.Map<String, ShopCategory> cats, String name,
                             String slug, String sku, String categorySlug, String shortDesc, String image,
                             String price, String discount, double rating, int reviews, boolean featured, int stock) {
        ShopProduct p = new ShopProduct();
        p.setName(name); p.setSlug(slug); p.setSku(sku); p.setCategory(cats.get(categorySlug));
        p.setShortDescription(shortDesc); p.setImageUrl(image);
        p.setPrice(new BigDecimal(price));
        if (discount != null) p.setDiscountPrice(new BigDecimal(discount));
        p.setRating(rating); p.setReviewCount(reviews); p.setFeatured(featured); p.setActive(true); p.setStock(stock);
        repo.save(p);
    }

    private void seedService(com.arudra.crm.repository.ServiceRepository repo, String title, String slug,
                             String shortDesc, String icon) {
        com.arudra.crm.entity.Service s = new com.arudra.crm.entity.Service();
        s.setTitle(title); s.setSlug(slug); s.setShortDescription(shortDesc); s.setIcon(icon); s.setActive(true);
        repo.save(s);
    }

    private void seedPortfolio(PortfolioProjectRepository repo, String title, String slug, String category,
                               String location, int year, String cover) {
        PortfolioProject p = new PortfolioProject();
        p.setTitle(title); p.setSlug(slug); p.setCategory(category); p.setLocation(location);
        p.setYear(year); p.setCoverImage(cover); p.setActive(true);
        repo.save(p);
    }

    private void seedMaterial(MaterialRepository repo, String name, String slug, String category,
                              String color, String finish) {
        Material m = new Material();
        m.setName(name); m.setSlug(slug); m.setCategory(category); m.setColor(color); m.setFinish(finish);
        m.setActive(true);
        repo.save(m);
    }

    private void seedHero(HeroSlideRepository repo, String image, String eyebrow, String title, String accent,
                          String desc, String pbt, String pbl, String sbt, String sbl, int order) {
        HeroSlide h = new HeroSlide();
        h.setImageUrl(image); h.setEyebrow(eyebrow); h.setTitle(title); h.setTitleAccent(accent);
        h.setDescription(desc); h.setPrimaryButtonText(pbt); h.setPrimaryButtonLink(pbl);
        h.setSecondaryButtonText(sbt); h.setSecondaryButtonLink(sbl); h.setDisplayOrder(order); h.setActive(true);
        repo.save(h);
    }

    private void seedTestimonial(TestimonialRepository repo, String name, String role, String location, String quote) {
        Testimonial t = new Testimonial();
        t.setName(name); t.setRole(role); t.setLocation(location); t.setRating(5); t.setQuote(quote); t.setActive(true);
        repo.save(t);
    }
}

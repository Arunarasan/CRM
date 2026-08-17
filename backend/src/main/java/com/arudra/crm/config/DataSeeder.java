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
                    "ROLE_FINANCE_MANAGER", "ROLE_CONTRACTOR");
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
                    "PAYROLL_READ", "PAYROLL_WRITE", "PAYROLL_PROCESS");
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
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_PROJECT_MANAGER",
                    "TASK_APPROVE");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_SUPERVISOR",
                    "TASK_APPROVE", "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_ENGINEER",
                    "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL");
            assignPermissionsToRole(roleRepository, permissionRepository, "ROLE_EMPLOYEE",
                    "EMPLOYEE_TASK_READ", "EMPLOYEE_TASK_EXECUTE", "EMPLOYEE_TASK_ISSUE", "EMPLOYEE_TASK_MATERIAL",
                    "EMPLOYEE_PORTAL");

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
}

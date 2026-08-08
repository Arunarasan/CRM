-- ============================================================================
-- SAFE DATABASE RESET SCRIPT FOR 'defaultdb' (Aiven MySQL)
-- ============================================================================
-- Run this script in Aiven MySQL Web Console or MySQL Workbench.
-- It drops only the application tables and the Flyway schema history table.
-- It leaves the database container 'defaultdb' intact.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Flyway schema history tracking
DROP TABLE IF EXISTS flyway_schema_history;

-- 2. Auth, RBAC & Core System
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS verification_tokens;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS login_history;
DROP TABLE IF EXISTS notification_settings;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS assignment_settings;
DROP TABLE IF EXISTS assignment_history;
DROP TABLE IF EXISTS personal_reminders;

-- 3. Customers & Leads
DROP TABLE IF EXISTS customer_tags;
DROP TABLE IF EXISTS customer_notes;
DROP TABLE IF EXISTS customer_followups;
DROP TABLE IF EXISTS customer_documents;
DROP TABLE IF EXISTS customer_addresses;
DROP TABLE IF EXISTS customer_activities;
DROP TABLE IF EXISTS customer_payments;
DROP TABLE IF EXISTS customer_ledger_entries;
DROP TABLE IF EXISTS contact_persons;
DROP TABLE IF EXISTS customers;

DROP TABLE IF EXISTS lead_tags;
DROP TABLE IF EXISTS lead_status_history;
DROP TABLE IF EXISTS lead_reminders;
DROP TABLE IF EXISTS lead_notes;
DROP TABLE IF EXISTS lead_negotiations;
DROP TABLE IF EXISTS lead_labels;
DROP TABLE IF EXISTS lead_followups;
DROP TABLE IF EXISTS lead_documents;
DROP TABLE IF EXISTS lead_communications;
DROP TABLE IF EXISTS lead_assignments;
DROP TABLE IF EXISTS lead_activities;
DROP TABLE IF EXISTS leads;

-- 4. Site Visits & Measurements
DROP TABLE IF EXISTS site_visit_assignments;
DROP TABLE IF EXISTS site_visit_checklists;
DROP TABLE IF EXISTS site_visit_history;
DROP TABLE IF EXISTS site_visit_media;
DROP TABLE IF EXISTS site_measurements;
DROP TABLE IF EXISTS site_rooms;
DROP TABLE IF EXISTS site_visits;

DROP TABLE IF EXISTS measurement_walls;
DROP TABLE IF EXISTS measurement_windows;
DROP TABLE IF EXISTS measurement_plumbings;
DROP TABLE IF EXISTS measurement_media;
DROP TABLE IF EXISTS measurement_material_estimates;
DROP TABLE IF EXISTS measurement_items;
DROP TABLE IF EXISTS measurement_history;
DROP TABLE IF EXISTS measurement_furnitures;
DROP TABLE IF EXISTS measurement_floors;
DROP TABLE IF EXISTS measurement_electricals;
DROP TABLE IF EXISTS measurement_drawings;
DROP TABLE IF EXISTS measurement_doors;
DROP TABLE IF EXISTS measurement_checklists;
DROP TABLE IF EXISTS measurement_ceilings;
DROP TABLE IF EXISTS measurement_assignments;
DROP TABLE IF EXISTS measurement_activity_logs;
DROP TABLE IF EXISTS measurement_rooms;
DROP TABLE IF EXISTS measurements;

-- 5. BOQ & Quotations
DROP TABLE IF EXISTS boq_item_labours;
DROP TABLE IF EXISTS boq_item_materials;
DROP TABLE IF EXISTS boq_items;
DROP TABLE IF EXISTS boq_phases;
DROP TABLE IF EXISTS boq_change_logs;
DROP TABLE IF EXISTS boq_activity_logs;
DROP TABLE IF EXISTS boqs;

DROP TABLE IF EXISTS quotation_activities;
DROP TABLE IF EXISTS quotation_additional_charges;
DROP TABLE IF EXISTS quotation_approvals;
DROP TABLE IF EXISTS quotation_attachments;
DROP TABLE IF EXISTS quotation_discounts;
DROP TABLE IF EXISTS quotation_items;
DROP TABLE IF EXISTS quotation_labours;
DROP TABLE IF EXISTS quotation_negotiations;
DROP TABLE IF EXISTS quotation_taxes;
DROP TABLE IF EXISTS quotation_terms;
DROP TABLE IF EXISTS quotations;

-- 6. Projects & Project Sub-tables
DROP TABLE IF EXISTS project_teams;
DROP TABLE IF EXISTS project_stages;
DROP TABLE IF EXISTS project_rooms;
DROP TABLE IF EXISTS project_room_items;
DROP TABLE IF EXISTS project_risks;
DROP TABLE IF EXISTS project_quality_checks;
DROP TABLE IF EXISTS project_phases;
DROP TABLE IF EXISTS project_payments;
DROP TABLE IF EXISTS project_material_requirements;
DROP TABLE IF EXISTS project_item_progress_logs;
DROP TABLE IF EXISTS project_issues;
DROP TABLE IF EXISTS project_expenses;
DROP TABLE IF EXISTS project_documents;
DROP TABLE IF EXISTS project_daily_log_media;
DROP TABLE IF EXISTS project_daily_log_materials;
DROP TABLE IF EXISTS project_daily_log_employees;
DROP TABLE IF EXISTS project_daily_logs;
DROP TABLE IF EXISTS project_customer_approvals;
DROP TABLE IF EXISTS project_change_request_phases;
DROP TABLE IF EXISTS project_change_requests;
DROP TABLE IF EXISTS project_activity_logs;
DROP TABLE IF EXISTS projects;

-- 7. Tasks & Field Execution
DROP TABLE IF EXISTS task_time_logs;
DROP TABLE IF EXISTS task_progress_media;
DROP TABLE IF EXISTS task_progress_updates;
DROP TABLE IF EXISTS task_material_usage;
DROP TABLE IF EXISTS task_issues;
DROP TABLE IF EXISTS task_dependencies;
DROP TABLE IF EXISTS task_comments;
DROP TABLE IF EXISTS task_checkins;
DROP TABLE IF EXISTS task_checklist_items;
DROP TABLE IF EXISTS task_checklists;
DROP TABLE IF EXISTS task_attachments;
DROP TABLE IF EXISTS task_assignments;
DROP TABLE IF EXISTS tasks;

-- 8. Employees, Workforce & Payroll
DROP TABLE IF EXISTS workforce_documents;
DROP TABLE IF EXISTS workforce;
DROP TABLE IF EXISTS salary_structures;
DROP TABLE IF EXISTS salary_records;
DROP TABLE IF EXISTS payroll_recoveries;
DROP TABLE IF EXISTS performance_reviews;
DROP TABLE IF EXISTS manpower_requests;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS employee_loans;
DROP TABLE IF EXISTS employee_documents;
DROP TABLE IF EXISTS employee_deductions;
DROP TABLE IF EXISTS employee_bonuses;
DROP TABLE IF EXISTS employee_advances;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS daily_report_media;
DROP TABLE IF EXISTS daily_reports;
DROP TABLE IF EXISTS employees;

-- 9. Contractors & Subcontracting
DROP TABLE IF EXISTS work_package_items;
DROP TABLE IF EXISTS work_package_changes;
DROP TABLE IF EXISTS work_package_assignments;
DROP TABLE IF EXISTS contractor_work_packages;
DROP TABLE IF EXISTS contractor_safety_records;
DROP TABLE IF EXISTS contractor_quality_inspections;
DROP TABLE IF EXISTS contractor_projects;
DROP TABLE IF EXISTS contractor_progress_media;
DROP TABLE IF EXISTS contractor_payments;
DROP TABLE IF EXISTS contractor_material_issue_items;
DROP TABLE IF EXISTS contractor_material_issues;
DROP TABLE IF EXISTS contractor_ledger_entries;
DROP TABLE IF EXISTS contractor_documents;
DROP TABLE IF EXISTS contractor_daily_progress;
DROP TABLE IF EXISTS contractor_bill_items;
DROP TABLE IF EXISTS contractor_bill_approvals;
DROP TABLE IF EXISTS contractor_bills;
DROP TABLE IF EXISTS contractor_attendance;
DROP TABLE IF EXISTS contractors;

-- 10. Products, Inventory & Procurement
DROP TABLE IF EXISTS product_suppliers;
DROP TABLE IF EXISTS stock_transfer_items;
DROP TABLE IF EXISTS stock_transfers;
DROP TABLE IF EXISTS damage_entries;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS inventory_categories;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS suppliers;

DROP TABLE IF EXISTS material_request_items;
DROP TABLE IF EXISTS material_requests;
DROP TABLE IF EXISTS grn_photos;
DROP TABLE IF EXISTS goods_receipt_note_items;
DROP TABLE IF EXISTS goods_receipt_notes;
DROP TABLE IF EXISTS purchase_return_items;
DROP TABLE IF EXISTS purchase_returns;
DROP TABLE IF EXISTS purchase_payments;
DROP TABLE IF EXISTS purchase_bills;
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS purchase_request_approvals;
DROP TABLE IF EXISTS purchase_request_items;
DROP TABLE IF EXISTS purchase_requests;

-- 11. Billing & Finance
DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS payment_schedules;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS credit_debit_notes;

SET FOREIGN_KEY_CHECKS = 1;

-- Verification
SELECT COUNT(*) AS remaining_tables FROM information_schema.tables WHERE table_schema = 'defaultdb';

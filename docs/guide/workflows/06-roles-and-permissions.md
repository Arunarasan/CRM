# Roles & Permissions Matrix

## Account types
| Type | Signs in to | Can do |
|---|---|---|
| **Admin** | Desktop CRM | Everything, all modules. |
| **Employee** | Mobile portal (`/employee`) | Own tasks, attendance, pay, requests, goods receipt/delivery, leads, calls. Limited desktop pages for lead work only. |
| **Customer** | No login | Uses tracking, quote and review links. |
| **Contractor** | Contractor portal | Own work packages and bills. |

Separate department roles (Manager, Sales, Accounts, Engineer…) were merged into **Admin** and **Employee**; HR and finance rights now come from **permissions**.

## Module permissions (what the menu needs)
| Menu | Permission to see |
|---|---|
| Customers | `CUSTOMER_READ` (write `CUSTOMER_WRITE`, delete `CUSTOMER_DELETE`, money `CUSTOMER_FINANCIAL_READ`) |
| Leads | `LEAD_READ` (write, assign, convert, delete) |
| Projects | `PROJECT_READ` (write, approve, delete) |
| Tasks | `TASK_READ` (write, assign, approve) |
| Inventory | `INVENTORY_READ`, `INVENTORY_WRITE`, warehouse, stock-transfer, material-request and damage permissions |
| Purchasing | `PURCHASE_READ`, `PURCHASE_WRITE`, `PURCHASE_APPROVE` |
| Billing / Finance | `FINANCE_READ`, `FINANCE_WRITE`, `FINANCE_APPROVE`, `FINANCE_COLLECT` |
| Orders | `BUNDLE_READ`, `BUNDLE_MOVE`, `BUNDLE_WRITE` |
| HR & Payroll | `WORKFORCE_READ/WRITE`, `PAYROLL_READ/WRITE/PROCESS` |
| Contractors | `CONTRACTOR_READ/WRITE/PAYMENT`, `WORK_PACKAGE_*` |
| Website | `WEBSITE_READ`, `WEBSITE_WRITE` |
| Users, Settings | Admin only |

## Who can approve what
| Action | Who |
|---|---|
| Create a project from a quote | Admin or Project Manager (employees send for approval) |
| Start/approve a quote change on a project | Admin or Project Manager |
| Approve a purchase order | Holder of `PURCHASE_APPROVE` |
| Approve a customer payment collected by an employee | Finance (`FINANCE_APPROVE`) |
| Approve a payslip / pay | HR with `PAYROLL_PROCESS` |
| Approve contractor bills | Engineer → Project Manager → Finance (ladder) |
| Approve attendance flags, leave, profile changes | HR |
| Close the Installation task | Admin approval |
| Cancel a project with refund | Holder of `PROJECT_APPROVE` |

## Tip for the AI assistant
If a user says they "cannot see" a menu or button, check this table: the usual reason is a missing permission or the wrong account type.

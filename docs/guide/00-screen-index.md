# Arudra CRM — Screen Index

> Master list of every screen. Use it to find which guide file explains a screen.
> Three audiences: **Admin** (desktop web app), **Employee** (mobile portal), **Website visitor / customer** (public site).
> Paths are URLs inside each app. Admin app lives under `/crm`, employee portal under `/crm/employee`, public site at `/`.

## Who can log in (roles)

| Account type | Lands on | Can see |
|---|---|---|
| **Admin** (`ROLE_ADMIN`) | Admin desktop app `/dashboard` | Everything, subject to module permissions |
| **Employee** (`ROLE_EMPLOYEE`) | Mobile portal `/employee` | Only their own tasks, attendance, salary, requests. Blocked from admin HR/finance/etc. Allowed desktop pages only for lead work: measurements, site visits, BOQ, quotations, leads |
| **Customer** (`ROLE_CUSTOMER`) | Public site | Order/project tracking by link; the self-service customer portal is currently switched off (`/portal` redirects to home) |
| **Contractor** (`ROLE_CONTRACTOR`) | Contractor portal | Own work packages and bills |

Sign-in is one page on the public website (`/login`); after login the user is sent to the CRM. Forgot password uses an emailed OTP.

Sidebar menu items are shown only if the user has the module permission (e.g. `LEAD_READ`, `FINANCE_READ`). Admins see all.

---

## A. Admin app (guide folder: `admin/`)

| Menu | Screen | Path | Guide file |
|---|---|---|---|
| Dashboard | Dashboard | `/dashboard` | 01-dashboard-and-navigation |
| Customers | Customer list, Customer profile | `/customers`, `/customers/:id` | 03-customers |
| Leads | Lead board/list, Lead profile | `/leads`, `/leads/:id` | 02-leads |
| (Leads) | Site visits list / new / profile | `/site-visits`, `/site-visits/new`, `/site-visits/:id` | 04-site-visit-measurement-quote |
| (Leads) | Measurements list / new / details / item catalog | `/measurements`, `/measurements/new`, `/measurements/:id`, `/measurements/catalog` | 04-site-visit-measurement-quote |
| (Leads) | BOQ list / new / edit / details / reports (legacy, guarded) | `/boq`, `/boq/new`, `/boq/:id`, `/boq/:id/edit`, `/boq/:id/reports` | 04-site-visit-measurement-quote |
| (Leads) | Quotations list / new / details / print | `/quotations`, `/quotations/new`, `/quotations/:id`, `/quotations/:id/print` | 04-site-visit-measurement-quote |
| Projects | Project list, Project Command Center, Task report | `/projects`, `/projects/:id`, `/projects/:id/tasks/:taskId` | 05-projects |
| Tasks | Tasks board, Employees tab (smart assign), Call Recordings | `/tasks` (old `/workflow`, `/assignments` redirect here) | 06-tasks |
| Orders | Orders (bundles) list, detail, goods delivery | `/bundles`, `/bundles/:id`, `/bundles/code/:code`, `/bundles/delivery` (`/orders` redirects) | 07-orders-bundles |
| Inventory | Dashboard, Materials, Warehouses, Stock movement, Transfers, Material requests, Damage | `/inventory/*` | 08-inventory |
| Purchasing | Dashboard, Purchase orders, Suppliers, Receipt log, Reports, PO builder/profile, Supplier profile | `/purchases/*` | 09-purchasing |
| Billing | Counter sale, Invoices, Returns, Invoice form/detail, Product return form | `/billing/*` | 10-billing |
| Finance | Dashboard, Payments, Cash book, Accounts/Outstanding/Ledger/Profitability, Expenses, Reports | `/finance/*` | 11-finance |
| Workforce (HR & Payroll) | Home, People, Payroll, Cashflow, Attendance, Daily reports, Leave, Departments, Performance, Review rewards, Approvals, Reports, profile, payslip | `/workforce/*`, `/workforce/:id`, `/hr/employees/:id`, `/hr/payslip/:id` | 12-hr-payroll |
| Contractors | Dashboard, Directory, Work packages, Materials, Progress, Quality, Bills, Payments, Ledger, Reports + detail pages | `/contractors/*` | 13-contractors |
| Website | Hero slides, Categories, Products, Services, Portfolio, Materials, Testimonials, Enquiries, Content, Reviews, Settings, Document design | `/website/*` | 14-website-cms |
| Notifications | Notification center | `/notifications` | 01-dashboard-and-navigation |
| Users | User management | `/users` | 15-users-and-settings |
| Settings | App settings, language | `/settings` | 15-users-and-settings |
| (outside menu) | Office attendance kiosk | `/kiosk` | 12-hr-payroll (attendance) |

## B. Employee portal (guide folder: `employee/`)

Bottom tabs: **Home · Tasks · Gifts · Requests · More**.

| Bottom tab / menu | Screen | Path | Guide file |
|---|---|---|---|
| Home | Home with clock widget | `/employee` | 01-home-and-attendance |
| Tasks | Task list, Task detail, Search | `/employee/tasks`, `/employee/tasks/:id`, `/employee/search` | 02-tasks |
| Lead work | Lead workspace, Visit & Measure, BOQ, Quotation, Quote | `/employee/lead/:leadId`, `/employee/visit-measure/new`, `/employee/boq/new`, `/employee/quotation/new`, `/employee/quote/new` | 03-lead-work |
| Bell icon (top bar) | Notifications | `/employee/notifications` | 01-home-and-attendance |
| More | Hub of everything below | `/employee/more` | 01-home-and-attendance |
| More | My profile, Documents, Settings | `/employee/profile`, `/documents`, `/settings` | 04-profile-pay-leave |
| More | Attendance, Timesheet | `/employee/attendance`, `/timesheet` | 01-home-and-attendance |
| More | Salary & payslips, Leave, Gifts | `/employee/salary`, `/leave`, `/gifts` | 04-profile-pay-leave |
| More | Requests hub, Material requests, Manpower requests | `/employee/requests`, `/requests/material`, `/requests/manpower` | 05-requests-and-field |
| More | Goods receipts, Goods delivery | `/employee/goods-receipts`, `/deliveries` | 05-requests-and-field |
| More | My leads, Daily reports, Task management | `/employee/leads`, `/daily-reports`, `/task-management` | 03-lead-work, 05-requests-and-field |
| More | Calls, Call leads | `/employee/calls`, `/call-leads` | 06-calls-and-reviews |
| More | Review QR | `/employee/review-qr` | 06-calls-and-reviews |

## C. Public website (guide folder: `website/`)

| Screen | Path | Guide file |
|---|---|---|
| Home | `/` | 01-browsing-and-enquiry |
| Services, Service detail | `/services`, `/services/:slug` | 01-browsing-and-enquiry |
| Portfolio, Portfolio detail | `/portfolio`, `/portfolio/:slug` | 01-browsing-and-enquiry |
| Products, Category, Product detail | `/products`, `/products/:category`, `/products/:category/:slug` | 01-browsing-and-enquiry |
| Materials, Material detail | `/materials`, `/materials/:slug` | 01-browsing-and-enquiry |
| Design studio | `/design-studio` | 01-browsing-and-enquiry |
| About, Contact, Consultation | `/about`, `/contact`, `/consultation` | 01-browsing-and-enquiry |
| Privacy, Terms, Refund | `/privacy`, `/terms`, `/refund` | 01-browsing-and-enquiry |
| Order tracking (no login) | `/track/:token` | 02-tracking-quote-review |
| View quote (no login) | `/q/:token` | 02-tracking-quote-review |
| Employee review page (from QR) | `/r/:token` | 02-tracking-quote-review |
| Login, Forgot password | `/login`, `/forgot-password` | 03-login-and-account |
| Old shop/cart/checkout/wishlist/register/portal URLs | redirect to products or home | — (shop became catalogue + enquiry) |

---

## Guide status

Written files are listed in `README.md` in this folder. Anything not yet written is marked there.

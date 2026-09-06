import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import { DesktopGuard, EmployeeGuard, RedirectToSignIn } from "./components/RouteGuard";
import ImageViewerProvider from "./components/ImageViewerProvider";
import { Toaster } from "./components/ui/toast";

// Lazy loading all pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadProfile = lazy(() => import("./pages/LeadProfile"));
const SiteVisits = lazy(() => import("./pages/SiteVisits"));
const SiteVisitProfile = lazy(() => import("./pages/SiteVisitProfile"));
const SiteVisitCreate = lazy(() => import("./pages/siteVisits/SiteVisitCreate"));
const MeasurementList = lazy(() => import("./pages/measurements/MeasurementList"));
const MeasurementForm = lazy(() => import("./pages/measurements/MeasurementForm"));
const MeasurementDetails = lazy(() => import("./pages/measurements/MeasurementDetails"));
const MeasurementItemCatalogPage = lazy(() => import("./pages/measurements/MeasurementItemCatalog"));
const WebsiteLayout = lazy(() => import("./pages/website/WebsiteLayout"));
const HeroSlidesAdmin = lazy(() => import("./pages/website/HeroSlidesAdmin"));
const CategoriesAdmin = lazy(() => import("./pages/website/CategoriesAdmin"));
const ProductsAdmin = lazy(() => import("./pages/website/ProductsAdmin"));
const ServicesAdmin = lazy(() => import("./pages/website/ServicesAdmin"));
const PortfolioAdmin = lazy(() => import("./pages/website/PortfolioAdmin"));
const MaterialsAdmin = lazy(() => import("./pages/website/MaterialsAdmin"));
const TestimonialsAdmin = lazy(() => import("./pages/website/TestimonialsAdmin"));
const EnquiriesAdmin = lazy(() => import("./pages/website/EnquiriesAdmin"));
const SettingsAdmin = lazy(() => import("./pages/website/SettingsAdmin"));
const ContentAdmin = lazy(() => import("./pages/website/ContentAdmin"));
const ReviewsAdmin = lazy(() => import("./pages/website/ReviewsAdmin"));
const BoqList = lazy(() => import("./pages/boq/BoqList"));
const BoqEntry = lazy(() => import("./pages/boq/BoqEntry"));
const BoqForm = lazy(() => import("./pages/boq/BoqForm"));
const BoqDetails = lazy(() => import("./pages/boq/BoqDetails"));
const BoqReports = lazy(() => import("./pages/boq/BoqReports"));
const QuotationList = lazy(() => import("./pages/quotations/QuotationList"));
const QuotationEntry = lazy(() => import("./pages/quotations/QuotationEntry"));
const QuotationDetails = lazy(() => import("./pages/quotations/QuotationDetails"));
const QuotationPrint = lazy(() => import("./pages/quotations/QuotationPrint"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectCommandCenter = lazy(() => import("./pages/ProjectCommandCenter"));
const TaskReportPage = lazy(() => import("./pages/projectCommandCenter/TaskReportPage"));
const Tasks = lazy(() => import("./pages/Tasks"));
const ContractorLayout = lazy(() => import("./pages/contractors/ContractorLayout"));
const ContractorDashboard = lazy(() => import("./pages/contractors/ContractorDashboard"));
const ContractorsPage = lazy(() => import("./pages/contractors/ContractorsPage"));
const ContractorDetailPage = lazy(() => import("./pages/contractors/ContractorDetailPage"));
const WorkPackagesPage = lazy(() => import("./pages/contractors/WorkPackagesPage"));
const WorkPackageDetailPage = lazy(() => import("./pages/contractors/WorkPackageDetailPage"));
const ContractorMaterialsPage = lazy(() => import("./pages/contractors/MaterialsPage"));
const ContractorProgressPage = lazy(() => import("./pages/contractors/ProgressPage"));
const ContractorQualityPage = lazy(() => import("./pages/contractors/QualityPage"));
const ContractorBillsPage = lazy(() => import("./pages/contractors/BillsPage"));
const ContractorBillFormPage = lazy(() => import("./pages/contractors/BillFormPage"));
const ContractorBillDetailPage = lazy(() => import("./pages/contractors/BillDetailPage"));
const ContractorPaymentsPage = lazy(() => import("./pages/contractors/PaymentsPage"));
const ContractorLedgerPage = lazy(() => import("./pages/contractors/LedgerPage"));
const ContractorReportsPage = lazy(() => import("./pages/contractors/ContractorReportsPage"));
const InventoryLayout = lazy(() => import("./pages/inventory/InventoryLayout"));
const InventoryDashboard = lazy(() => import("./pages/inventory/InventoryDashboard"));
const MaterialMaster = lazy(() => import("./pages/inventory/MaterialMaster"));
const Warehouses = lazy(() => import("./pages/inventory/Warehouses"));
const StockMovement = lazy(() => import("./pages/inventory/StockMovement"));
const StockTransfers = lazy(() => import("./pages/inventory/StockTransfers"));
const MaterialRequests = lazy(() => import("./pages/inventory/MaterialRequests"));
const DamageEntries = lazy(() => import("./pages/inventory/DamageEntries"));
const PurchaseLayout = lazy(() => import("./pages/purchases/PurchaseLayout"));
const PurchaseDashboard = lazy(() => import("./pages/purchases/PurchaseDashboard"));
const PurchaseOrdersPage = lazy(() => import("./pages/purchases/PurchaseOrdersPage"));
const SuppliersPage = lazy(() => import("./pages/purchases/SuppliersPage"));
const SupplierProfilePage = lazy(() => import("./pages/purchases/SupplierProfilePage"));
const PurchaseReportsPage = lazy(() => import("./pages/purchases/PurchaseReportsPage"));
const GoodsReceiptLogPage = lazy(() => import("./pages/purchases/GoodsReceiptLogPage"));
const PurchaseOrderBuilder = lazy(() => import("./pages/PurchaseOrderBuilder"));
const PurchaseOrderProfile = lazy(() => import("./pages/PurchaseOrderProfile"));
const BillingLayout = lazy(() => import("./pages/finance/BillingLayout"));
const SalesReturnsPage = lazy(() => import("./pages/finance/SalesReturnsPage"));
const ProductReturnForm = lazy(() => import("./pages/finance/ProductReturnForm"));
const FinanceLayout = lazy(() => import("./pages/finance/FinanceLayout"));
const FinanceDashboard = lazy(() => import("./pages/finance/FinanceDashboard"));
const FinanceInvoicesPage = lazy(() => import("./pages/finance/InvoicesPage"));
const FinanceInvoiceFormPage = lazy(() => import("./pages/finance/InvoiceFormPage"));
const FinanceCounterSalePage = lazy(() => import("./pages/finance/CounterSalePage"));
const FinanceInvoiceDetailPage = lazy(() => import("./pages/finance/InvoiceDetailPage"));
const FinancePaymentsPage = lazy(() => import("./pages/finance/PaymentsPage"));
const FinanceAccountsPage = lazy(() => import("./pages/finance/AccountsPage"));
const FinanceExpensesPage = lazy(() => import("./pages/finance/ExpensesPage"));
const FinanceCashBookPage = lazy(() => import("./pages/finance/CashBookPage"));
const FinanceReportsPage = lazy(() => import("./pages/finance/FinanceReportsPage"));
const EmployeeProfile = lazy(() => import("./pages/EmployeeProfile"));
const WorkforceLayout = lazy(() => import("./pages/workforce/WorkforceLayout"));
const WorkforceDirectoryPage = lazy(() => import("./pages/workforce/WorkforceDirectoryPage"));
const WorkforceProfilePage = lazy(() => import("./pages/workforce/WorkforceProfilePage"));
const WorkforceReportsPage = lazy(() => import("./pages/workforce/WorkforceReportsPage"));
const DailyReportsPage = lazy(() => import("./pages/workforce/DailyReportsPage"));
const ProfileApprovalsPage = lazy(() => import("./pages/workforce/ProfileApprovalsPage"));
const HrFinanceDashboard = lazy(() => import("./pages/hr/HrFinanceDashboard"));
const CashflowPage = lazy(() => import("./pages/hr/CashflowPage"));
const HrPerformancePage = lazy(() => import("./pages/hr/HrPerformancePage"));
const HrLeavePage = lazy(() => import("./pages/hr/HrLeavePage"));
const HrDepartmentsPage = lazy(() => import("./pages/hr/HrDepartmentsPage"));
const HrAttendancePage = lazy(() => import("./pages/hr/HrAttendancePage"));
const PayslipPrint = lazy(() => import("./pages/hr/PayslipPrint"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));

// Mobile-first Employee Task & Work Execution module — its own layout, not DashboardLayout.
const MobileLayout = lazy(() => import("./pages/employeeTasks/MobileLayout"));
const MobileHome = lazy(() => import("./pages/employeeTasks/MobileHome"));
const TaskListMobile = lazy(() => import("./pages/employeeTasks/TaskList"));
const TaskDetailMobile = lazy(() => import("./pages/employeeTasks/TaskDetail"));
const EmployeeVisitMeasure = lazy(() => import("./pages/employeeTasks/EmployeeVisitMeasure"));
const EmployeeBoq = lazy(() => import("./pages/employeeTasks/EmployeeBoq"));
const EmployeeQuotation = lazy(() => import("./pages/employeeTasks/EmployeeQuotation"));
const EmployeeBoqQuote = lazy(() => import("./pages/employeeTasks/EmployeeBoqQuote"));
const MobileNotifications = lazy(() => import("./pages/employeeTasks/MobileNotifications"));

// Employee Self-Service Portal — HR screens inside the same mobile shell.
const EmployeeMore = lazy(() => import("./pages/employeePortal/EmployeeMore"));
const EmployeeProfilePortal = lazy(() => import("./pages/employeePortal/MyProfile"));
const EmployeeAttendance = lazy(() => import("./pages/employeePortal/Attendance"));
const EmployeeLeave = lazy(() => import("./pages/employeePortal/Leave"));
const EmployeeSalary = lazy(() => import("./pages/employeePortal/Salary"));
const EmployeeProjects = lazy(() => import("./pages/employeePortal/Projects"));
const EmployeeDocuments = lazy(() => import("./pages/employeePortal/Documents"));
const EmployeeTimesheet = lazy(() => import("./pages/employeePortal/Timesheet"));
const EmployeeSettings = lazy(() => import("./pages/employeePortal/Settings"));
const EmployeeRequests = lazy(() => import("./pages/employeePortal/Requests"));
const EmployeeMaterialRequests = lazy(() => import("./pages/employeePortal/MaterialRequests"));
const EmployeeLeads = lazy(() => import("./pages/employeePortal/Leads"));
const EmployeeManpowerRequests = lazy(() => import("./pages/employeePortal/ManpowerRequests"));
const EmployeeDailyReports = lazy(() => import("./pages/employeePortal/DailyReports"));
const EmployeeTaskManagement = lazy(() => import("./pages/employeePortal/TaskManagement"));
const EmployeeGoodsReceipts = lazy(() => import("./pages/employeePortal/GoodsReceipts"));

// The login/forgot-password pages now live only on the public website (single sign-in);
// the CRM's /login and /forgot-password routes redirect there via RedirectToSignIn.
const Users = lazy(() => import("./pages/Users"));

// Admin settings — company profile, preferences, notifications, assignment rules, security.
const Settings = lazy(() => import("./pages/Settings"));

// Fallback loader
const PageLoader = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function App() {
  return (
    // basename follows Vite's base (/crm/ in production, / in dev) so the CRM works when
    // served under /crm alongside the public website (Option A).
    <Router basename={import.meta.env.BASE_URL}>
      <ImageViewerProvider>
      <Toaster />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Single sign-in lives on the public website — /crm/login just hands off to it. */}
          <Route path="/login" element={<RedirectToSignIn />} />
          <Route path="/forgot-password" element={<RedirectToSignIn />} />
          
          {/* Protected Routes Wrapper — desktop ERP, blocked for portal-only field employees */}
          <Route path="/" element={<DesktopGuard><DashboardLayout /></DesktopGuard>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerProfile />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadProfile />} />
            <Route path="site-visits" element={<SiteVisits />} />
            <Route path="site-visits/new" element={<SiteVisitCreate />} />
            <Route path="site-visits/:id" element={<SiteVisitProfile />} />
            <Route path="measurements" element={<MeasurementList />} />
            <Route path="measurements/new" element={<MeasurementForm />} />
            <Route path="measurements/catalog" element={<MeasurementItemCatalogPage />} />
            <Route path="measurements/:id" element={<MeasurementDetails />} />
            <Route path="boq" element={<BoqList />} />
            {/* Standalone BOQ creation removed — BOQs are generated from a Measurement
                (Measurement → Generate BOQ); the form remains for editing only. */}
            <Route path="boq/new" element={<BoqEntry />} />
            <Route path="boq/:id/edit" element={<BoqForm />} />
            <Route path="boq/:id" element={<BoqDetails />} />
            <Route path="boq/:id/reports" element={<BoqReports />} />
            <Route path="quotations" element={<QuotationList />} />
            <Route path="quotations/new" element={<QuotationEntry />} />
            <Route path="quotations/:id" element={<QuotationDetails />} />
            <Route path="quotations/:id/print" element={<QuotationPrint />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectCommandCenter />} />
            <Route path="projects/:id/tasks/:taskId" element={<TaskReportPage />} />
            <Route path="tasks" element={<Tasks />} />
            {/* Website / CMS — manage the public marketing site's catalog and content. */}
            <Route path="website" element={<WebsiteLayout />}>
              <Route index element={<HeroSlidesAdmin />} />
              <Route path="categories" element={<CategoriesAdmin />} />
              <Route path="products" element={<ProductsAdmin />} />
              <Route path="services" element={<ServicesAdmin />} />
              <Route path="portfolio" element={<PortfolioAdmin />} />
              <Route path="materials" element={<MaterialsAdmin />} />
              <Route path="testimonials" element={<TestimonialsAdmin />} />
              <Route path="enquiries" element={<EnquiriesAdmin />} />
              {/* Retired tabs — backend data kept, nav removed; old links land on Enquiries. */}
              <Route path="orders" element={<Navigate to="/website/enquiries" replace />} />
              <Route path="service-requests" element={<Navigate to="/website/enquiries" replace />} />
              <Route path="content" element={<ContentAdmin />} />
              <Route path="reviews" element={<ReviewsAdmin />} />
              <Route path="settings" element={<SettingsAdmin />} />
            </Route>
            {/* Workflow Console + Smart Assignment are merged into the Tasks screen. */}
            <Route path="workflow" element={<Navigate to="/tasks" replace />} />
            <Route path="assignments" element={<Navigate to="/tasks" replace />} />
            {/* Contractor Management — contractors work through project work packages,
                never as a standalone engagement, so the whole module lives under one shell. */}
            <Route path="contractors" element={<ContractorLayout />}>
              <Route index element={<ContractorDashboard />} />
              <Route path="directory" element={<ContractorsPage />} />
              <Route path="work-packages" element={<WorkPackagesPage />} />
              <Route path="materials" element={<ContractorMaterialsPage />} />
              <Route path="progress" element={<ContractorProgressPage />} />
              <Route path="quality" element={<ContractorQualityPage />} />
              <Route path="bills" element={<ContractorBillsPage />} />
              <Route path="payments" element={<ContractorPaymentsPage />} />
              <Route path="ledger" element={<ContractorLedgerPage />} />
              <Route path="reports" element={<ContractorReportsPage />} />
            </Route>
            <Route path="contractors/directory/:id" element={<ContractorDetailPage />} />
            <Route path="contractors/work-packages/:id" element={<WorkPackageDetailPage />} />
            <Route path="contractors/bills/new" element={<ContractorBillFormPage />} />
            <Route path="contractors/bills/:id" element={<ContractorBillDetailPage />} />
            <Route path="inventory" element={<InventoryLayout />}>
              <Route index element={<InventoryDashboard />} />
              <Route path="materials" element={<MaterialMaster />} />
              <Route path="warehouses" element={<Warehouses />} />
              <Route path="stock-movement" element={<StockMovement />} />
              <Route path="transfers" element={<StockTransfers />} />
              <Route path="material-requests" element={<MaterialRequests />} />
              <Route path="damage" element={<DamageEntries />} />
            </Route>
            <Route path="purchases" element={<PurchaseLayout />}>
              <Route index element={<PurchaseDashboard />} />
              <Route path="orders" element={<PurchaseOrdersPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="receipt-log" element={<GoodsReceiptLogPage />} />
              <Route path="reports" element={<PurchaseReportsPage />} />
            </Route>
            <Route path="purchases/orders/new" element={<PurchaseOrderBuilder />} />
            <Route path="purchases/orders/:id" element={<PurchaseOrderProfile />} />
            <Route path="purchases/suppliers/:id" element={<SupplierProfilePage />} />
            {/* Billing — customer-facing sales: counter sale, invoices, product returns. */}
            <Route path="billing" element={<BillingLayout />}>
              <Route index element={<Navigate to="/billing/counter-sale" replace />} />
              <Route path="counter-sale" element={<FinanceCounterSalePage />} />
              <Route path="invoices" element={<FinanceInvoicesPage />} />
              <Route path="returns" element={<SalesReturnsPage />} />
            </Route>
            <Route path="billing/invoices/new" element={<FinanceInvoiceFormPage />} />
            <Route path="billing/invoices/:id" element={<FinanceInvoiceDetailPage />} />
            <Route path="billing/returns/new" element={<ProductReturnForm />} />
            {/* Finance — the money side: payments, outstanding, ledger, expenses, profitability. */}
            <Route path="finance" element={<FinanceLayout />}>
              <Route index element={<FinanceDashboard />} />
              <Route path="payments" element={<FinancePaymentsPage />} />
              <Route path="cashbook" element={<FinanceCashBookPage />} />
              {/* Accounts = merged Outstanding + Ledger (Customers) and Profitability (Projects). */}
              <Route path="accounts" element={<FinanceAccountsPage />} />
              {/* Old deep links keep working (e.g. ledger?customerId=…, profitability). */}
              <Route path="outstanding" element={<FinanceAccountsPage />} />
              <Route path="ledger" element={<FinanceAccountsPage />} />
              <Route path="profitability" element={<FinanceAccountsPage />} />
              <Route path="expenses" element={<FinanceExpensesPage />} />
              <Route path="reports" element={<FinanceReportsPage />} />
            </Route>
            {/* Legacy deep links → new Billing locations. */}
            <Route path="finance/invoices" element={<Navigate to="/billing/invoices" replace />} />
            <Route path="finance/counter-sale" element={<Navigate to="/billing/counter-sale" replace />} />
            {/* Unified "HR & Payroll" module — one directory + creation flow for employees and
                contractors, with payroll / attendance / leave / departments / performance folded
                in as tabs. The old standalone /hr screen redirects here. Contractor operations
                (/contractors) remain the deep-linked operational module. */}
            <Route path="workforce" element={<WorkforceLayout />}>
              <Route index element={<WorkforceDirectoryPage />} />
              <Route path="payroll" element={<HrFinanceDashboard />} />
              <Route path="cashflow" element={<CashflowPage />} />
              <Route path="attendance" element={<HrAttendancePage />} />
              <Route path="daily-reports" element={<DailyReportsPage />} />
              <Route path="leave" element={<HrLeavePage />} />
              <Route path="departments" element={<HrDepartmentsPage />} />
              <Route path="performance" element={<HrPerformancePage />} />
              <Route path="approvals" element={<ProfileApprovalsPage />} />
              <Route path="reports" element={<WorkforceReportsPage />} />
            </Route>
            <Route path="workforce/:id" element={<WorkforceProfilePage />} />
            {/* Old Human Resources home merged into /workforce; keep the deep links alive. */}
            <Route path="hr" element={<Navigate to="/workforce" replace />} />
            <Route path="hr/employees/:id" element={<EmployeeProfile />} />
            <Route path="hr/payslip/:id" element={<PayslipPrint />} />
            <Route path="notifications" element={<NotificationCenter />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Mobile-first Employee Task module — separate shell, does not touch DashboardLayout */}
          <Route path="/employee" element={<EmployeeGuard><MobileLayout /></EmployeeGuard>}>
            <Route index element={<MobileHome />} />
            <Route path="tasks" element={<TaskListMobile />} />
            <Route path="tasks/:id" element={<TaskDetailMobile />} />
            <Route path="visit-measure/new" element={<EmployeeVisitMeasure />} />
            <Route path="boq/new" element={<EmployeeBoq />} />
            <Route path="quotation/new" element={<EmployeeQuotation />} />
            <Route path="boq-quote/new" element={<EmployeeBoqQuote />} />
            <Route path="notifications" element={<MobileNotifications />} />
            {/* Self-service HR portal screens */}
            <Route path="more" element={<EmployeeMore />} />
            <Route path="profile" element={<EmployeeProfilePortal />} />
            <Route path="attendance" element={<EmployeeAttendance />} />
            <Route path="leave" element={<EmployeeLeave />} />
            <Route path="salary" element={<EmployeeSalary />} />
            <Route path="projects" element={<EmployeeProjects />} />
            <Route path="requests" element={<EmployeeRequests />} />
            <Route path="requests/material" element={<EmployeeMaterialRequests />} />
            <Route path="requests/manpower" element={<EmployeeManpowerRequests />} />
            <Route path="goods-receipts" element={<EmployeeGoodsReceipts />} />
            <Route path="leads" element={<EmployeeLeads />} />
            <Route path="daily-reports" element={<EmployeeDailyReports />} />
            <Route path="task-management" element={<EmployeeTaskManagement />} />
            <Route path="documents" element={<EmployeeDocuments />} />
            <Route path="timesheet" element={<EmployeeTimesheet />} />
            <Route path="settings" element={<EmployeeSettings />} />
          </Route>
        </Routes>
      </Suspense>
      </ImageViewerProvider>
    </Router>
  );
}

export default App;

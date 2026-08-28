import { useEffect, useState, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import customer360Api from "@/lib/customer360Api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import CustomerFormDialog from "./customers/CustomerFormDialog";
import CustomerHeader from "./customer360/components/CustomerHeader";
import CustomerOverviewCards from "./customer360/components/CustomerOverviewCards";
import CustomerSidebar from "./customer360/components/CustomerSidebar";
import type { CustomerOverview, CustomerDashboardStats } from "@/types/customer360";

const ProfileTab = lazy(() => import("./customer360/tabs/ProfileTab"));
const LeadsTab = lazy(() => import("./customer360/tabs/LeadsTab"));
const CommunicationTab = lazy(() => import("./customer360/tabs/CommunicationTab"));
const FollowUpsTab = lazy(() => import("./customer360/tabs/FollowUpsTab"));
const SiteVisitsTab = lazy(() => import("./customer360/tabs/SiteVisitsTab"));
const MeasurementsTab = lazy(() => import("./customer360/tabs/MeasurementsTab"));
const BoqTab = lazy(() => import("./customer360/tabs/BoqTab"));
const QuotationsTab = lazy(() => import("./customer360/tabs/QuotationsTab"));
const ProjectsTab = lazy(() => import("./customer360/tabs/ProjectsTab"));
const TasksTab = lazy(() => import("./customer360/tabs/TasksTab"));
const PaymentsTab = lazy(() => import("./customer360/tabs/PaymentsTab"));
const DocumentsTab = lazy(() => import("./customer360/tabs/DocumentsTab"));
const ActivityLogTab = lazy(() => import("./customer360/tabs/ActivityLogTab"));
const PortalAccessTab = lazy(() => import("./customer360/tabs/PortalAccessTab"));

const TABS = [
  { value: "profile", label: "Profile", Component: ProfileTab },
  { value: "leads", label: "Leads", Component: LeadsTab },
  { value: "communication", label: "Communication", Component: CommunicationTab },
  { value: "followups", label: "Follow-ups", Component: FollowUpsTab },
  { value: "sitevisits", label: "Site Visits", Component: SiteVisitsTab },
  { value: "measurements", label: "Measurements", Component: MeasurementsTab },
  { value: "boqs", label: "BOQs", Component: BoqTab },
  { value: "quotations", label: "Quotations", Component: QuotationsTab },
  { value: "projects", label: "Projects", Component: ProjectsTab },
  { value: "tasks", label: "Tasks", Component: TasksTab },
  { value: "payments", label: "Payments", Component: PaymentsTab },
  { value: "documents", label: "Documents", Component: DocumentsTab },
  { value: "portal", label: "Portal Access", Component: PortalAccessTab },
  { value: "activity", label: "Activity Log", Component: ActivityLogTab },
];

function TabSkeleton() {
  return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const customerId = id!;

  const [overview, setOverview] = useState<CustomerOverview | null>(null);
  const [stats, setStats] = useState<CustomerDashboardStats | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState("profile");

  const loadOverview = () => {
    setIsLoadingOverview(true);
    customer360Api.getOverview(customerId).then(setOverview).finally(() => setIsLoadingOverview(false));
  };
  const loadStats = () => {
    setIsLoadingStats(true);
    customer360Api.getDashboard(customerId).then(setStats).finally(() => setIsLoadingStats(false));
  };

  useEffect(() => {
    loadOverview();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const openEdit = () => {
    // Reuses the existing full-profile endpoint (unchanged) so the edit form has every field.
    // Fetch first, then open, so the shared form populates without an empty flash.
    api.get(`/customers/${customerId}`).then((res) => {
      setEditForm(res.data);
      setIsEditOpen(true);
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <CustomerHeader
        overview={overview}
        isLoading={isLoadingOverview}
        onEdit={openEdit}
        onUploadDocument={() => setActiveTab("documents")}
        onAddFollowUp={() => setActiveTab("followups")}
      />

      <div className="p-4 sm:p-6 space-y-6">
        <CustomerOverviewCards data={stats} isLoading={isLoadingStats} />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
            <div className="overflow-x-auto">
              <TabsList className="w-max">
                {TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                ))}
              </TabsList>
            </div>

            {TABS.map(({ value, Component }) => (
              <TabsContent key={value} value={value}>
                <Suspense fallback={<TabSkeleton />}>
                  <Component customerId={customerId} />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>

          <div className="xl:sticky xl:top-4">
            <CustomerSidebar overview={overview} isLoading={isLoadingOverview} />
          </div>
        </div>
      </div>

      <CustomerFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        customer={editForm}
        onSaved={() => { loadOverview(); loadStats(); }}
      />
    </div>
  );
}

import { useEffect, useState, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import customer360Api from "@/lib/customer360Api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
    api.get(`/customers/${customerId}`).then((res) => setEditForm(res.data));
    setIsEditOpen(true);
  };

  const saveEdit = () => {
    const { tags, addresses, contacts, notes, documents, timeline, ...payload } = editForm;
    api.put(`/customers/${customerId}`, payload).then(() => {
      setIsEditOpen(false);
      loadOverview();
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

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Name</Label><Input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Company Name</Label><Input value={editForm.companyName || ""} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label>WhatsApp Number</Label><Input value={editForm.whatsappNumber || ""} onChange={(e) => setEditForm({ ...editForm, whatsappNumber: e.target.value })} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Alternate Phone</Label><Input value={editForm.alternatePhone || ""} onChange={(e) => setEditForm({ ...editForm, alternatePhone: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Customer Type</Label>
              <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={editForm.customerType || ""} onChange={(e) => setEditForm({ ...editForm, customerType: e.target.value })}>
                <option value="">Select</option>
                {["Individual", "Business", "Builder", "Architect", "Contractor"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {["Active", "Inactive", "Blacklisted"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>GST Number</Label><Input value={editForm.gstNumber || ""} onChange={(e) => setEditForm({ ...editForm, gstNumber: e.target.value })} /></div>
            <div className="space-y-1"><Label>PAN Number</Label><Input value={editForm.panNumber || ""} onChange={(e) => setEditForm({ ...editForm, panNumber: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Billing Address</Label><Input value={editForm.billingAddress || ""} onChange={(e) => setEditForm({ ...editForm, billingAddress: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Shipping / Site Address</Label><Input value={editForm.siteAddress || ""} onChange={(e) => setEditForm({ ...editForm, siteAddress: e.target.value })} /></div>
            <div className="space-y-1"><Label>City</Label><Input value={editForm.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></div>
            <div className="space-y-1"><Label>State</Label><Input value={editForm.state || ""} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} /></div>
            <div className="space-y-1"><Label>Pincode</Label><Input value={editForm.pincode || ""} onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })} /></div>
            <div className="space-y-1"><Label>Photo URL</Label><Input value={editForm.photoUrl || ""} onChange={(e) => setEditForm({ ...editForm, photoUrl: e.target.value })} /></div>
            <div className="space-y-1"><Label>Preferred Language</Label><Input value={editForm.preferredLanguage || ""} onChange={(e) => setEditForm({ ...editForm, preferredLanguage: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Preferred Contact Method</Label>
              <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={editForm.preferredContactMethod || ""} onChange={(e) => setEditForm({ ...editForm, preferredContactMethod: e.target.value })}>
                <option value="">Select</option>
                {["Phone", "WhatsApp", "Email"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

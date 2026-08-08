import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomerDashboardStats } from "@/types/customer360";

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "₹0";
  return `₹${value.toLocaleString("en-IN")}`;
}

interface Stat {
  label: string;
  value: string | number;
}

function StatGroup({ title, stats, isLoading }: { title: string; stats: Stat[]; isLoading: boolean }) {
  return (
    <Card className="shadow-sm rounded-xl border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground truncate">{s.label}</div>
            {isLoading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <div className="text-lg font-bold tracking-tight truncate">{s.value}</div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function CustomerOverviewCards({
  data,
  isLoading,
}: {
  data: CustomerDashboardStats | null;
  isLoading: boolean;
}) {
  const groups: { title: string; stats: Stat[] }[] = [
    {
      title: "Pipeline",
      stats: [
        { label: "Total Leads", value: data?.totalLeads ?? 0 },
        { label: "Open Leads", value: data?.openLeads ?? 0 },
        { label: "Won Leads", value: data?.wonLeads ?? 0 },
        { label: "Lost Leads", value: data?.lostLeads ?? 0 },
        { label: "Site Visits", value: data?.siteVisits ?? 0 },
        { label: "Measurements", value: data?.measurements ?? 0 },
      ],
    },
    {
      title: "Quotations & Delivery",
      stats: [
        { label: "Quotations", value: data?.quotations ?? 0 },
        { label: "Approved", value: data?.approvedQuotations ?? 0 },
        { label: "Rejected", value: data?.rejectedQuotations ?? 0 },
        { label: "Projects", value: data?.projects ?? 0 },
        { label: "Running", value: data?.runningProjects ?? 0 },
        { label: "Completed", value: data?.completedProjects ?? 0 },
      ],
    },
    {
      title: "Tasks & Engagement",
      stats: [
        { label: "Tasks", value: data?.tasks ?? 0 },
        { label: "Pending Tasks", value: data?.pendingTasks ?? 0 },
        { label: "Completed Tasks", value: data?.completedTasks ?? 0 },
        { label: "Documents", value: data?.documents ?? 0 },
        { label: "Follow-ups", value: data?.followUps ?? 0 },
        { label: "Next Follow-up", value: data?.nextFollowUp ? new Date(data.nextFollowUp).toLocaleDateString() : "—" },
      ],
    },
    {
      title: "Finance",
      stats: [
        { label: "Invoices", value: data?.invoices ?? 0 },
        { label: "Paid Amount", value: formatCurrency(data?.paidAmount) },
        { label: "Outstanding", value: formatCurrency(data?.outstandingBalance) },
        { label: "Lifetime Value", value: formatCurrency(data?.customerLifetimeValue) },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {groups.map((g, i) => (
        <div key={g.title} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 75}ms` }}>
          <StatGroup title={g.title} stats={g.stats} isLoading={isLoading} />
        </div>
      ))}
    </div>
  );
}

import { DashboardSummary } from "@/types/dashboard";
import { Users, Target, Briefcase, CheckSquare, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardStatsCards({ data, isLoading }: { data: DashboardSummary | null, isLoading: boolean }) {
  const cards = [
    { title: "Total Revenue", value: data ? `₹${data.totalRevenue.toLocaleString()}` : "0", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Total Customers", value: data?.totalCustomers || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Total Leads", value: data?.totalLeads || 0, icon: Target, color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Active Projects", value: data?.activeProjects || 0, icon: Briefcase, color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Pending Tasks", value: data?.pendingTasks || 0, icon: CheckSquare, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => (
        <Card key={i} className="shadow-sm rounded-xl border-border/40 hover:border-border transition-colors animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 100}ms` }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            <div className={`p-2 rounded-lg ${c.bg}`}>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded-md" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">{c.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

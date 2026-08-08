import { useEffect, useState } from "react";
import api from "@/lib/api";
import { DashboardSummary } from "@/types/dashboard";
import DashboardStatsCards from "@/components/dashboard/DashboardStatsCards";
import RevenueChart from "@/components/dashboard/RevenueChart";
import LeadPipelineChart from "@/components/dashboard/LeadPipelineChart";
import TasksAndFollowUps from "@/components/dashboard/TasksAndFollowUps";
import ProjectProgressList from "@/components/dashboard/ProjectProgressList";
import RecentCustomersTable from "@/components/dashboard/RecentCustomersTable";

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/summary", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
      .then(res => {
        setData(res.data);
      })
      .catch(err => {
        console.error("Failed to fetch dashboard summary", err);
        // Fallback for visual demonstration during development if backend fails
        setData({
          totalCustomers: 120,
          totalLeads: 45,
          activeProjects: 8,
          pendingTasks: 24,
          totalRevenue: 4500000,
          revenueData: [
            { month: "Jan", revenue: 500000 },
            { month: "Feb", revenue: 800000 },
            { month: "Mar", revenue: 1200000 },
            { month: "Apr", revenue: 900000 },
            { month: "May", revenue: 1500000 },
            { month: "Jun", revenue: 2100000 },
          ],
          leadPipeline: [
            { name: "New", value: 15 },
            { name: "Contacted", value: 10 },
            { name: "Site Visit", value: 8 },
            { name: "Quotation Sent", value: 5 },
            { name: "Negotiation", value: 7 },
          ],
          todaysTasks: [
            { id: 1, title: "Call supplier for marble rates", status: "PENDING", priority: "HIGH" },
            { id: 2, title: "Review false ceiling design", status: "IN_PROGRESS", priority: "MEDIUM" },
          ],
          todaysFollowUps: [
            { id: 1, customerName: "Rohan Sharma", status: "NEGOTIATION" },
          ],
          activeProjectProgress: [
            { id: 1, name: "Villa 34 Interior", progress: 65, endDate: "2026-08-15" },
            { id: 2, name: "TechCorp Office", progress: 30, endDate: "2026-10-01" },
          ],
          recentCustomers: [
            { id: 1, name: "Amit Kumar", company: "Mumbai", email: "amit@example.com" },
            { id: 2, name: "Priya Singh", company: "Pune", email: "priya@example.com" },
          ]
        });
      })
      .finally(() => {
        // Small delay to show off the skeleton loading animations
        setTimeout(() => setIsLoading(false), 500);
      });
  }, []);

  return (
    <div className="p-8 space-y-8 bg-background min-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight animate-in fade-in slide-in-from-left-4">Dashboard</h1>
        <p className="text-muted-foreground mt-1 animate-in fade-in slide-in-from-left-4" style={{ animationDelay: '100ms' }}>
          Overview of your enterprise CRM.
        </p>
      </div>

      <DashboardStatsCards data={data} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueChart data={data?.revenueData || []} isLoading={isLoading} />
        <LeadPipelineChart data={data?.leadPipeline || []} isLoading={isLoading} />
      </div>

      <TasksAndFollowUps 
        tasks={data?.todaysTasks || []} 
        followUps={data?.todaysFollowUps || []} 
        isLoading={isLoading} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ProjectProgressList projects={data?.activeProjectProgress || []} isLoading={isLoading} />
        <RecentCustomersTable customers={data?.recentCustomers || []} isLoading={isLoading} />
      </div>
    </div>
  );
}

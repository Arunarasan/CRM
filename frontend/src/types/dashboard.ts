export interface RevenueData {
  month: string;
  revenue: number;
}

export interface LeadStatusData {
  name: string;
  value: number;
}

export interface TaskSummary {
  id: number;
  title: string;
  status: string;
  priority: string;
}

export interface LeadFollowUp {
  id: number;
  customerName: string;
  status: string;
}

export interface ProjectProgress {
  id: number;
  name: string;
  progress: number;
  endDate: string;
}

export interface RecentCustomer {
  id: number;
  name: string;
  company: string;
  email: string;
}

export interface DashboardSummary {
  totalCustomers: number;
  totalLeads: number;
  activeProjects: number;
  pendingTasks: number;
  totalRevenue: number;
  revenueData: RevenueData[];
  leadPipeline: LeadStatusData[];
  todaysTasks: TaskSummary[];
  todaysFollowUps: LeadFollowUp[];
  activeProjectProgress: ProjectProgress[];
  recentCustomers: RecentCustomer[];
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { DashboardSummary } from "@/types/dashboard";
import { leadApi } from "./leads/leadApi";
import type { BoardColumn } from "./leads/constants";
import { formatINR } from "./leads/constants";
import { getCurrentUser } from "@/lib/currentUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus, Users, Target, IndianRupee, FolderKanban, TrendingUp, TrendingDown,
  ArrowRight, UserPlus, FileText, FolderPlus, Wallet, Sparkles,
  Calendar as CalendarIcon, CheckCircle2, Activity, ChevronLeft, ChevronRight,
  MapPin, ReceiptText,
} from "lucide-react";

/* Compact INR for tight KPI tiles: ₹42.76 L / ₹1.20 Cr */
function compactINR(v: number): string {
  if (v >= 1e7) return "₹" + (v / 1e7).toFixed(2).replace(/\.00$/, "") + " Cr";
  if (v >= 1e5) return "₹" + (v / 1e5).toFixed(2).replace(/\.00$/, "") + " L";
  return "₹" + Number(v).toLocaleString("en-IN");
}

/* ── Tiny inline charts (no chart lib needed for these) ─────────────────── */
function Sparkline({ data, color = "#0A573B" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const w = 120, h = 40, max = Math.max(...data, 1), min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => [ (i / (data.length - 1 || 1)) * w, h - ((v - min) / span) * (h - 6) - 3 ]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = `sg-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniBars({ data, color = "#D9B06B" }: { data: number[]; color?: string }) {
  const bars = data.length ? data : [3, 5, 4, 6, 5, 7, 6, 8];
  const max = Math.max(...bars, 1);
  return (
    <div className="flex items-end gap-1 h-10">
      {bars.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max((v / max) * 100, 8)}%`, backgroundColor: color, opacity: 0.55 + (i / bars.length) * 0.45 }} />
      ))}
    </div>
  );
}

/* ── Fallback data (used only if the API is unreachable) ─────────────────── */
const FALLBACK_SUMMARY: DashboardSummary = {
  totalCustomers: 512, totalLeads: 248, activeProjects: 36, pendingTasks: 24, totalRevenue: 4275800,
  revenueData: [
    { month: "Mar", revenue: 2800000 }, { month: "Apr", revenue: 3100000 }, { month: "May", revenue: 2950000 },
    { month: "Jun", revenue: 3600000 }, { month: "Jul", revenue: 3900000 }, { month: "Aug", revenue: 4275800 },
  ],
  leadPipeline: [
    { name: "New", value: 48 }, { name: "Site Visit", value: 36 }, { name: "Quoted", value: 28 },
    { name: "Negotiation", value: 18 }, { name: "Won", value: 16 },
  ],
  todaysTasks: [
    { id: 1, title: "Site measurement – ECR Villa", status: "IN_PROGRESS", priority: "Arun (Site Engineer)" },
    { id: 2, title: "3D design – Ananya Residence", status: "DUE_TODAY", priority: "Priya (Designer)" },
    { id: 3, title: "Material purchase approval", status: "PENDING", priority: "Sathish (Purchase)" },
    { id: 4, title: "Client meeting – TechSol", status: "TOMORROW", priority: "Kavya (Sales)" },
  ],
  todaysFollowUps: [{ id: 1, customerName: "Sreeja Narayanan", status: "Negotiation" }],
  activeProjectProgress: [
    { id: 1, name: "Ananya Residence", progress: 78, endDate: "2026-09-15" },
    { id: 2, name: "GreenField Infra", progress: 52, endDate: "2026-09-30" },
    { id: 3, name: "Lakshmi Builders", progress: 34, endDate: "2026-10-15" },
  ],
  recentCustomers: [
    { id: 1, name: "Vignesh Kumar", company: "Modular Kitchen", email: "vignesh@example.com" },
    { id: 2, name: "Sreeja Narayanan", company: "Villa Project", email: "sreeja@example.com" },
    { id: 3, name: "Ananya Residence", company: "Full Interior", email: "ananya@example.com" },
    { id: 4, name: "Rahul TechSol", company: "Office", email: "rahul@example.com" },
  ],
};

const FALLBACK_BOARD: BoardColumn[] = [
  { key: "New", count: 48, totalValue: 0, leads: [
    { id: 1, leadNumber: "L-1041", name: "Vignesh Kumar", city: "Chennai", leadType: "Modular Kitchen", status: "New", estimatedBudget: 650000 },
    { id: 2, leadNumber: "L-1042", name: "Priya & Aravind", city: "OMR", leadType: "Full Home Interior", status: "New", estimatedBudget: 1800000 },
  ] },
  { key: "Site Visit", count: 36, totalValue: 0, leads: [
    { id: 3, leadNumber: "L-1030", name: "Sreeja Narayanan", city: "ECR", leadType: "Interior + Home Theatre", status: "Site Visit Scheduled", estimatedBudget: 4200000 },
    { id: 4, leadNumber: "L-1031", name: "Rahul TechSol", city: "T. Nagar", leadType: "Office Interiors", status: "Site Visit Scheduled", estimatedBudget: 2800000 },
  ] },
  { key: "Quotation", count: 28, totalValue: 0, leads: [
    { id: 5, leadNumber: "L-1012", name: "Lakshmi Builders", city: "GST Road", leadType: "Office Interior", status: "Quotation Sent", estimatedBudget: 12000000 },
    { id: 6, leadNumber: "L-1013", name: "SPV Developers", city: "Adyar", leadType: "Model Flat", status: "Quotation Sent", estimatedBudget: 8500000 },
  ] },
  { key: "Won", count: 16, totalValue: 0, leads: [
    { id: 7, leadNumber: "L-0990", name: "Ananya Residence", city: "Anna Nagar", leadType: "Full Interior", status: "Project Confirmed", estimatedBudget: 3600000 },
    { id: 8, leadNumber: "L-0991", name: "GreenField Infra", city: "Chennai", leadType: "Workstations", status: "Project Confirmed", estimatedBudget: 7200000 },
  ] },
];

const QUOTES = [
  "Small improvements today, bigger spaces tomorrow.",
  "Design is not just what it looks like, it's how it works.",
  "We shape our spaces, thereafter they shape us.",
  "Great interiors are built on great relationships.",
];

const QUICK_ACTIONS = [
  { label: "Add Lead", icon: UserPlus, to: "/leads" },
  { label: "New Customer", icon: Users, to: "/customers" },
  { label: "New Project", icon: FolderPlus, to: "/projects" },
  { label: "Add Expense", icon: Wallet, to: "/finance" },
  { label: "New Invoice", icon: ReceiptText, to: "/billing" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TASK_STATUS_BADGE: Record<string, string> = {
  IN_PROGRESS: "bg-info/12 text-info", DUE_TODAY: "bg-warning/15 text-warning",
  PENDING: "bg-gold/15 text-gold", TOMORROW: "bg-secondary text-secondary-foreground",
};
const TASK_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "In Progress", DUE_TODAY: "Due Today", PENDING: "Pending", TOMORROW: "Tomorrow",
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary>(FALLBACK_SUMMARY);
  const [board, setBoard] = useState<BoardColumn[]>(FALLBACK_BOARD);
  const [isLoading, setIsLoading] = useState(true);
  const { name } = getCurrentUser();

  useEffect(() => {
    api.get("/dashboard/summary")
      .then((res) => { if (res.data) setData(res.data); })
      .catch((err) => console.error("Failed to fetch dashboard summary", err));
    leadApi.board()
      .then((res) => { if (Array.isArray(res.data) && res.data.length) setBoard(res.data); })
      .catch(() => {})
      .finally(() => setTimeout(() => setIsLoading(false), 300));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  const rd = data.revenueData || [];
  const momPct = rd.length >= 2 && rd[rd.length - 2].revenue > 0
    ? Math.round(((rd[rd.length - 1].revenue - rd[rd.length - 2].revenue) / rd[rd.length - 2].revenue) * 100)
    : null;

  const col = (k: string) => board.find((c) => c.key === k) || { key: k, count: 0, totalValue: 0, leads: [] };
  const pipeline = [
    { label: "New Leads", data: col("New"), won: false },
    { label: "Site Visit", data: col("Site Visit"), won: false },
    { label: "Quoted", data: col("Quotation"), won: false },
    { label: "Won / Closed", data: col("Won"), won: true },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Greeting */}
      <div className="flex flex-wrap items-start justify-between gap-4 animate-in fade-in slide-in-from-top-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {greeting}, {name} <span className="animate-pulse">👋</span>
          </h1>
          <p className="font-script text-base sm:text-lg text-muted-foreground mt-1">“{quote}”</p>
        </div>
        <Button asChild size="lg"><Link to="/leads"><Plus className="w-4 h-4" /> New Lead</Link></Button>
      </div>

      {/* Main layout: content + right rail */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Featured — Total Leads */}
            <Link to="/leads" className="rounded-[14px] p-5 text-white shadow-md relative overflow-hidden block transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" style={{ background: "linear-gradient(155deg, #06452F 0%, #003522 60%, #012316 100%)" }}>
              <div className="flex items-start justify-between">
                <span className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center"><Target className="w-5 h-5 text-gold" /></span>
              </div>
              <p className="text-sm text-[#B8CEC3] mt-4">Total Leads</p>
              <p className="text-3xl font-bold tabular-nums mt-1">{data.totalLeads.toLocaleString("en-IN")}</p>
              <div className="mt-3"><MiniBars data={(data.leadPipeline || []).map((p) => p.value)} /></div>
            </Link>

            <KpiCard to="/projects" title="Active Projects" value={data.activeProjects.toLocaleString("en-IN")} icon={FolderKanban} subtitle="In progress"
              chart={<Sparkline data={(data.activeProjectProgress || []).map((p) => p.progress)} color="#2F8F65" />} />

            <KpiCard to="/finance" title="Monthly Revenue" value={compactINR(data.totalRevenue)} icon={IndianRupee}
              subtitle={momPct !== null ? "vs last month" : "This month"} trend={momPct}
              chart={<Sparkline data={rd.map((r) => r.revenue)} color="#BC8748" />} />

            <KpiCard to="/customers" title="Total Customers" value={data.totalCustomers.toLocaleString("en-IN")} icon={Users} subtitle="All time"
              chart={<Sparkline data={(data.leadPipeline || []).map((p) => p.value)} color="#4779A8" />} />
          </div>

          {/* Lead Pipeline */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg">Lead Pipeline</CardTitle>
              <Link to="/leads" className="text-sm font-medium text-primary hover:text-gold inline-flex items-center gap-1">View All <ArrowRight className="w-4 h-4" /></Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {pipeline.map((c) => (
                  <div key={c.label} className={`rounded-xl p-3 ${c.won ? "bg-secondary" : "bg-muted/60"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-foreground">{c.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.won ? "bg-success/15 text-success" : "bg-gold/20 text-gold-dark"}`} style={c.won ? {} : { color: "#6D512A" }}>{c.data.count}</span>
                    </div>
                    <div className="space-y-2">
                      {c.data.leads.slice(0, 2).map((l) => (
                        <Link key={l.id} to={`/leads/${l.id}`} className="block bg-card rounded-lg border border-border p-3 hover:shadow-sm hover:border-gold/40 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">{l.name}</span>
                            {c.won && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success shrink-0">Won</span>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{[l.leadType, l.city].filter(Boolean).join(" · ")}</p>
                          <p className="text-sm font-bold text-primary mt-1.5">{formatINR(l.estimatedBudget)}</p>
                        </Link>
                      ))}
                      {c.data.leads.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No leads</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Quick Actions — dark forest panel */}
          <div className="rounded-[14px] p-5 shadow-md text-white" style={{ background: "linear-gradient(160deg, #003522 0%, #012316 100%)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Quick Actions</h3>
              <Sparkles className="w-4 h-4 text-gold" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {QUICK_ACTIONS.map((a) => (
                <Link key={a.label} to={a.to} className="flex flex-col items-center justify-center gap-2 rounded-xl p-3 bg-white/[0.06] border border-white/10 hover:bg-gold/15 hover:border-gold/30 transition-colors text-center">
                  <a.icon className="w-5 h-5 text-gold" />
                  <span className="text-xs font-medium text-[#E9EFEB]">{a.label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-center">
              <p className="font-script text-sm text-[#F0D19B]">“Design is not just what it looks like, it's how it works.”</p>
            </div>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-gold" /> Recent Activity</CardTitle>
              <Link to="/notifications" className="text-xs font-medium text-primary hover:text-gold">View All</Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {buildActivity(data).map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${a.tint}`}><a.icon className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.subtitle}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row: projects · tasks · calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ongoing Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Ongoing Projects</CardTitle>
            <Link to="/projects" className="text-xs font-medium text-primary hover:text-gold">View All</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {(data.activeProjectProgress || []).slice(0, 4).map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-3 group">
                <span className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#E8F3EE,#F8EACF)" }}><FolderKanban className="w-5 h-5 text-primary" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary">{p.name}</span>
                    <span className="text-xs font-bold text-primary tabular-nums">{p.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1.5">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.progress}%`, background: "linear-gradient(90deg,#0A573B,#2F8F65)" }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Due {new Date(p.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                </div>
              </Link>
            ))}
            {(data.activeProjectProgress || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No active projects.</p>}
          </CardContent>
        </Card>

        {/* Team Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Team Tasks</CardTitle>
            <Link to="/tasks" className="text-xs font-medium text-primary hover:text-gold">View All</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.todaysTasks || []).slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {(t.priority || "T").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.priority}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TASK_STATUS_BADGE[t.status] || "bg-muted text-muted-foreground"}`}>
                  {TASK_STATUS_LABEL[t.status] || t.status}
                </span>
              </div>
            ))}
            {(data.todaysTasks || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground/40" /><p className="text-sm">You're all caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar */}
        <MiniCalendar tasks={data.todaysTasks || []} />
      </div>

      {/* Footer strip */}
      <div className="rounded-[14px] border border-border px-5 py-4 flex flex-wrap items-center justify-between gap-4" style={{ background: "linear-gradient(90deg,#FCFBF8,#F8EACF55)" }}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <FooterStat icon={Users} value={`${data.totalCustomers.toLocaleString("en-IN")}`} label="Customers" />
          <FooterStat icon={FolderKanban} value={`${data.activeProjects.toLocaleString("en-IN")}`} label="Active Projects" />
          <FooterStat icon={Target} value={`${data.totalLeads.toLocaleString("en-IN")}`} label="Leads" />
          <FooterStat icon={CheckCircle2} value={`${data.pendingTasks.toLocaleString("en-IN")}`} label="Open Tasks" />
        </div>
        <p className="font-script text-lg text-gold-dark">Together We Build Better Spaces</p>
      </div>

      {isLoading && <span className="sr-only">Loading dashboard…</span>}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
function KpiCard({ title, value, icon: Icon, subtitle, trend, chart, to }: {
  title: string; value: string; icon: typeof Users; subtitle?: string; trend?: number | null; chart?: React.ReactNode; to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-foreground truncate">{value}</p>
        </div>
        <span className="w-11 h-11 rounded-xl bg-gold/12 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-gold" /></span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {trend !== undefined && trend !== null && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${trend >= 0 ? "text-success" : "text-destructive"}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(trend)}%
            </span>
          )}
          {subtitle}
        </p>
        {chart && <div className="w-24 shrink-0">{chart}</div>}
      </div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="rounded-[14px] border border-border bg-card text-card-foreground shadow-sm p-5 block transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
        {body}
      </Link>
    );
  }
  return <Card className="p-5">{body}</Card>;
}

function FooterStat({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-full bg-gold/12 flex items-center justify-center"><Icon className="w-4 h-4 text-gold-dark" /></span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function MiniCalendar({ tasks }: { tasks: DashboardSummary["todaysTasks"] }) {
  const today = new Date();
  const [view] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = view.getFullYear(), month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-gold" /> {view.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</CardTitle>
        <div className="flex gap-1 text-muted-foreground">
          <span className="p-1 rounded hover:bg-accent"><ChevronLeft className="w-4 h-4" /></span>
          <span className="p-1 rounded hover:bg-accent"><ChevronRight className="w-4 h-4" /></span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => <div key={d} className="text-[10px] font-semibold text-muted-foreground py-1">{d}</div>)}
          {cells.map((d, i) => (
            <div key={i} className="aspect-square flex items-center justify-center">
              {d && (
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs tabular-nums ${isToday(d) ? "bg-primary text-primary-foreground font-bold" : "text-foreground hover:bg-accent"}`}>{d}</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          {tasks.slice(0, 3).map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
              <span className="text-muted-foreground truncate flex-1">{t.title}</span>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No events today.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/* Build a real activity feed from whatever the summary provides. */
function buildActivity(data: DashboardSummary) {
  const items: { icon: typeof Users; tint: string; title: string; subtitle: string }[] = [];
  (data.recentCustomers || []).slice(0, 2).forEach((c) =>
    items.push({ icon: UserPlus, tint: "bg-success/12 text-success", title: "New customer added", subtitle: `${c.name}${c.company ? " · " + c.company : ""}` }));
  (data.todaysFollowUps || []).slice(0, 1).forEach((f) =>
    items.push({ icon: FileText, tint: "bg-gold/15 text-gold-dark", title: "Follow-up due", subtitle: `${f.customerName} · ${f.status}` }));
  (data.todaysTasks || []).slice(0, 2).forEach((t) =>
    items.push({ icon: MapPin, tint: "bg-info/12 text-info", title: t.title, subtitle: t.priority || t.status }));
  return items.slice(0, 5);
}

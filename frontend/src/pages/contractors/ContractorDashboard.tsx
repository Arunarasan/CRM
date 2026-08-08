import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type {
  ContractorDashboard as Dashboard, ContractorDailyProgress, ContractorQualityInspection, Contractor,
} from "@/types/contractor";
import { WP_STATUS_TONE, QC_RESULT_TONE } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import {
  Users, PackageOpen, AlertTriangle, Receipt, Wallet, HardHat, ShieldAlert, PiggyBank, CalendarClock,
} from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function ContractorDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [today, setToday] = useState<ContractorDailyProgress[]>([]);
  const [qualityIssues, setQualityIssues] = useState<ContractorQualityInspection[]>([]);
  const [expiring, setExpiring] = useState<Contractor[]>([]);

  useEffect(() => {
    contractorApi.getDashboard().then(setData).catch(console.error);
    contractorApi.getTodaysProgress().then(setToday).catch(() => {});
    contractorApi.getOpenQualityIssues().then(setQualityIssues).catch(() => {});
    contractorApi.getComplianceAlerts().then((a) => setExpiring(a.contractors ?? [])).catch(() => {});
  }, []);

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading contractor dashboard…</div>;

  const tiles = [
    { label: "Total Contractors", value: data.totalContractors, icon: Users, to: "/contractors/directory", tone: "bg-slate-100 text-slate-600" },
    { label: "Active Work Packages", value: data.activeWorkPackages, icon: PackageOpen, to: "/contractors/work-packages?status=IN_PROGRESS", tone: "bg-cyan-50 text-cyan-600" },
    { label: "Delayed Packages", value: data.delayedWorkPackages, icon: AlertTriangle, to: "/contractors/reports", tone: "bg-rose-50 text-rose-600" },
    { label: "Pending Bills", value: data.pendingBills, icon: Receipt, to: "/contractors/bills?status=SUBMITTED", tone: "bg-amber-50 text-amber-600" },
    { label: "Pending Payments", value: currency(data.pendingPaymentValue), icon: Wallet, to: "/contractors/payments", tone: "bg-indigo-50 text-indigo-600" },
    { label: "Today's Progress", value: data.todaysProgressReports, icon: HardHat, to: "/contractors/progress", tone: "bg-teal-50 text-teal-600" },
    { label: "Quality Issues", value: data.openQualityIssues, icon: ShieldAlert, to: "/contractors/quality", tone: "bg-orange-50 text-orange-600" },
    { label: "Retention Held", value: currency(data.retentionHeld), icon: PiggyBank, to: "/contractors/payments", tone: "bg-violet-50 text-violet-600" },
  ];

  const statuses = Object.entries(data.statusBreakdown ?? {});
  const trades = Object.entries(data.tradeBreakdown ?? {});
  const maxTrade = Math.max(1, ...trades.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${t.tone}`}>
              <t.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black text-slate-900">{t.value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">{t.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Work Packages by Status</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {statuses.length === 0 && <div className="text-sm text-muted-foreground">No work packages yet.</div>}
            {statuses.map(([status, count]) => (
              <Link key={status} to={`/contractors/work-packages?status=${status}`}>
                <Badge className={`${WP_STATUS_TONE[status] ?? "bg-slate-100 text-slate-700"} font-semibold`}>
                  {status.replace(/_/g, " ")} · {count}
                </Badge>
              </Link>
            ))}
          </div>
          <div className="px-4 pb-4 text-xs text-slate-500">
            {data.workersOnSiteToday} worker(s) on site today · {data.engagedContractors} contractor(s) engaged
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Work by Trade</h3>
          </div>
          <div className="p-4 space-y-2">
            {trades.length === 0 && <div className="text-sm text-muted-foreground">No trades assigned yet.</div>}
            {trades.map(([trade, count]) => (
              <div key={trade} className="flex items-center gap-3">
                <div className="w-32 text-xs font-semibold text-slate-600 truncate">{trade.replace(/_/g, " ")}</div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(count / maxTrade) * 100}%` }} />
                </div>
                <div className="w-6 text-right text-xs font-bold text-slate-700">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">Compliance Expiring</h3>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {expiring.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">All agreements and licences current.</div>
            )}
            {expiring.map((c) => (
              <Link key={c.id} to={`/contractors/directory/${c.id}`} className="p-3 block hover:bg-slate-50">
                <div className="font-bold text-sm text-slate-800">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.agreementEndDate && `Agreement ends ${c.agreementEndDate}`}
                  {c.insuranceExpiryDate && ` · Insurance ${c.insuranceExpiryDate}`}
                  {c.licenseExpiryDate && ` · Licence ${c.licenseExpiryDate}`}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
            <HardHat className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-sm">Today's Site Progress</h3>
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {today.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No progress reported today.</div>
            )}
            {today.map((p) => (
              <Link key={p.id} to={`/contractors/work-packages/${p.workPackage.id}`}
                    className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-800 truncate">{p.workPackage.packageName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.contractor?.name} · {p.workersCount ?? 0} workers · {p.workDone}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black text-slate-900">{p.completionPercentage}%</span>
                  <Badge className={p.status === "VERIFIED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                    {p.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h3 className="font-bold text-slate-800 text-sm">Open Quality Issues</h3>
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {qualityIssues.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No open quality issues.</div>
            )}
            {qualityIssues.map((q) => (
              <Link key={q.id} to={`/contractors/work-packages/${q.workPackage.id}`}
                    className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-800 truncate">
                    {q.inspectionNumber} · {q.workPackage.packageName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {q.contractor?.name} · {q.defects || q.observations || "—"}
                  </div>
                </div>
                <Badge className={QC_RESULT_TONE[q.result]}>{q.result}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

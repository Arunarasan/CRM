import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { inr } from "../workforce/WorkforceFinanceTab";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Row { paidCount?: number; pendingCount?: number; paidAmount?: number; pendingAmount?: number }
interface LeadItem { leadId: number; leadNumber?: string; name?: string; siteAddress?: string; hasLocation: boolean; amount: number; paid: boolean }
interface Detail { leads: Row; projects: Row; reviews: Row; paidTotal: number; pendingTotal: number; earnedTotal: number; leadItems: LeadItem[] }

const cnt = (r?: Row) => (r?.paidCount ?? 0) + (r?.pendingCount ?? 0);
const amt = (r?: Row) => (r?.paidAmount ?? 0) + (r?.pendingAmount ?? 0);

/** Admin view of what an employee earned in a month: leads collected (with each lead), projects, reviews. */
export default function EmployeeIncentivesCard({ employeeId }: { employeeId: number }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    api.get(`/hr/employees/${employeeId}/rewards`, { params: { month, year } })
      .then((r) => setD(r.data)).catch(() => setD(null));
  }, [employeeId, month, year]);

  const tiles: [string, Row | undefined][] = [["Leads collected", d?.leads], ["Projects completed", d?.projects], ["Google reviews", d?.reviews]];

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800">Incentives earned</h3>
          <p className="text-xs text-slate-500">Total {inr(d?.earnedTotal)} · paid {inr(d?.paidTotal)} · pending {inr(d?.pendingTotal)}</p>
        </div>
        <div className="flex gap-2">
          <select className="h-9 rounded-md border bg-white px-2 text-sm font-semibold" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-white px-2 text-sm font-semibold" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[0, 1, 2].map((o) => <option key={o} value={now.getFullYear() - o}>{now.getFullYear() - o}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map(([label, r]) => (
          <div key={label} className="rounded-xl bg-amber-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{label}</p>
            <p className="text-lg font-bold tabular-nums text-amber-900">{inr(amt(r))}</p>
            <p className="text-xs text-amber-700/80">× {cnt(r)}{(r?.pendingAmount ?? 0) > 0 ? ` · ${inr(r?.pendingAmount)} pending` : ""}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Leads collected in {MONTHS[month - 1]}</p>
        {!d?.leadItems?.length
          ? <p className="py-3 text-sm text-slate-500">No qualified leads this month.</p>
          : <ul className="divide-y text-sm">
              {d.leadItems.map((l) => (
                <li key={l.leadId} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link to={`/leads/${l.leadId}`} className="font-medium text-primary hover:underline">{l.name || l.leadNumber || `Lead #${l.leadId}`}</Link>
                    <p className="truncate text-xs text-slate-500">{l.leadNumber}{l.siteAddress ? ` · ${l.siteAddress}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">{inr(l.amount)}</p>
                    <p className={`text-xs ${l.paid ? "text-emerald-600" : "text-amber-600"}`}>{l.paid ? "Paid" : "Pending"}</p>
                  </div>
                </li>
              ))}
            </ul>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeIndianRupee, CalendarClock, CheckCircle2, ClipboardList, Clock, Gift, HandCoins,
  Palmtree, ShieldCheck, Users,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MONTHS, PersonChip } from "./hrUi";
import WorkforceDirectoryPage from "./WorkforceDirectoryPage";

interface Overview {
  today: {
    date: string; staff: number; present: number; onLeave: number; notIn: number;
    notInPeople: { id: number; name: string; code?: string; designation?: string }[];
  };
  waiting: {
    punches: number; corrections: number; leave: number; profileChanges: number;
    dailyReports: number; moneyRequests: number; bonuses: number;
  };
  payroll: {
    month: number; year: number; payrollStaff: number; made: number;
    toApprove: number; toPay: number; paid: number; netPayout: number;
  };
}

/**
 * HR & Payroll landing page — what HR needs at the start of the day: what's waiting for them,
 * who's in today, and where this month's payroll stands. Every item links to the page that
 * handles it. People without HR rights land on the directory instead.
 */
export default function WorkforceHome() {
  const { authorities, hasAuthority } = useAuth();
  const canSeeHr = authorities.length === 0 || hasAuthority("PAYROLL_READ");
  if (!canSeeHr) return <WorkforceDirectoryPage />;
  return <Home />;
}

function Home() {
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = () => {
    setError(false);
    api.get<Overview>("/hr/overview").then((r) => setO(r.data)).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="font-medium text-slate-900">Couldn't load the HR overview.</p>
        <p className="mt-1 text-sm text-slate-500">Check your connection and try again. Nothing has changed.</p>
        <Button className="mt-3" variant="outline" onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!o) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" />
      </div>
    );
  }

  const w = o.waiting;
  const tasks = [
    { n: w.punches, label: "Field punches to approve", hint: "Not paid until approved", to: "/workforce/attendance", icon: Clock },
    { n: w.corrections, label: "Time corrections to check", to: "/workforce/attendance", icon: CalendarClock },
    { n: w.leave, label: "Leave requests", to: "/workforce/leave", icon: Palmtree },
    { n: w.moneyRequests, label: "Borrow / repay requests", to: "/workforce/payroll?tab=requests", icon: HandCoins },
    { n: w.bonuses, label: "Bonuses to approve", to: "/workforce/payroll?tab=adjustments", icon: Gift },
    { n: w.profileChanges, label: "Profile changes to approve", to: "/workforce/approvals", icon: ShieldCheck },
    { n: w.dailyReports, label: "Daily reports to review", to: "/workforce/daily-reports", icon: ClipboardList },
  ].filter((t) => Number(t.n) > 0);

  const t = o.today;
  const p = o.payroll;
  const people = showAll ? t.notInPeople : t.notInPeople.slice(0, 8);
  const date = new Date(t.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ---- Waiting for you — the day's to-do list ---- */}
      <section className="rounded-xl border bg-card shadow-sm lg:col-span-2">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-slate-900">Waiting for you</h2>
          {tasks.length > 0 && <span className="text-xs text-slate-500">{tasks.reduce((a, x) => a + Number(x.n), 0)} items</span>}
        </header>
        {tasks.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-8">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-slate-900">All caught up</p>
              <p className="text-sm text-slate-500">No approvals, requests or reports are waiting.</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {tasks.map((x) => (
              <li key={x.label}>
                <Link to={x.to} className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><x.icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{x.label}</span>
                    {x.hint && <span className="block text-xs text-slate-500">{x.hint}</span>}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-amber-900">{x.n}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-700" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Today ---- */}
      <section className="rounded-xl border bg-card shadow-sm lg:row-span-2">
        <header className="border-b px-4 py-3">
          <h2 className="font-semibold text-slate-900">Today</h2>
          <p className="text-xs text-slate-500">{date}</p>
        </header>
        <div className="grid grid-cols-3 divide-x border-b text-center">
          <Stat label="In" value={t.present} of={t.staff} tone="text-emerald-700" />
          <Stat label="On leave" value={t.onLeave} tone="text-sky-700" />
          <Stat label="Not in yet" value={t.notIn} tone={t.notIn > 0 ? "text-amber-700" : "text-slate-900"} />
        </div>
        <div className="px-4 py-3">
          {t.notIn === 0 ? (
            <p className="text-sm text-slate-500">Everyone is in or on leave.</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium text-slate-500">Not checked in yet</p>
              <ul className="space-y-2">
                {people.map((x) => (
                  <li key={x.id}><PersonChip name={x.name} sub={[x.code, x.designation].filter(Boolean).join(" · ")} to={`/hr/employees/${x.id}`} size="sm" /></li>
                ))}
              </ul>
              {t.notInPeople.length > 8 && (
                <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 text-xs font-semibold text-primary hover:underline">
                  {showAll ? "Show fewer" : `Show all ${t.notInPeople.length}${t.notIn > t.notInPeople.length ? ` of ${t.notIn}` : ""}`}
                </button>
              )}
            </>
          )}
          <Link to="/workforce/attendance" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Attendance <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ---- This month's payroll ---- */}
      <section className="rounded-xl border bg-card shadow-sm lg:col-span-2">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-slate-900">Payroll · {MONTHS[p.month - 1]} {p.year}</h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/workforce/payroll"><BadgeIndianRupee className="mr-1 h-4 w-4" /> Open pay run</Link>
          </Button>
        </header>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
          <Cell label="Payslips made" value={`${p.made} of ${p.payrollStaff}`} />
          <Cell label="To approve" value={p.toApprove} warn={p.toApprove > 0} />
          <Cell label="To pay" value={p.toPay} warn={p.toPay > 0} />
          <Cell label="Paid" value={p.paid} />
        </div>
        <p className="px-4 py-3 text-sm text-slate-500">
          Net pay on payslips made so far <b className="tabular-nums text-slate-900">{inr(p.netPayout)}</b>
        </p>
      </section>

      {/* ---- Shortcuts ---- */}
      <section className="flex flex-wrap gap-2 lg:col-span-2">
        <Button asChild variant="outline" size="sm"><Link to="/workforce/people"><Users className="mr-1 h-4 w-4" /> Directory</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/workforce/leave"><Palmtree className="mr-1 h-4 w-4" /> Leave</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/workforce/daily-reports"><ClipboardList className="mr-1 h-4 w-4" /> Daily reports</Link></Button>
      </section>
    </div>
  );
}

function Stat({ label, value, of, tone }: { label: string; value: number; of?: number; tone: string }) {
  return (
    <div className="px-2 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}{of != null && <span className="text-sm font-normal text-slate-400"> / {of}</span>}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Cell({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

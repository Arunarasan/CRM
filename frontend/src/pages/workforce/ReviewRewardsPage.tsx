import { BaseInput } from '@/components/ui/input';
import { useEffect, useMemo, useState } from "react";
import {
  Star, BadgeCheck, RefreshCw, HandCoins, CheckCircle2, XCircle, Search, Award, AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface RewardRow {
  id: number;
  employeeId: number | null;
  employeeName: string;
  designation?: string;
  reviewerName?: string;
  reviewerPhone?: string;
  rating: number;
  comment?: string;
  createdAt?: string;
  googleVerified: boolean;
  googleVerifiedAt?: string;
  googleReviewId?: string;
  rewardPaid: boolean;
  rewardAmount?: number;
}
interface EmpTally {
  employeeId: number;
  employeeName: string;
  designation?: string;
  totalReviews: number;
  verifiedCount: number;
  rewardedCount: number;
  rewardDue: number;
  rewardPaid: number;
}
interface Board {
  rewardAmount: number;
  rows: RewardRow[];
  byEmployee: EmpTally[];
}

const inr = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const Stars = ({ n }: { n: number }) => (
  <div className="flex">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${n >= i ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
    ))}
  </div>
);

type Filter = "all" | "toVerify" | "verified" | "paid";

/**
 * Google-review rewards. Verify which employee's QR produced a real Google review (manually, or via
 * the Business Profile auto-match), then pay the reward — it flows into the employee's payroll as an
 * incentive. See EmployeeReviewService / GoogleBusinessReviewService.
 */
export default function ReviewRewardsPage() {
  const { hasAuthority, authorities } = useAuth();
  const legacy = authorities.length === 0;
  const canPay = legacy || hasAuthority("ROLE_ADMIN") || hasAuthority("PAYROLL_PROCESS") || hasAuthority("PAYROLL_WRITE");

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [countSyncing, setCountSyncing] = useState(false);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [countStatus, setCountStatus] = useState<any>(null);

  const loadStatus = () =>
    api.get("/hr/review-rewards/count-status").then((res) => setCountStatus(res.data)).catch(() => {});

  const load = () => {
    setLoading(true);
    api.get("/hr/review-rewards")
      .then((res) => setBoard(res.data))
      .catch(() => toast.error("Could not load review rewards"))
      .finally(() => setLoading(false));
    loadStatus();
  };
  useEffect(load, []);

  const syncCount = () => {
    setCountSyncing(true);
    api.post("/hr/review-rewards/sync-count")
      .then((res) => {
        const d = res.data;
        if (!d.configured) { toast.error(d.message || "Google Places is not connected."); return; }
        if (d.baselineSet) toast.success(`Baseline set at ${d.currentTotal} Google reviews. New reviews from now on will auto-verify.`);
        else if (d.autoVerified > 0) toast.success(`Google reviews +${d.delta} → auto-verified ${d.autoVerified} pending`);
        else toast.success(`Synced — Google total ${d.currentTotal}, no new reviews to verify`);
        load();
      })
      .catch(() => toast.error("Count sync failed"))
      .finally(() => setCountSyncing(false));
  };

  const verify = (r: RewardRow, googleReviewId?: string) =>
    api.post(`/hr/reviews/${r.id}/verify`, { googleReviewId })
      .then(() => { toast.success("Marked as verified"); load(); })
      .catch(() => toast.error("Could not verify"));

  const unverify = (r: RewardRow) =>
    api.post(`/hr/reviews/${r.id}/unverify`)
      .then(() => { toast.success("Verification removed"); load(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Could not un-verify"));

  const payReward = (r: RewardRow) => {
    if (!confirm(`Pay ${inr(board?.rewardAmount)} reward to ${r.employeeName}? It will be added to their payslip as an incentive.`)) return;
    api.post(`/hr/reviews/${r.id}/pay-reward`)
      .then(() => { toast.success("Reward added to payroll"); load(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Could not pay reward"));
  };

  const syncGoogle = () => {
    setSyncing(true);
    api.post("/hr/review-rewards/sync-google")
      .then((res) => {
        const d = res.data;
        if (!d.configured) { toast.error(d.message || "Google Business Profile is not connected."); setSuggestions([]); return; }
        setSuggestions(d.suggestions || []);
        toast.success(`Found ${d.googleReviewCount ?? 0} Google reviews · ${(d.suggestions || []).length} match(es) to confirm`);
      })
      .catch(() => toast.error("Google sync failed"))
      .finally(() => setSyncing(false));
  };

  const rows = useMemo(() => {
    let xs = board?.rows || [];
    if (filter === "toVerify") xs = xs.filter((r) => !r.googleVerified);
    else if (filter === "verified") xs = xs.filter((r) => r.googleVerified && !r.rewardPaid);
    else if (filter === "paid") xs = xs.filter((r) => r.rewardPaid);
    const term = q.trim().toLowerCase();
    if (term) xs = xs.filter((r) =>
      [r.employeeName, r.reviewerName, r.reviewerPhone].filter(Boolean).some((v) => v!.toLowerCase().includes(term)));
    return xs;
  }, [board, filter, q]);

  if (loading) return <div className="py-16 text-center text-sm text-slate-400">Loading…</div>;

  const rewardAmount = board?.rewardAmount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Award className="w-5 h-5 text-amber-500" /> Google Review Rewards
          </h2>
          <p className="text-sm text-slate-500">
            Verify which employee earned each Google review, then pay the reward into their payroll.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={syncCount} disabled={countSyncing} className="rounded-xl">
            <RefreshCw className={`w-4 h-4 mr-2 ${countSyncing ? "animate-spin" : ""}`} /> Sync Google count
          </Button>
          <Button onClick={syncGoogle} disabled={syncing} variant="outline" className="rounded-xl">
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} /> Match by name
          </Button>
        </div>
      </div>

      {/* Count-sync status */}
      {countStatus && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border bg-white px-4 py-3 text-sm">
          {!countStatus.configured ? (
            <span className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" /> Auto-verify by Google count is not connected (needs a Places API key + place id in backend config).
            </span>
          ) : (
            <>
              <span className="text-slate-600">Google total: <b className="text-slate-900">{countStatus.lastTotal ?? "—"}</b></span>
              <span className="text-slate-600">Baseline: <b className="text-slate-900">{countStatus.baseline ?? "—"}</b></span>
              <span className="text-slate-600">Awaiting confirmation: <b className="text-amber-600">{countStatus.pending ?? 0}</b></span>
              {countStatus.lastSyncedAt && (
                <span className="text-slate-400 text-xs">last synced {format(new Date(countStatus.lastSyncedAt), "MMM d, h:mm a")}</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Reward amount banner */}
      {rewardAmount <= 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>No reward amount set. Set <b>Reward per Google Review</b> under <b>Website → Settings</b> before paying rewards.</span>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Reward per verified Google review: <b>{inr(rewardAmount)}</b>
        </div>
      )}

      {/* Google auto-match suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
          <h3 className="mb-2 text-sm font-bold text-slate-800">Suggested Google matches — confirm to verify</h3>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                <span>
                  <b>{s.employeeName}</b> — captured “{s.ourReviewerName}” ↔ Google “{s.googleReviewerName}”
                  {s.googleStars ? ` · ${s.googleStars}★` : ""}
                  <span className={`ml-2 text-xs font-semibold ${s.confidence === "HIGH" ? "text-emerald-600" : "text-amber-600"}`}>{s.confidence}</span>
                </span>
                <Button size="sm" className="rounded-lg"
                  onClick={() => verify({ id: s.reviewId } as RewardRow, s.googleReviewId)}>
                  <BadgeCheck className="w-3.5 h-3.5 mr-1.5" /> Confirm
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-employee tally */}
      {board && board.byEmployee.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {board.byEmployee.map((e) => (
            <div key={e.employeeId} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-800">{e.employeeName}</div>
                <span className="text-xs text-slate-400">{e.totalReviews} scans</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-black text-emerald-600">{e.verifiedCount}</div><div className="text-[11px] text-slate-500">Verified</div></div>
                <div><div className="text-lg font-black text-amber-600">{inr(e.rewardDue)}</div><div className="text-[11px] text-slate-500">Due</div></div>
                <div><div className="text-lg font-black text-slate-700">{inr(e.rewardPaid)}</div><div className="text-[11px] text-slate-500">Paid</div></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        {([["all", "All"], ["toVerify", "To verify"], ["verified", "Verified · unpaid"], ["paid", "Rewarded"]] as [Filter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === f ? "bg-primary text-primary-foreground" : "bg-white border text-slate-600"}`}>
            {label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <BaseInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / phone…"
            className="rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm" />
        </div>
      </div>

      {/* Rows */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No reviews here yet.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Stars n={r.rating} />
                    <span className="text-sm font-semibold text-slate-800 truncate">{r.reviewerName || "Anonymous"}</span>
                    {r.reviewerPhone && <span className="text-xs text-slate-400">{r.reviewerPhone}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    for <b className="text-slate-700">{r.employeeName}</b>
                    {r.createdAt && <> · {format(new Date(r.createdAt), "MMM d, yyyy")}</>}
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{r.comment}</p>}
                </div>

                {/* Status */}
                <div className="shrink-0">
                  {r.rewardPaid ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      <HandCoins className="w-3.5 h-3.5" /> Rewarded {r.rewardAmount ? inr(r.rewardAmount) : ""}
                    </span>
                  ) : r.googleVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <BadgeCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Pending
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {!r.googleVerified && (
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => verify(r)}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verify
                    </Button>
                  )}
                  {r.googleVerified && !r.rewardPaid && (
                    <>
                      <button onClick={() => unverify(r)} title="Remove verification"
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                        <XCircle className="w-4 h-4" />
                      </button>
                      {canPay && (
                        <Button size="sm" className="rounded-lg" disabled={rewardAmount <= 0} onClick={() => payReward(r)}>
                          <HandCoins className="w-3.5 h-3.5 mr-1.5" /> Pay reward
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

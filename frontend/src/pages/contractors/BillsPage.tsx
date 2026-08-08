import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorBill } from "@/types/contractor";
import { BILL_STATUS_TONE } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STATUSES = [
  "", "DRAFT", "SUBMITTED", "ENGINEER_APPROVED", "PM_APPROVED", "FINANCE_APPROVED",
  "PARTIALLY_PAID", "PAID", "REJECTED",
];

export default function BillsPage() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<ContractorBill[]>([]);
  const [loading, setLoading] = useState(true);
  const view = params.get("view") ?? "all";
  const status = params.get("status") ?? "";

  const load = useCallback(() => {
    setLoading(true);
    const done = (r: ContractorBill[]) => { setRows(r); setLoading(false); };
    if (view === "pending") contractorApi.getBillsPendingApproval().then(done).catch(() => setLoading(false));
    else if (view === "payable") contractorApi.getPayableBills().then(done).catch(() => setLoading(false));
    else contractorApi.listBills({ status: status || undefined, size: 100 })
      .then((p) => done(p.content ?? []))
      .catch(() => setLoading(false));
  }, [view, status]);

  useEffect(() => { load(); }, [load]);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setParam("view", v === "all" ? "" : v)}>
          <TabsList>
            <TabsTrigger value="all">All bills</TabsTrigger>
            <TabsTrigger value="pending">Awaiting approval</TabsTrigger>
            <TabsTrigger value="payable">Ready to pay</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "all" && (
          <select className="h-10 rounded-md border bg-white px-3 text-sm" value={status}
                  onChange={(e) => setParam("status", e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <div className="text-sm text-muted-foreground">
          Approval ladder: Site Engineer → Project Manager → Finance
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="p-3 font-semibold">Bill</th>
                <th className="p-3 font-semibold">Contractor</th>
                <th className="p-3 font-semibold">Project · Package</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold text-right">Gross</th>
                <th className="p-3 font-semibold text-right">Net</th>
                <th className="p-3 font-semibold text-right">Balance</th>
                <th className="p-3 font-semibold">Stage</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No bills here. Raise one from a work package.
                </td></tr>
              )}
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/contractors/bills/${b.id}`} className="font-bold text-slate-800 hover:text-primary">
                      {b.billNumber}
                    </Link>
                    <div className="text-[11px] text-slate-400">{b.billDate}</div>
                  </td>
                  <td className="p-3">
                    <Link to={`/contractors/directory/${b.contractor.id}`} className="hover:text-primary">
                      {b.contractor.name}
                    </Link>
                  </td>
                  <td className="p-3 text-xs">
                    <div>{b.project?.projectName ?? "—"}</div>
                    <div className="text-muted-foreground">{b.workPackage?.packageCode ?? "—"}</div>
                  </td>
                  <td className="p-3">{b.billType}</td>
                  <td className="p-3 text-right">{currency(b.grossAmount)}</td>
                  <td className="p-3 text-right font-semibold">{currency(b.netAmount)}</td>
                  <td className="p-3 text-right">{currency(b.balanceAmount)}</td>
                  <td className="p-3 text-xs">{b.currentApprovalStage?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="p-3">
                    <Badge className={BILL_STATUS_TONE[b.status]}>{b.status.replace(/_/g, " ")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

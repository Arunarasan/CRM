import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import ContractorMoneyDialog from "./ContractorMoneyDialog";

const inr = (n?: number | null) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const label = (s?: string) => (s ?? "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

type Row = {
  id: number; paymentDate?: string; paymentType?: string; paymentMode?: string; referenceNumber?: string;
  transactionReference?: string; remarks?: string; amount: number; status?: string;
  direction?: "IN" | "OUT"; project?: { projectName?: string } | null; order?: { title?: string } | null; bill?: { id: number; billNumber?: string } | null;
};

/**
 * Two-sided money ledger for one contractor — what we paid him against what he paid us.
 *   We paid him      = every OUT payment (advances + bill payments)
 *   He paid us       = every IN receipt (refund / recovery / settlement)
 *   Net paid to him  = we paid − he paid back
 * Rows run oldest → newest with a running net, so the page reads like a passbook.
 * Shared by the contractor profile and the Workforce profile finance tab.
 */
export default function ContractorPaymentLedger({
  payments, contractorId, contractorName, canPay, owedBalance, onChanged,
}: {
  payments: Row[];
  contractorId: number;
  contractorName: string;
  canPay: boolean;
  /** Net ledger balance (+ we owe them, − they owe us), shown for context. */
  owedBalance?: number;
  onChanged: () => void;
}) {
  const [money, setMoney] = useState<"IN" | "OUT" | null>(null);

  const { rows, paid, received } = useMemo(() => {
    const live = payments.filter((p) => (p.status ?? "PAID") === "PAID");
    const sorted = [...live].sort((a, b) =>
      (a.paymentDate ?? "").localeCompare(b.paymentDate ?? "") || a.id - b.id);
    let running = 0, paidT = 0, recT = 0;
    const out = sorted.map((p) => {
      const incoming = p.direction === "IN";
      running += incoming ? -p.amount : p.amount;
      if (incoming) recT += p.amount; else paidT += p.amount;
      return { p, incoming, running };
    });
    return { rows: out, paid: paidT, received: recT };
  }, [payments]);

  const net = paid - received;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 min-w-[280px]">
          <Tile tone="rose" label="We paid him" value={inr(paid)} hint="advances + bill payments" />
          <Tile tone="emerald" label="He paid us" value={inr(received)} hint="refunds, recoveries, settlements" />
          <Tile tone={net >= 0 ? "slate" : "emerald"} label={net >= 0 ? "Net paid to him" : "Net received from him"}
            value={inr(Math.abs(net))}
            hint={owedBalance == null ? undefined
              : owedBalance < 0 ? `He owes us ${inr(-owedBalance)}` : `We still owe ${inr(owedBalance)}`} />
        </div>
        {canPay && (
          <div className="flex gap-2">
            <Button onClick={() => setMoney("OUT")}><ArrowUpRight className="w-4 h-4 mr-1" />Pay him</Button>
            <Button variant="outline" onClick={() => setMoney("IN")}><ArrowDownLeft className="w-4 h-4 mr-1" />He paid us</Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="text-left">
              <th className="p-3 font-semibold">Date</th>
              <th className="p-3 font-semibold">Particulars</th>
              <th className="p-3 font-semibold text-right">We paid him</th>
              <th className="p-3 font-semibold text-right">He paid us</th>
              <th className="p-3 font-semibold text-right">Net paid so far</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No payments either way yet.</td></tr>
            )}
            {rows.map(({ p, incoming, running }) => {
              const ref = p.referenceNumber || p.transactionReference;
              return (
                <tr key={p.id} className="hover:bg-slate-50 align-top">
                  <td className="p-3 whitespace-nowrap text-slate-600">{p.paymentDate ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800">{label(p.paymentType)}</span>
                      <Badge className={incoming ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                        {incoming ? "Received" : "Paid"}
                      </Badge>
                    </div>
                    {(p.project?.projectName || p.order?.title) && (
                      <div className="text-xs font-medium text-slate-700 mt-0.5">
                        {[p.project?.projectName, p.order?.title].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {[p.paymentMode && label(p.paymentMode), ref && `Ref ${ref}`, p.remarks].filter(Boolean).join(" · ") || "—"}
                      {p.bill && (
                        <> · <Link to={`/contractors/bills/${p.bill.id}`} className="text-primary hover:underline">{p.bill.billNumber ?? "Bill"}</Link></>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right font-semibold text-rose-700">{incoming ? "" : inr(p.amount)}</td>
                  <td className="p-3 text-right font-semibold text-emerald-700">{incoming ? inr(p.amount) : ""}</td>
                  <td className="p-3 text-right font-semibold text-slate-800">{inr(running)}</td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-50 font-bold border-t-2">
              <tr>
                <td className="p-3" colSpan={2}>Total</td>
                <td className="p-3 text-right text-rose-700">{inr(paid)}</td>
                <td className="p-3 text-right text-emerald-700">{inr(received)}</td>
                <td className="p-3 text-right">{inr(net)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {money && (
        <ContractorMoneyDialog open onClose={() => setMoney(null)} direction={money}
          contractorId={contractorId} contractorName={contractorName} onDone={onChanged} />
      )}
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "rose" | "emerald" | "slate" }) {
  const cls = { rose: "bg-rose-50 border-rose-200", emerald: "bg-emerald-50 border-emerald-200", slate: "bg-white" }[tone];
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="text-xl font-black text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

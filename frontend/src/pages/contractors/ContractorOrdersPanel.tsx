import { useCallback, useEffect, useMemo, useState } from "react";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorOrderRow, ContractorOrders, ContractorPayment, OrderStatus } from "@/types/contractor";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, XCircle } from "lucide-react";
import ContractorOrderDialog from "./ContractorOrderDialog";
import ContractorMoneyDialog from "./ContractorMoneyDialog";
import ContractorPaymentLedger from "./ContractorPaymentLedger";

const inr = (n?: number | null) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  UNPAID: { label: "Unpaid", cls: "bg-rose-100 text-rose-700" },
  PARTLY_PAID: { label: "Partly paid", cls: "bg-amber-100 text-amber-800" },
  PAID: { label: "Paid", cls: "bg-emerald-100 text-emerald-700" },
  OVERPAID: { label: "Overpaid", cls: "bg-violet-100 text-violet-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-200 text-slate-600" },
};
const FILTERS: { key: "ALL" | OrderStatus; label: string }[] = [
  { key: "ALL", label: "All" }, { key: "UNPAID", label: "Unpaid" },
  { key: "PARTLY_PAID", label: "Partly paid" }, { key: "PAID", label: "Paid" },
];

/**
 * A contractor treated like a customer in reverse: we give him orders (a job on a project with an agreed
 * amount), and this panel shows what is paid / still to pay on each, the passbook of money either way,
 * and — at the top — the single final figure: who needs to pay whom.
 */
export default function ContractorOrdersPanel({
  contractorId, contractorName, payments, canPay, onChanged,
}: {
  contractorId: number;
  contractorName: string;
  payments: ContractorPayment[];
  canPay: boolean;
  /** Reload whatever holds `payments` (the profile) after money or orders change. */
  onChanged: () => void;
}) {
  const [data, setData] = useState<ContractorOrders | null>(null);
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [editing, setEditing] = useState<ContractorOrderRow | "new" | null>(null);
  const [money, setMoney] = useState<{ dir: "IN" | "OUT"; orderId: number } | null>(null);

  const load = useCallback(() => {
    contractorApi.getOrders(contractorId).then(setData).catch(console.error);
  }, [contractorId]);
  useEffect(load, [load]);

  const refresh = () => { load(); onChanged(); };

  const rows = useMemo(
    () => (data?.orders ?? []).filter((o) => filter === "ALL" || o.status === filter),
    [data, filter]);

  const cancel = async (o: ContractorOrderRow) => {
    if (!window.confirm(`Cancel the order "${o.title}"?`)) return;
    try { await contractorApi.cancelOrder(o.id); toast.success("Order cancelled"); refresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? "Could not cancel the order."); }
  };

  if (!data) return <div className="p-4 text-sm text-muted-foreground">Loading orders…</div>;

  const tone = data.finalDirection === "WE_PAY" ? "bg-amber-50 border-amber-300"
    : data.finalDirection === "HE_PAYS" ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200";
  const headline = data.finalDirection === "WE_PAY" ? `You need to pay him ${inr(data.finalAmount)}`
    : data.finalDirection === "HE_PAYS" ? `He needs to pay you ${inr(data.finalAmount)}`
    : "All settled — nothing due either way";

  return (
    <div className="space-y-5">
      {/* Final position */}
      <div className={`rounded-2xl border p-5 ${tone}`}>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final settlement</div>
        <div className="text-2xl md:text-3xl font-black text-slate-900 mt-1">{headline}</div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
          <Mini label="Orders given" value={inr(data.totalOrdered)} />
          <Mini label="You paid" value={inr(data.totalPaid)} />
          <Mini label="He paid back" value={inr(data.totalReceived)} />
        </div>
      </div>

      {/* Orders */}
      <div className="rounded-xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <div>
            <h3 className="font-bold text-slate-900">Orders given to {contractorName}</h3>
            <p className="text-xs text-slate-500">Each order is a job on a project — see what is paid and what is left.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border overflow-hidden text-xs">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 font-semibold ${filter === f.key ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {canPay && <Button onClick={() => setEditing("new")}><Plus className="w-4 h-4 mr-1" />Give order</Button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="p-3 font-semibold">Project</th>
                <th className="p-3 font-semibold">Job</th>
                <th className="p-3 font-semibold text-right">Order amount</th>
                <th className="p-3 font-semibold text-right">Paid</th>
                <th className="p-3 font-semibold text-right">Balance</th>
                <th className="p-3 font-semibold">Status</th>
                {canPay && <th className="p-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={canPay ? 7 : 6} className="p-8 text-center text-muted-foreground">
                  {data.orders.length === 0 ? "No orders given yet. Use “Give order” to add the first one." : "No orders in this filter."}
                </td></tr>
              )}
              {rows.map((o) => {
                const st = STATUS[o.status];
                const live = o.status !== "CANCELLED";
                return (
                  <tr key={o.id} className={`hover:bg-slate-50 align-top ${live ? "" : "opacity-60"}`}>
                    <td className="p-3 font-medium text-slate-800">{o.projectName || (o.bundleCode ? null : <span className="text-slate-400">General</span>)}
                      {o.bundleCode && <span className="block text-xs font-normal text-slate-500">Order {o.bundleCode}</span>}</td>
                    <td className="p-3">
                      <div>{o.title}</div>
                      <div className="text-xs text-slate-500">{o.orderDate ?? ""}{o.notes ? ` · ${o.notes}` : ""}</div>
                    </td>
                    <td className="p-3 text-right font-semibold">{inr(o.amount)}</td>
                    <td className="p-3 text-right text-rose-700 font-semibold">
                      {inr(o.paid)}
                      {o.received > 0 && <div className="text-xs font-medium text-emerald-700">+{inr(o.received)} back</div>}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">{inr(o.balance)}</td>
                    <td className="p-3"><Badge className={st.cls}>{st.label}</Badge></td>
                    {canPay && (
                      <td className="p-3 whitespace-nowrap text-right">
                        {live && (
                          <div className="flex justify-end gap-1.5">
                            {o.balance > 0 && (
                              <Button size="sm" onClick={() => setMoney({ dir: "OUT", orderId: o.id })}>
                                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />Pay
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => setMoney({ dir: "IN", orderId: o.id })}>
                              <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />He paid us
                            </Button>
                            <Button size="sm" variant="ghost" title="Edit order" onClick={() => setEditing(o)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {o.paid === 0 && o.received === 0 && (
                              <Button size="sm" variant="ghost" title="Cancel order" onClick={() => cancel(o)}>
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {data.orders.length > 0 && (
              <tfoot className="bg-slate-50 font-bold border-t-2">
                <tr>
                  <td className="p-3" colSpan={2}>Total (live orders)</td>
                  <td className="p-3 text-right">{inr(data.totalOrdered)}</td>
                  <td className="p-3 text-right text-rose-700">{inr(data.totalPaid)}</td>
                  <td className="p-3 text-right">{inr(data.totalBalance)}</td>
                  <td className="p-3" colSpan={canPay ? 2 : 1} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Passbook of money either way */}
      <ContractorPaymentLedger payments={payments} contractorId={contractorId} contractorName={contractorName}
        canPay={canPay} onChanged={refresh} />

      {editing && (
        <ContractorOrderDialog open onClose={() => setEditing(null)} contractorId={contractorId}
          contractorName={contractorName} existing={editing === "new" ? undefined : editing} onDone={refresh} />
      )}
      {money && (
        <ContractorMoneyDialog open onClose={() => setMoney(null)} direction={money.dir} orderId={money.orderId}
          contractorId={contractorId} contractorName={contractorName} onDone={refresh} />
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="text-base font-bold text-slate-900">{value}</div>
    </div>
  );
}

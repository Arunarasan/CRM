import { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import type { CustomerPayment, Refund, PageResp } from "@/types/finance";
import { PAYMENT_METHODS } from "@/types/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, PAYMENT_STATUS_TONE, REFUND_STATUS_TONE } from "./helpers";
import { Plus, Search, Check, X } from "lucide-react";
import CameraCaptureButton from "@/components/CameraCaptureButton";

type Tab = "all" | "pending" | "refunds";

export default function PaymentsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "all";

  const [payments, setPayments] = useState<PageResp<CustomerPayment> | null>(null);
  const [pending, setPending] = useState<CustomerPayment[]>([]);
  const [refunds, setRefunds] = useState<PageResp<Refund> | null>(null);
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [busy, setBusy] = useState(false);

  const [showRecord, setShowRecord] = useState(false);
  const [pCustomer, setPCustomer] = useState("");
  const [pAmount, setPAmount] = useState("");
  const [pMethod, setPMethod] = useState("UPI");
  const [pRef, setPRef] = useState("");
  const [pRemarks, setPRemarks] = useState("");
  const [pProofUrl, setPProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const [showRefund, setShowRefund] = useState(false);
  const [rCustomer, setRCustomer] = useState("");
  const [rAmount, setRAmount] = useState("");
  const [rReason, setRReason] = useState("");

  const load = useCallback(() => {
    financeApi.getPayments({ page, search, method, size: 15 }).then(setPayments).catch(console.error);
    financeApi.getPendingApprovalPayments().then(setPending).catch(console.error);
    financeApi.getRefunds(0, 30).then(setRefunds).catch(console.error);
  }, [page, search, method]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/customers").then((res) => setCustomers(res.data?.content ?? res.data ?? [])).catch(console.error);
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); load(); } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  const setTab = (t: Tab) => setParams(t === "all" ? {} : { tab: t });

  const uploadProof = async (file: File) => {
    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.post(`/uploads`, data, { headers: { "Content-Type": "multipart/form-data" } });
      setPProofUrl(res.data?.fileUrl ?? res.data?.data?.fileUrl ?? "");
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-white p-0.5">
          {([["all", "All Payments"], ["pending", `Pending Approval (${pending.length})`], ["refunds", "Refunds"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md ${tab === t ? "bg-primary text-primary-foreground" : "text-slate-500 hover:text-slate-800"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setShowRefund(true)}>Request Refund</Button>
          <Button onClick={() => setShowRecord(true)}><Plus className="w-4 h-4 mr-1" /> Record Payment</Button>
        </div>
      </div>

      {tab === "all" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center bg-white border rounded-lg px-3 py-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input className="outline-none text-sm w-full" placeholder="Search payment #, txn id or customer…"
                     value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={method}
                    onChange={(e) => { setMethod(e.target.value); setPage(0); }}>
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
            </select>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Method / Txn</th>
                  <th className="px-4 py-3">Collected By</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(payments?.content ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{p.paymentNumber}</td>
                    <td className="px-4 py-3">{p.customer?.name}</td>
                    <td className="px-4 py-3">
                      {p.invoice ? (
                        <Link to={`/finance/invoices/${p.invoice.id}`} className="text-primary hover:underline">
                          {p.invoice.invoiceNumber}
                        </Link>
                      ) : <span className="text-muted-foreground">Advance</span>}
                    </td>
                    <td className="px-4 py-3">{p.paymentDate}</td>
                    <td className="px-4 py-3">
                      <div>{p.paymentMethod ?? "—"}</div>
                      {p.referenceNumber && <div className="text-xs text-muted-foreground">{p.referenceNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.collectedBy?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{currency(p.amount)}</td>
                    <td className="px-4 py-3"><Badge className={PAYMENT_STATUS_TONE[p.status]}>{p.status.replaceAll("_", " ")}</Badge></td>
                  </tr>
                ))}
                {payments && payments.content.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No payments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {payments && payments.totalPages > 1 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= payments.totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      {tab === "pending" && (
        <div className="bg-white border rounded-2xl shadow-sm divide-y">
          {pending.map((p) => (
            <div key={p.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold text-sm text-slate-800">{p.paymentNumber} · {currency(p.amount)}</div>
                <div className="text-xs text-muted-foreground">
                  {p.customer?.name} · {p.paymentDate} · {p.paymentMethod ?? "—"}
                  {p.collectedBy?.name ? ` · collected by ${p.collectedBy.name}` : ""}
                </div>
                {p.proofUrl && (
                  <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View payment proof</a>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => act(() => financeApi.approvePayment(p.id))}>
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200" disabled={busy}
                        onClick={() => {
                          const reason = window.prompt("Reason for rejecting?") ?? undefined;
                          if (reason !== undefined) act(() => financeApi.rejectPayment(p.id, reason));
                        }}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No payments awaiting approval.</div>}
        </div>
      )}

      {tab === "refunds" && (
        <div className="bg-white border rounded-2xl shadow-sm divide-y">
          {(refunds?.content ?? []).map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold text-sm text-slate-800">{r.refundNumber} · {currency(r.amount)}</div>
                <div className="text-xs text-muted-foreground">
                  {r.customer?.name}{r.reason ? ` · ${r.reason}` : ""}
                  {r.invoice ? ` · against ${r.invoice.invoiceNumber}` : ""}
                </div>
              </div>
              <Badge className={REFUND_STATUS_TONE[r.status]}>{r.status}</Badge>
              {r.status === "PENDING" && (
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => act(() => financeApi.approveRefund(r.id))}>Approve</Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" disabled={busy}
                          onClick={() => act(() => financeApi.rejectRefund(r.id))}>Reject</Button>
                </div>
              )}
              {r.status === "APPROVED" && (
                <Button size="sm" variant="outline" disabled={busy}
                        onClick={() => {
                          const m = window.prompt("Payment method for the refund payout?", "BANK_TRANSFER");
                          if (m) act(() => financeApi.markRefundPaid(r.id, m, window.prompt("Reference number?") ?? undefined));
                        }}>
                  Mark Paid
                </Button>
              )}
            </div>
          ))}
          {refunds && refunds.content.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No refunds requested.</div>
          )}
        </div>
      )}

      {/* Record payment modal (advance / unlinked) */}
      {showRecord && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRecord(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900">Record Payment</h3>
            <p className="text-xs text-muted-foreground -mt-2">
              For invoice payments, use “Record Payment” on the invoice itself. This form records advances / on-account receipts.
            </p>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Customer</span>
              <select className="mt-1 w-full border rounded-lg px-3 py-2" value={pCustomer} onChange={(e) => setPCustomer(e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Amount</span>
                <input type="number" min={1} className="mt-1 w-full border rounded-lg px-3 py-2" value={pAmount} onChange={(e) => setPAmount(e.target.value)} />
              </label>
              <label className="text-sm block">
                <span className="font-semibold text-slate-700">Method</span>
                <select className="mt-1 w-full border rounded-lg px-3 py-2" value={pMethod} onChange={(e) => setPMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
                </select>
              </label>
            </div>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Transaction / Reference #</span>
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={pRef} onChange={(e) => setPRef(e.target.value)} />
            </label>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Remarks</span>
              <input className="mt-1 w-full border rounded-lg px-3 py-2" value={pRemarks} onChange={(e) => setPRemarks(e.target.value)} />
            </label>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Payment Proof (photo / receipt)</span>
              <div className="mt-1 flex items-center gap-2">
                <input type="file" accept="image/*,.pdf" className="w-full text-sm" disabled={uploading}
                       onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProof(f); e.target.value = ""; }} />
                <CameraCaptureButton onCapture={uploadProof} disabled={uploading} label="Camera"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-60" />
              </div>
              {pProofUrl && <span className="text-xs text-emerald-600 font-semibold">Proof attached ✓</span>}
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRecord(false)}>Close</Button>
              <Button disabled={busy || !pCustomer || !pAmount || Number(pAmount) <= 0}
                      onClick={() => act(async () => {
                        await financeApi.recordPayment({
                          customer: { id: Number(pCustomer) }, amount: Number(pAmount),
                          paymentMethod: pMethod, referenceNumber: pRef || null,
                          remarks: pRemarks || null, paymentType: "ADVANCE",
                          proofUrl: pProofUrl || null,
                        });
                        setShowRecord(false); setPCustomer(""); setPAmount(""); setPRef(""); setPRemarks(""); setPProofUrl("");
                      })}>
                Save Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request refund modal */}
      {showRefund && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRefund(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900">Request Refund</h3>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Customer</span>
              <select className="mt-1 w-full border rounded-lg px-3 py-2" value={rCustomer} onChange={(e) => setRCustomer(e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Amount</span>
              <input type="number" min={1} className="mt-1 w-full border rounded-lg px-3 py-2" value={rAmount} onChange={(e) => setRAmount(e.target.value)} />
            </label>
            <label className="text-sm block">
              <span className="font-semibold text-slate-700">Reason</span>
              <textarea className="mt-1 w-full border rounded-lg px-3 py-2" rows={2} value={rReason} onChange={(e) => setRReason(e.target.value)} />
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRefund(false)}>Close</Button>
              <Button disabled={busy || !rCustomer || !rAmount || Number(rAmount) <= 0}
                      onClick={() => act(async () => {
                        await financeApi.requestRefund({
                          customer: { id: Number(rCustomer) }, amount: Number(rAmount), reason: rReason || null,
                        });
                        setShowRefund(false); setRCustomer(""); setRAmount(""); setRReason("");
                        setTab("refunds");
                      })}>
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

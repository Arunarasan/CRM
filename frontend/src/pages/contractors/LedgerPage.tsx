import { useEffect, useState } from "react";
import { contractorApi } from "@/api/contractorApi";
import type { Contractor, ContractorLedger } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const ENTRY_TONE: Record<string, string> = {
  BILL: "bg-blue-100 text-blue-700",
  PAYMENT: "bg-emerald-100 text-emerald-700",
  ADVANCE: "bg-amber-100 text-amber-700",
  RETENTION_HELD: "bg-violet-100 text-violet-700",
  RETENTION_RELEASED: "bg-violet-100 text-violet-700",
  MATERIAL_RECOVERY: "bg-orange-100 text-orange-700",
  PENALTY: "bg-rose-100 text-rose-700",
  REVERSAL: "bg-slate-200 text-slate-600",
  OPENING: "bg-slate-100 text-slate-700",
};

export default function LedgerPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorId, setContractorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ledger, setLedger] = useState<ContractorLedger | null>(null);

  useEffect(() => {
    contractorApi.list({ size: 200 }).then((p) => setContractors(p.content ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!contractorId) { setLedger(null); return; }
    contractorApi.getLedger(Number(contractorId), from || undefined, to || undefined)
      .then(setLedger).catch(() => setLedger(null));
  }, [contractorId, from, to]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="space-y-1 flex-1">
          <Label className="text-xs text-slate-500">Contractor</Label>
          <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
            <option value="">Select a contractor…</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>{c.contractorCode} · {c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {!ledger && (
        <div className="bg-white border rounded-2xl shadow-sm p-10 text-center text-sm text-muted-foreground">
          Pick a contractor to see their running account.
        </div>
      )}

      {ledger && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Tile label="Opening balance" value={currency(ledger.openingBalance)} />
            <Tile label="Total billed (credit)" value={currency(ledger.totalCredit)} />
            <Tile label="Total settled (debit)" value={currency(ledger.totalDebit)} />
            <Tile label="Closing balance" value={currency(ledger.closingBalance)} accent
                  hint="payable to contractor" />
          </div>

          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">{ledger.contractorName} — running account</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Immutable postings. Corrections appear as REVERSAL rows, never as edits.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-500 border-b">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Description</th>
                    <th className="p-3 font-semibold">Project</th>
                    <th className="p-3 font-semibold text-right">Debit</th>
                    <th className="p-3 font-semibold text-right">Credit</th>
                    <th className="p-3 font-semibold text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledger.entries.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No entries in this period.</td></tr>
                  )}
                  {ledger.entries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-3 whitespace-nowrap">{e.entryDate}</td>
                      <td className="p-3">
                        <Badge className={ENTRY_TONE[e.entryType] ?? "bg-slate-100 text-slate-700"}>
                          {e.entryType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {e.description}
                        {e.referenceNumber && <span className="text-xs text-slate-400"> · {e.referenceNumber}</span>}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{e.projectName ?? "—"}</td>
                      <td className="p-3 text-right">{Number(e.debit) ? currency(e.debit) : "—"}</td>
                      <td className="p-3 text-right">{Number(e.credit) ? currency(e.credit) : "—"}</td>
                      <td className="p-3 text-right font-semibold">{currency(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`border rounded-2xl p-4 shadow-sm ${accent ? "bg-slate-900 text-white" : "bg-white"}`}>
      <div className={`text-xs font-semibold uppercase ${accent ? "text-slate-300" : "text-slate-400"}`}>{label}</div>
      <div className="text-xl font-black mt-1">{value}</div>
      {hint && <div className={`text-xs ${accent ? "text-slate-400" : "text-muted-foreground"}`}>{hint}</div>}
    </div>
  );
}

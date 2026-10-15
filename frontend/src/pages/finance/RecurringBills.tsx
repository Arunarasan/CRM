import { useEffect, useMemo, useState } from "react";
import { CalendarClock, FileText, History, Pencil, Plus, Repeat } from "lucide-react";
import { financeApi } from "@/api/financeApi";
import type { CompanyTransaction, RecurringExpense } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { resolveFileUrl } from "@/lib/uploadFile";
import { currency, stageLabel } from "./helpers";
import { Empty, Modal, Segmented, SkeletonRows } from "./financeUi";

type Filter = "all" | "attention" | "inactive";

const FREQ_LABEL: Record<string, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly" };
const FREQ_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };
const RANK: Record<string, number> = { OVERDUE: 0, DUE_SOON: 1, UPCOMING: 2, INACTIVE: 3 };

const nth = (d: number) => (d >= 11 && d <= 13) ? "th" : ["th", "st", "nd", "rd"][d % 10] ?? "th";

function DueChip({ h }: { h: RecurringExpense }) {
  if (!h.active) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Paused</span>;
  const d = h.daysUntilDue ?? 0;
  const tone = h.dueStatus === "OVERDUE" ? "bg-rose-100 text-rose-700"
    : h.dueStatus === "DUE_SOON" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  const text = d < 0 ? `Overdue ${-d}d` : d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `Due in ${d}d`;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{text}</span>;
}

/**
 * Recurring company bills (rent, power, internet…). Most urgent first, filterable, with a monthly
 * commitment figure and one-click payment history. Payments are still recorded by hand.
 */
export default function RecurringBills({ heads, loaded, onAdd, onEdit, onRecord }: {
  heads: RecurringExpense[]; loaded: boolean;
  onAdd: () => void; onEdit: (h: RecurringExpense) => void; onRecord: (h: RecurringExpense) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [historyOf, setHistoryOf] = useState<RecurringExpense | null>(null);

  const attention = heads.filter((h) => h.active && (h.dueStatus === "OVERDUE" || h.dueStatus === "DUE_SOON"));
  const monthly = useMemo(() => heads.filter((h) => h.active && h.defaultAmount != null)
    .reduce((s, h) => s + (h.defaultAmount as number) / (FREQ_MONTHS[h.frequency ?? "MONTHLY"] ?? 1), 0), [heads]);
  const variableCount = heads.filter((h) => h.active && h.defaultAmount == null).length;

  const shown = useMemo(() => {
    const list = heads.filter((h) =>
      filter === "all" ? h.active : filter === "attention" ? attention.includes(h) : !h.active);
    return [...list].sort((a, b) => (RANK[a.dueStatus ?? "UPCOMING"] - RANK[b.dueStatus ?? "UPCOMING"])
      || (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0) || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heads, filter]);

  return (
    <section aria-label="Recurring bills" className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <CalendarClock className="h-4 w-4 text-slate-400" /> Recurring bills
        </div>
        <div className="text-xs text-muted-foreground">
          About {currency(monthly)} a month
          {variableCount > 0 ? ` + ${variableCount} variable bill${variableCount > 1 ? "s" : ""}` : ""}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Segmented<Filter> label="Recurring bill filter" value={filter} onChange={setFilter} options={[
            { value: "all", label: "Active" },
            { value: "attention", label: "Needs action", count: attention.length },
            { value: "inactive", label: "Paused" },
          ]} />
          <Button size="sm" variant="outline" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add recurring bill</Button>
        </div>
      </div>

      {!loaded ? <SkeletonRows rows={3} /> : shown.length === 0 ? (
        heads.length === 0 ? (
          <Empty title="No recurring bills yet"
            hint="Add rent, electricity, internet and other repeating bills. You'll see when each is due and get reminded."
            action={<Button size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add the first recurring bill</Button>} />
        ) : (
          <Empty title={filter === "attention" ? "Nothing needs action" : filter === "inactive" ? "No paused bills" : "No active bills"}
            hint={filter === "attention" ? "No bill is overdue or due within 7 days." : undefined} />
        )
      ) : (
        <ul className="divide-y">
          {shown.map((h) => (
            <li key={h.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${h.dueStatus === "OVERDUE" && h.active ? "bg-rose-50/40" : ""}`}>
              <div className="min-w-[180px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-slate-800">{h.name}</span>
                  <DueChip h={h} />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Repeat className="h-3 w-3" />{FREQ_LABEL[h.frequency ?? "MONTHLY"]}</span>
                  <span>{stageLabel(h.category)}</span>
                  {h.dayOfMonth ? <span>on the {h.dayOfMonth}{nth(h.dayOfMonth)}</span> : null}
                  {h.partyName ? <span>to {h.partyName}</span> : null}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="text-sm font-semibold tabular-nums text-slate-800">
                  {h.defaultAmount != null ? currency(h.defaultAmount) : <span className="text-slate-400">Variable</span>}
                </div>
                {h.active && h.nextDueDate && <div>Next {h.nextDueDate}</div>}
                <div>{h.lastPaidDate ? `Last paid ${h.lastPaidDate}` : "Never paid"}</div>
              </div>
              <div className="flex items-center gap-1">
                {h.active && <Button size="sm" onClick={() => onRecord(h)}>Record payment</Button>}
                <button className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Payment history for ${h.name}`}
                  title="Payment history" onClick={() => setHistoryOf(h)}><History className="h-4 w-4" /></button>
                <button className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Edit ${h.name}`}
                  title="Edit" onClick={() => onEdit(h)}><Pencil className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {historyOf && <HistoryModal head={historyOf} onClose={() => setHistoryOf(null)} />}
    </section>
  );
}

function HistoryModal({ head, onClose }: { head: RecurringExpense; onClose: () => void }) {
  const [rows, setRows] = useState<CompanyTransaction[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    financeApi.getRecurringHistory(head.id).then(setRows).catch(() => setFailed(true));
  }, [head.id]);

  const total = (rows ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);

  return (
    <Modal title={`${head.name} — payment history`} width="max-w-lg" onClose={onClose}
      subtitle={rows ? `${rows.length} payment${rows.length === 1 ? "" : "s"} · ${currency(total)} in total` : undefined}>
      {failed ? <p className="text-sm text-red-600">Could not load the history. Nothing was changed.</p>
        : rows === null ? <SkeletonRows rows={3} />
        : rows.length === 0 ? <Empty title="No payments recorded yet" hint="Use Record payment when this bill is paid." />
        : (
          <ul className="divide-y rounded-xl border">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{t.txnDate}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.paymentMethod ? stageLabel(t.paymentMethod) : "—"}{t.partyName ? ` · ${t.partyName}` : ""}
                  </div>
                </div>
                {t.documentUrl && (
                  <a href={resolveFileUrl(t.documentUrl)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <FileText className="h-3.5 w-3.5" /> Bill
                  </a>
                )}
                <span className="font-bold tabular-nums text-rose-600">{currency(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
    </Modal>
  );
}

import { useMemo, useState } from "react";
import { BaseInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { financeApi } from "@/api/financeApi";
import type { RecurringExpense } from "@/types/finance";
import { currency, stageLabel } from "./helpers";
import { Modal, Segmented } from "./financeUi";

const PAY_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD"];
const QUICK_NAMES: { name: string; category: string }[] = [
  { name: "Office rent", category: "RENT" },
  { name: "Electricity", category: "ELECTRICITY" },
  { name: "Internet", category: "UTILITIES" },
  { name: "Water", category: "UTILITIES" },
  { name: "Insurance", category: "INSURANCE" },
];
const PERIOD_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };

type Freq = "MONTHLY" | "QUARTERLY" | "YEARLY";
type AmountKind = "FIXED" | "VARIES";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** First date on/after today that falls on the given day of month (clamped for short months). */
function firstDue(day: number): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let add = 0; add < 2; add++) {
    const y = today.getFullYear(), m = today.getMonth() + add;
    const last = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(day, last));
    if (d >= today) return iso(d);
  }
  return iso(today);
}

/**
 * Add / edit a recurring company bill. Laid out as three short sections (what, when, how much) with a
 * live line showing what the due date and monthly cost will be, so the effect of each choice is visible.
 */
export default function RecurringBillForm({ head, categories, onClose, onSaved }: {
  head: RecurringExpense | null; categories: string[]; onClose: () => void; onSaved: () => void;
}) {
  const editing = head != null;
  const [name, setName] = useState(head?.name ?? "");
  const [category, setCategory] = useState(head?.category ?? "RENT");
  const [party, setParty] = useState(head?.partyName ?? "");
  const [freq, setFreq] = useState<Freq>((head?.frequency as Freq) ?? "MONTHLY");
  const [day, setDay] = useState(head?.dayOfMonth != null ? String(head.dayOfMonth) : "");
  const [kind, setKind] = useState<AmountKind>(head && head.defaultAmount == null ? "VARIES" : "FIXED");
  const [amount, setAmount] = useState(head?.defaultAmount != null ? String(head.defaultAmount) : "");
  const [method, setMethod] = useState(head?.paymentMethod || "BANK_TRANSFER");
  const [active, setActive] = useState(head?.active ?? true);
  const [notes, setNotes] = useState(head?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const dayNum = day === "" ? null : Number(day);
  const errors = {
    name: !name.trim() ? "Give the bill a name." : "",
    day: dayNum != null && (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) ? "Use a day from 1 to 31." : "",
    amount: kind === "FIXED" && amount !== "" && Number(amount) < 0 ? "Amount cannot be negative." : "",
  };
  const invalid = Object.values(errors).some(Boolean);

  const monthly = kind === "FIXED" && amount !== "" ? Number(amount) / PERIOD_MONTHS[freq] : null;
  const dueText = useMemo(() => {
    if (editing && head?.nextDueDate && head.frequency === freq && head.dayOfMonth === dayNum) return head.nextDueDate;
    return firstDue(dayNum && !errors.day ? dayNum : 1);
  }, [editing, head, freq, dayNum, errors.day]);

  const save = async () => {
    setTried(true);
    if (invalid) return;
    setBusy(true);
    const body = {
      name: name.trim(), category: category.trim() || "MISC", partyName: party.trim() || null,
      frequency: freq, dayOfMonth: dayNum, defaultAmount: kind === "FIXED" && amount !== "" ? Number(amount) : null,
      paymentMethod: method || null, active, notes: notes.trim() || null,
    };
    try {
      if (head) await financeApi.updateRecurringExpense(head.id, body);
      else await financeApi.saveRecurringExpense(body);
      toast.success(editing ? "Recurring bill updated." : "Recurring bill added.");
      onSaved();
    } catch (e) { console.error(e); toast.error("Could not save the bill. Nothing was changed."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!head || !window.confirm("Remove this recurring bill? Past payments stay on record.")) return;
    setBusy(true);
    try { await financeApi.deleteRecurringExpense(head.id); onSaved(); }
    catch (e) { console.error(e); toast.error("Could not remove the bill."); }
    finally { setBusy(false); }
  };

  const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  const label = "text-sm font-semibold text-slate-700";
  const err = (m: string) => (tried && m ? <p className="mt-1 text-xs text-red-600">{m}</p> : null);

  return (
    <Modal width="max-w-lg" onClose={onClose} title={editing ? "Edit recurring bill" : "Add recurring bill"}
      subtitle="Set it up once. We work out when it is next due and remind you. You still record each payment yourself.">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">What is the bill</legend>
        {!editing && (
          <div className="flex flex-wrap gap-1.5" aria-label="Quick pick">
            {QUICK_NAMES.map((q) => (
              <button key={q.name} type="button" onClick={() => { setName(q.name); setCategory(q.category); }}
                className="rounded-full border px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary">
                {q.name}
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className={label}>Name</span>
          <BaseInput className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office rent, Shop electricity" />
          {err(errors.name)}
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Category</span>
            <BaseInput list="recurring-form-cats" className={field} value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="recurring-form-cats">
              {(categories.length ? categories : ["RENT", "ELECTRICITY", "UTILITIES", "INSURANCE", "MISC"]).map((c) => (
                <option key={c} value={c}>{stageLabel(c)}</option>
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className={label}>Paid to</span>
            <BaseInput className={field} value={party} onChange={(e) => setParty(e.target.value)} placeholder="Landlord / provider" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">When is it due</legend>
        <Segmented<Freq> label="Repeats" value={freq} onChange={setFreq} options={[
          { value: "MONTHLY", label: "Monthly" }, { value: "QUARTERLY", label: "Quarterly" }, { value: "YEARLY", label: "Yearly" },
        ]} />
        <label className="block">
          <span className={label}>Due on day <span className="font-normal text-muted-foreground">(of the month, 1–31)</span></span>
          <BaseInput type="number" min={1} max={31} className={`${field} sm:w-40`} value={day} onChange={(e) => setDay(e.target.value)} placeholder="e.g. 5" />
          {err(errors.day)}
        </label>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" aria-live="polite">
          {editing ? "Next due" : "First due"}: <span className="font-semibold text-slate-800">{dueText}</span>.
          Reminders go to the finance admins 3 days before, on the day, and while it stays unrecorded.
        </p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">How much</legend>
        <Segmented<AmountKind> label="Amount type" value={kind} onChange={setKind} options={[
          { value: "FIXED", label: "Same each time" }, { value: "VARIES", label: "Changes each time" },
        ]} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kind === "FIXED" ? (
            <label className="block">
              <span className={label}>Amount (₹)</span>
              <BaseInput type="number" min={0} className={field} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25000" />
              {err(errors.amount)}
            </label>
          ) : (
            <p className="self-end rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              You'll enter the amount each time you record a payment, as with an electricity bill.
            </p>
          )}
          <label className="block">
            <span className={label}>Usually paid by</span>
            <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((m) => <option key={m} value={m}>{stageLabel(m)}</option>)}
            </select>
          </label>
        </div>
        {monthly != null && monthly > 0 && (
          <p className="text-xs text-slate-600">About <span className="font-semibold text-slate-800">{currency(monthly)}</span> a month.</p>
        )}
      </fieldset>

      <label className="block">
        <span className={label}>Notes <span className="font-normal text-muted-foreground">(optional)</span></span>
        <textarea className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <BaseInput type="checkbox" className="mt-0.5 h-4 w-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>
          <span className="font-semibold text-slate-700">Active</span>
          <span className="block text-xs text-muted-foreground">Untick to pause this bill. It stops showing as due and sends no reminders.</span>
        </span>
      </label>

      <div className="flex items-center justify-between gap-2 border-t pt-4">
        <div>
          {editing && (
            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={busy} onClick={remove}>Remove</Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={save}>{busy ? "Saving…" : editing ? "Save changes" : "Add bill"}</Button>
        </div>
      </div>
    </Modal>
  );
}

import { useState } from "react";
import { Input, BaseInput } from "@/components/ui/input";
import ResourceSelect, { type ResourceSelection } from "@/components/workforce/ResourceSelect";
import { WORK_TYPES } from "@/api/bundleApi";
import { WorkSpecFields, formatSpec, type WorkSpec } from "./workSpec";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface WorkHeader {
  workType: string;
  bundleCount: number;
  charge: string;
  dueDate: string;
  priority: string;
  resource: ResourceSelection | null;
  handoverMode: "PICKUP" | "DELIVERY";
  notes: string;
}

export interface WorkLine { on: boolean; bundleNo: number; spec: WorkSpec }

export interface WorkLineOption { key: number; label: string; sub?: string }

export function defaultWorkHeader(): WorkHeader {
  const due = new Date();
  due.setDate(due.getDate() + 5);
  return {
    workType: "STITCHING", bundleCount: 1, charge: "", dueDate: due.toISOString().slice(0, 10),
    priority: "MEDIUM", resource: null, handoverMode: "PICKUP", notes: "",
  };
}

const selectCls = "h-9 w-full rounded-md border bg-white px-2 text-sm";

/**
 * The "needs stitching / work" editor: job header (type, stickers, charge, due, tailor, pickup/delivery)
 * plus, per bill line, a "needs work" tick, which order it goes in, and its work spec.
 */
export default function BundleWorkEditor({
  lines, header, onHeader, lineState, onLine, showCharge, installing,
}: {
  lines: WorkLineOption[];
  header: WorkHeader;
  onHeader: (patch: Partial<WorkHeader>) => void;
  lineState: Record<number, WorkLine>;
  onLine: (key: number, patch: Partial<WorkLine>) => void;
  showCharge?: boolean;
  /** The bill includes installation: the order goes out by Install (not pickup/delivery). */
  installing?: boolean;
}) {
  const [openKey, setOpenKey] = useState<number | null>(null);
  const bundleNos = Array.from({ length: header.bundleCount }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <label className="text-xs"><span className="text-slate-500">Work</span>
          <select value={header.workType} onChange={(e) => onHeader({ workType: e.target.value })} className={`${selectCls} mt-1`}>
            {WORK_TYPES.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
          </select>
        </label>
        <label className="text-xs"><span className="text-slate-500">Orders (stickers)</span>
          <Input type="number" min={1} max={20} value={header.bundleCount}
            onChange={(e) => onHeader({ bundleCount: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="h-9 mt-1" /></label>
        {showCharge && (
          <label className="text-xs"><span className="text-slate-500">Work charge ₹ <span className="text-slate-400">(5% GST)</span></span>
            <Input type="number" min={0} value={header.charge} onChange={(e) => onHeader({ charge: e.target.value })} className="h-9 mt-1" placeholder="0" /></label>
        )}
        <label className="text-xs"><span className="text-slate-500">Ready by</span>
          <Input type="date" value={header.dueDate} onChange={(e) => onHeader({ dueDate: e.target.value })} className="h-9 mt-1" /></label>
        <label className="text-xs col-span-2"><span className="text-slate-500">Tailor / worker</span>
          <div className="mt-1"><ResourceSelect value={header.resource} onChange={(r) => onHeader({ resource: r })} placeholder="Assign later" /></div>
        </label>
        <label className="text-xs"><span className="text-slate-500">Handover</span>
          {installing ? (
            <div className="h-9 mt-1 flex items-center rounded-md border bg-sky-50 px-2 text-sm text-sky-800" title="This bill includes installation">
              Install at site
            </div>
          ) : (
            <select value={header.handoverMode} onChange={(e) => onHeader({ handoverMode: e.target.value as WorkHeader["handoverMode"] })} className={`${selectCls} mt-1`}>
              <option value="PICKUP">Customer pickup</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          )}
        </label>
        <label className="text-xs"><span className="text-slate-500">Priority</span>
          <select value={header.priority} onChange={(e) => onHeader({ priority: e.target.value })} className={`${selectCls} mt-1`}>
            <option value="LOW">Low</option><option value="MEDIUM">Normal</option>
            <option value="HIGH">High</option><option value="URGENT">Urgent</option>
          </select>
        </label>
      </div>

      <div className="rounded-lg border divide-y">
        <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">Items that need work</div>
        {lines.length === 0 && <div className="px-3 py-3 text-sm text-slate-400">Add items to the bill first.</div>}
        {lines.map((l) => {
          const st = lineState[l.key] ?? { on: false, bundleNo: 1, spec: {} };
          const summary = formatSpec(st.spec);
          const open = openKey === l.key && st.on;
          return (
            <div key={l.key} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <BaseInput type="checkbox" checked={st.on} className="w-4 h-4 shrink-0"
                  onChange={(e) => { onLine(l.key, { on: e.target.checked }); if (e.target.checked) setOpenKey(l.key); }} />
                <button type="button" className="min-w-0 flex-1 text-left" disabled={!st.on}
                  onClick={() => setOpenKey(open ? null : l.key)}>
                  <span className={`block text-sm truncate ${st.on ? "font-medium text-slate-800" : "text-slate-500"}`}>{l.label || "Unnamed item"}</span>
                  <span className="block text-[11px] text-slate-400 truncate">{st.on ? (summary || "Tap to add size / pleat / lining") : l.sub}</span>
                </button>
                {st.on && header.bundleCount > 1 && (
                  <select value={Math.min(st.bundleNo, header.bundleCount)} onChange={(e) => onLine(l.key, { bundleNo: Number(e.target.value) })}
                    className="h-8 rounded-md border bg-white px-1.5 text-xs shrink-0" title="Which order">
                    {bundleNos.map((n) => <option key={n} value={n}>Order {n}</option>)}
                  </select>
                )}
                {st.on && (
                  <button type="button" onClick={() => setOpenKey(open ? null : l.key)} className="text-slate-400 hover:text-slate-700 shrink-0">
                    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {open && (
                <div className="mt-2 pl-6">
                  <WorkSpecFields value={st.spec} onChange={(spec) => onLine(l.key, { spec })} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label className="text-xs block"><span className="text-slate-500">Job notes</span>
        <Input value={header.notes} onChange={(e) => onHeader({ notes: e.target.value })} placeholder="Optional — shown to the tailor" className="h-9 mt-1" /></label>
    </div>
  );
}

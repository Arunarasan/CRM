import { useCallback, useEffect, useState } from "react";
import { Shapes, ChevronDown, CheckCircle2, Loader2, LayoutList, Tag } from "lucide-react";
import { projectApi, type WorkCategory, type WorkCategoryLine } from "@/api/projectApi";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

const inr = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const STEPS = [0, 25, 50, 75, 100];

/**
 * Execution › Work Categories — the project's work grouped by category (Wall, Windows, Curtains…)
 * from the quotation, with progress per line and per category. Lines tied to an execution work item
 * can be updated right here; the old floor/room breakdown stays one click away.
 */
export default function WorkCategoriesTab({ projectId, onChanged, onOpenRooms }: {
  projectId: number;
  onChanged?: () => void;
  onOpenRooms?: () => void;
}) {
  const [cats, setCats] = useState<WorkCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCat, setOpenCat] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    projectApi.getWorkCategories(projectId)
      .then((c) => { setCats(c); setOpenCat((o) => (Object.keys(o).length || !c[0] ? o : { [c[0].category]: true })); })
      .catch(() => setCats([]))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const setProgress = async (line: WorkCategoryLine, progress: number) => {
    if (!line.workItemId) return;
    setBusy(`item-${line.workItemId}`);
    try {
      await projectApi.updateItemProgress(line.workItemId, { progress, status: progress >= 100 ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : undefined });
      load(); onChanged?.();
    } catch (e: any) { toast.error(e?.response?.data?.message || "Could not update progress"); }
    finally { setBusy(null); }
  };

  const completeCategory = async (c: WorkCategory) => {
    const ids = c.items.filter((l) => l.workItemId && l.progress < 100).map((l) => l.workItemId!) ;
    if (!ids.length) return;
    if (!confirm(`Mark all ${ids.length} open item(s) in "${c.category}" as complete?`)) return;
    setBusy(`cat-${c.category}`);
    try {
      const r = await projectApi.bulkUpdateItemProgress({ itemIds: ids, progress: 100, status: "COMPLETED" });
      toast.success(`${r.updated} item(s) completed${r.skipped ? ` · ${r.skipped} skipped` : ""}`);
      load(); onChanged?.();
    } catch (e: any) { toast.error(e?.response?.data?.message || "Could not update"); }
    finally { setBusy(null); }
  };

  const totalItems = cats.reduce((s, c) => s + c.itemCount, 0);
  const overall = totalItems ? Math.round(cats.reduce((s, c) => s + c.progress * c.itemCount, 0) / totalItems) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] @container">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Shapes className="w-5 h-5 text-emerald-700" /> Work Categories</h3>
          {cats.length > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{overall}% overall</span>}
        </div>
        {onOpenRooms && (
          <Button size="sm" variant="outline" onClick={onOpenRooms} className="h-9 rounded-xl text-slate-600">
            <LayoutList className="w-4 h-4 mr-1" /> Floors & rooms view
          </Button>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : cats.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Shapes className="h-5 w-5" /></span>
            <div className="mt-2 text-sm font-semibold text-slate-600">No work categories yet</div>
            <div className="text-xs text-slate-400">They come from the quotation's categories and products.</div>
          </div>
        ) : cats.map((c) => {
          const open = !!openCat[c.category];
          const done = c.progress >= 100;
          const openCount = c.items.filter((l) => l.workItemId && l.progress < 100).length;
          return (
            <div key={c.category} className={`rounded-2xl border transition-shadow hover:shadow-md ${done ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-white"}`}>
              <button type="button" onClick={() => setOpenCat((o) => ({ ...o, [c.category]: !open }))}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-emerald-700 text-white" : "bg-amber-100 text-amber-800"}`}>
                  {done ? <CheckCircle2 className="h-5 w-5" /> : <Tag className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 truncate">{c.category}</span>
                    <span className="text-base font-bold text-slate-900 shrink-0">{c.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${done ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${c.progress}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                    <span>{c.doneCount}/{c.itemCount} done</span>
                    {Number(c.amount) > 0 && <span>{inr(c.amount)}</span>}
                    {!c.trackable && <span className="text-amber-600">progress not tracked yet</span>}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <div className="border-t border-slate-100 px-3.5 pb-3">
                  <div className="divide-y divide-slate-100">
                    {c.items.map((l, i) => {
                      const lineBusy = busy === `item-${l.workItemId}`;
                      return (
                        <div key={`${l.name}-${i}`} className="py-2.5 flex flex-col @2xl:flex-row @2xl:items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-800 truncate">{l.name}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {[l.quantity != null ? `${Number(l.quantity)} ${l.unit || ""}`.trim() : null, l.description, l.amount ? inr(l.amount) : null].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          {l.workItemId ? (
                            <div className="flex items-center gap-1 shrink-0">
                              {lineBusy && <Loader2 className="h-4 w-4 animate-spin text-slate-400 mr-1" />}
                              {STEPS.map((p) => (
                                <button key={p} type="button" disabled={lineBusy} onClick={() => setProgress(l, p)}
                                  className={`h-7 min-w-[40px] rounded-lg px-1.5 text-[11px] font-bold transition ${l.progress === p
                                    ? (p >= 100 ? "bg-emerald-700 text-white" : "bg-amber-500 text-white")
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                                  {p === 100 ? "Done" : `${p}%`}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="shrink-0 text-[11px] text-slate-400">Not linked to a work item</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {openCount > 0 && (
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" disabled={busy === `cat-${c.category}`} onClick={() => completeCategory(c)} className="h-8 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white">
                        {busy === `cat-${c.category}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Mark category complete
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

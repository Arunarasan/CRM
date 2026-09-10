import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, Filter } from "lucide-react";
import { projectApi, ProjectItemBrief } from "@/api/projectApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

/**
 * "Update Work" batch sheet. Records a whole day's work in one action: tick several work items
 * across any rooms/floors, then Mark Complete or Set % once. Advances the project bar without
 * opening each item. Completed/locked items are filtered out (nothing left to update).
 */
export default function BulkWorkUpdateDialog({
  projectId, open, onOpenChange, onApplied,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApplied: () => void;
}) {
  const [items, setItems] = useState<ProjectItemBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [floor, setFloor] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pct, setPct] = useState<number>(100);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());
    setSearch(""); setFloor(""); setRemarks(""); setPct(100);
    projectApi.getAllItems(projectId)
      // Only items that still have work left — completed/locked ones are done.
      .then((all) => setItems(all.filter((i) => !i.locked && (i.progress ?? 0) < 100)))
      .catch(() => toast.error("Could not load work items"))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const floors = useMemo(
    () => Array.from(new Set(items.map((i) => i.floorName).filter(Boolean))) as string[],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) =>
      (!floor || i.floorName === floor) &&
      (!q || i.itemName?.toLowerCase().includes(q) || i.roomName?.toLowerCase().includes(q)),
    );
  }, [items, search, floor]);

  const allShownSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  const toggle = (id: number) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAllShown = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allShownSelected) filtered.forEach((i) => n.delete(i.id));
      else filtered.forEach((i) => n.add(i.id));
      return n;
    });

  const apply = async (progress: number) => {
    const itemIds = [...selected];
    if (itemIds.length === 0) { toast.error("Select at least one item"); return; }
    setSaving(true);
    try {
      const res = await projectApi.bulkUpdateItemProgress({ itemIds, progress, remarks: remarks || undefined });
      toast.success(
        `${res.updated} item${res.updated === 1 ? "" : "s"} updated${res.skipped ? ` · ${res.skipped} skipped` : ""}`,
      );
      onApplied();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Batch update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Update Work — record today's progress
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item or room…" className="pl-8" />
          </div>
          {floors.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400" />
              <select value={floor} onChange={(e) => setFloor(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                <option value="">All floors</option>
                {floors.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Item list */}
        <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-slate-100">
          {loading ? (
            <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              {items.length === 0 ? "Nothing left to update — all work items are complete. 🎉" : "No items match the filter."}
            </p>
          ) : (
            <>
              <label className="sticky top-0 z-10 flex items-center gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} className="h-4 w-4 accent-emerald-600" />
                Select all shown ({filtered.length})
              </label>
              {filtered.map((i) => (
                <label key={i.id}
                  className={`flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm last:border-0 hover:bg-slate-50 ${selected.has(i.id) ? "bg-emerald-50/50" : ""}`}>
                  <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 accent-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-700">{i.itemName}</span>
                      {i.delayed && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">DELAYED</span>}
                    </div>
                    <div className="text-xs text-slate-400">
                      {[i.floorName, i.roomName].filter(Boolean).join(" · ") || i.phaseName}
                    </div>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${i.progress ?? 0}%` }} />
                    </div>
                    <div className="mt-0.5 text-right text-[11px] font-semibold text-slate-500">{i.progress ?? 0}%</div>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        {/* Shared remark */}
        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional note added to every updated item (e.g. 'done 08 Sep')" />

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-slate-600">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-input px-2 py-1">
              <span className="text-xs text-slate-500">Set</span>
              <Input type="number" min={0} max={100} value={pct}
                onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="h-7 w-16 text-right" />
              <span className="text-xs text-slate-500">%</span>
              <Button size="sm" variant="outline" disabled={saving || selected.size === 0} onClick={() => apply(pct)}>
                Apply
              </Button>
            </div>
            <Button disabled={saving || selected.size === 0} onClick={() => apply(100)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Mark Complete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

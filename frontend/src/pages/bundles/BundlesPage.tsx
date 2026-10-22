import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  bundleApi, extractBundleCode, BUNDLE_STATUS_LABELS, BUNDLE_STATUS_STYLES, BUNDLE_NEXT_ACTION, HANDOVER_LABELS, statusLabel,
  type Bundle, type BundleSummary,
} from "@/api/bundleApi";
import BarcodeScanner from "@/pages/inventory/components/BarcodeScanner";
import HandoverDialog from "@/components/bundles/HandoverDialog";
import { printBundleStickers, getLabelSize } from "@/components/bundles/printStickers";
import { fetchCompanyProfile } from "@/lib/companyProfile";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { BaseInput, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import FilterSheet from "@/components/ui/filter-sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import {
  Camera, ScanLine, LayoutGrid, List, AlertTriangle, Search, ChevronRight, Printer, X, HandCoins, Truck,
  ClipboardList, Scissors, PackageCheck, CheckCircle2, Clock, Activity, Filter, MoreHorizontal, ChevronLeft, ChevronDown,
} from "lucide-react";

const VIEW_KEY = "bundles.view";

type Stage = "ORDER" | "PROCESS" | "COMPLETED" | "DELIVERED";
const STAGES: { key: Stage; label: string; hint: string; icon: typeof ClipboardList; accent: string }[] = [
  { key: "ORDER", label: "Order", hint: "Waiting to start", icon: ClipboardList, accent: "bg-slate-400" },
  { key: "PROCESS", label: "Process", hint: "Being stitched / made", icon: Scissors, accent: "bg-indigo-500" },
  { key: "COMPLETED", label: "Completed", hint: "Ready to go out", icon: PackageCheck, accent: "bg-emerald-500" },
  { key: "DELIVERED", label: "Delivered", hint: "Handed over", icon: CheckCircle2, accent: "bg-emerald-700" },
];
const OPEN_STAGES = STAGES.filter((s) => s.key !== "DELIVERED");

function readView(): "board" | "list" {
  try { return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list"; } catch { return "list"; }
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Days from today to an ISO date (negative = past). */
function daysTo(date?: string | null): number | null {
  if (!date) return null;
  const d = new Date(date.length <= 10 ? `${date}T00:00:00` : date);
  if (isNaN(d.getTime())) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

function dueInfo(b: Bundle): { text: string; tone: string } | null {
  const n = daysTo(b.dueDate);
  if (n === null) return null;
  if (b.status === "DELIVERED" || b.status === "CANCELLED") return { text: `Due ${b.dueDate}`, tone: "text-slate-400" };
  if (n < 0) return { text: `${-n}d overdue`, tone: "text-red-600 font-semibold" };
  if (n === 0) return { text: "Due today", tone: "text-amber-700 font-semibold" };
  if (n === 1) return { text: "Due tomorrow", tone: "text-amber-700" };
  return { text: `Due in ${n}d`, tone: "text-slate-500" };
}

const initials = (name?: string | null) =>
  (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Overdue first, then soonest due date, then newest. */
const urgencySort = (a: Bundle, b: Bundle) =>
  Number(b.overdue) - Number(a.overdue)
  || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
  || b.id - a.id;

/**
 * Orders home. Top: scan / enter-code bar. Then a clickable pipeline (Order -> Process -> Completed -> Delivered)
 * with live counts, and one filter bar (search, install, balance due, tailor) shared by the board and list views.
 */
export default function BundlesPage() {
  const navigate = useNavigate();
  const { hasAuthority } = useAuth();
  const canMove = hasAuthority("BUNDLE_MOVE") || hasAuthority("BUNDLE_WRITE");

  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  /** Several orders found for a bill number / group code. */
  const [found, setFound] = useState<Bundle[] | null>(null);
  const [handover, setHandover] = useState(false);

  const [view, setView] = useState<"board" | "list">(readView);
  const [summary, setSummary] = useState<BundleSummary | null>(null);
  const [rows, setRows] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  // filters (client-side over the loaded set)
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [installOnly, setInstallOnly] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [assignee, setAssignee] = useState("");

  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  const showingDelivered = stage === "DELIVERED";

  const load = useCallback(() => {
    setLoading(true);
    bundleApi.summary().then(setSummary).catch(() => {});
    const req = showingDelivered
      ? bundleApi.search({ status: "DELIVERED", size: 200 })
      : bundleApi.search({ openOnly: true, size: 300 });
    req.then((r) => setRows(r.content ?? []))
      .catch((e) => toast.error(apiError(e, "Could not load orders.")))
      .finally(() => setLoading(false));
  }, [showingDelivered]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { scanRef.current?.focus(); }, []);

  const switchView = (v: "board" | "list") => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  const openCode = async (raw: string) => {
    const c = extractBundleCode(raw);
    if (!c) return;
    setLooking(true);
    try {
      const list = await bundleApi.lookup(c);
      if (list.length === 1) { navigate(`/bundles/${list[0].id}`); return; }
      setFound(list);
      setCode("");
    } catch (e) {
      toast.error(apiError(e, `No order found for ${c}`));
      setCode("");
      scanRef.current?.focus();
    } finally {
      setLooking(false);
    }
  };

  const reprintFound = async () => {
    if (!found) return;
    const company = await fetchCompanyProfile().catch(() => undefined);
    if (!printBundleStickers(found, getLabelSize(), company)) toast.error("Allow pop-ups for this site to print stickers.");
  };

  const quickMove = async (b: Bundle) => {
    if (!b.nextStatus || b.nextStatus === "DELIVERED") { navigate(`/bundles/${b.id}`); return; }
    try {
      await bundleApi.move(b.id, { status: b.nextStatus });
      toast.success(`${b.code} → ${BUNDLE_STATUS_LABELS[b.nextStatus]}`);
      load();
    } catch (e) {
      toast.error(apiError(e, "Could not move the order."));
    }
  };

  const assignees = useMemo(
    () => Array.from(new Set(rows.map((b) => b.assigneeName).filter((x): x is string => !!x))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((b) => {
        if (stage && b.status !== stage) return false;
        if (overdueOnly && !b.overdue) return false;
        if (installOnly && b.handoverMode !== "INSTALL") return false;
        if (dueOnly && !(Number(b.balanceDue ?? 0) > 0)) return false;
        if (assignee === "__none" ? !!b.assigneeName : assignee && b.assigneeName !== assignee) return false;
        if (needle) {
          const hay = [b.code, b.groupCode, b.customerName, b.customerPhone, b.invoiceNumber, b.assigneeName, b.rackLocation]
            .filter(Boolean).join(" ").toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(urgencySort);
  }, [rows, q, stage, overdueOnly, installOnly, dueOnly, assignee]);

  useEffect(() => { setPage(0); }, [q, stage, overdueOnly, installOnly, dueOnly, assignee, size]);

  const activeFilterCount = (assignee ? 1 : 0) + (overdueOnly ? 1 : 0) + (installOnly ? 1 : 0) + (dueOnly ? 1 : 0);
  const countOf = (s: Stage) => summary?.byStatus?.[s];

  const effectiveView = showingDelivered ? "list" : view;

  const from = filtered.length === 0 ? 0 : page * size + 1;
  const to = Math.min(filtered.length, (page + 1) * size);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const pageRows = filtered.slice(page * size, (page + 1) * size);

  const kpis: { label: string; value?: number; icon: typeof Activity; tint: string; ring: string; active: boolean; onClick: () => void }[] = [
    { label: "In Work", value: summary?.inWork, icon: Activity, tint: "bg-indigo-500/10 text-indigo-500", ring: "ring-indigo-500",
      active: false, onClick: () => { setStage(""); setOverdueOnly(false); } },
    { label: "Overdue", value: summary?.overdue, icon: AlertTriangle, tint: "bg-rose-500/10 text-rose-500", ring: "ring-rose-500",
      active: overdueOnly, onClick: () => { setOverdueOnly((v) => !v); if (showingDelivered) setStage(""); } },
    { label: "Ready to Hand Over", value: summary?.ready, icon: PackageCheck, tint: "bg-emerald-500/10 text-emerald-500", ring: "ring-emerald-500",
      active: stage === "COMPLETED", onClick: () => setStage(stage === "COMPLETED" ? "" : "COMPLETED") },
  ];

  const columns: Column<Bundle>[] = [
    {
      key: "order", header: "Order",
      cell: (b) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm">{b.code}</span>
          {b.handoverMode === "INSTALL" && <Badge className="bg-sky-500/10 text-sky-600 border-transparent">Install</Badge>}
        </div>
      ),
    },
    { key: "customer", header: "Customer", cell: (b) => (
      <div><div className="text-sm">{b.customerName || "Walk-in"}</div><div className="text-xs text-muted-foreground">{b.customerPhone}</div></div>
    ) },
    { key: "items", header: "Items", cell: (b) => <span className="text-sm">{b.itemCount}</span> },
    { key: "status", header: "Status", cell: (b) => <StatusPill status={b.status} handoverMode={b.handoverMode} /> },
    { key: "owner", header: "Tailor", cell: (b) => <Owner name={b.handoverMode === "INSTALL" && b.installerName ? b.installerName : b.assigneeName} /> },
    {
      key: "due", header: "Ready by",
      cell: (b) => { const d = dueInfo(b); return d ? <span className={`text-xs ${d.tone}`}>{d.text}</span> : <span className="text-sm text-muted-foreground">—</span>; },
    },
    {
      key: "bill", header: "Bill",
      cell: (b) => b.invoiceId
        ? <Link className="text-sm hover:underline" to={`/billing/invoices/${b.invoiceId}`} onClick={(e) => e.stopPropagation()}>{b.invoiceNumber}</Link>
        : <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      key: "balance", header: "Pending", headClassName: "text-right", cellClassName: "whitespace-nowrap text-right",
      cell: (b) => {
        const bal = Math.round(Number(b.balanceDue ?? 0));
        return <span className={`text-sm font-semibold tabular-nums ${bal > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{inr(bal)}</span>;
      },
    },
    {
      key: "actions", header: "", headClassName: "text-right", cellClassName: "text-right",
      cell: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => navigate(`/bundles/${b.id}`)}>Open order</DropdownMenuItem>
            {canMove && b.nextStatus && b.nextStatus !== "DELIVERED" && (
              <DropdownMenuItem onSelect={() => quickMove(b)}>{BUNDLE_NEXT_ACTION[b.nextStatus] ?? BUNDLE_STATUS_LABELS[b.nextStatus]}</DropdownMenuItem>
            )}
            {b.invoiceId && <DropdownMenuItem onSelect={() => navigate(`/billing/invoices/${b.invoiceId}`)}>View bill</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Stitching &amp; making work — track every order from sticker to hand-over</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-card p-1 rounded-lg border">
            <button type="button" onClick={() => switchView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${effectiveView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
              <List className="h-4 w-4" /> <span className="hidden sm:inline">List</span>
            </button>
            <button type="button" onClick={() => switchView("board")} disabled={showingDelivered}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 ${effectiveView === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
              <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Board</span>
            </button>
          </div>
          <Button variant="outline" onClick={() => navigate("/bundles/delivery")}><Truck className="mr-1.5 h-4 w-4" /> Goods Delivery</Button>
        </div>
      </div>

      {/* Scan / enter code */}
      <form onSubmit={(e) => { e.preventDefault(); openCode(code); }}
        className="flex gap-2 rounded-xl border bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
        <div className="flex flex-1 items-center gap-2 px-2">
          <ScanLine className="w-5 h-5 text-muted-foreground shrink-0" />
          <BaseInput ref={scanRef} value={code} onChange={(e) => setCode(e.target.value)} disabled={looking}
            placeholder="Scan sticker, or type order code / bill number…" autoComplete="off" spellCheck={false}
            className="h-10 flex-1 bg-transparent text-base font-mono uppercase outline-none placeholder:normal-case placeholder:font-sans" />
        </div>
        <Button type="button" variant="outline" className="h-10" onClick={() => setCameraOpen(true)} title="Scan with camera">
          <Camera className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Camera</span>
        </Button>
        <Button type="submit" className="h-10" disabled={looking || !code.trim()}>{looking ? "Opening…" : "Open"}</Button>
      </form>
      <BarcodeScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={(t) => openCode(t)} />

      {found && <FoundPanel bundles={found} canMove={canMove} onClose={() => setFound(null)}
        onReprint={reprintFound} onHandover={() => setHandover(true)} />}
      {found && handover && (
        <HandoverDialog bundles={found} onClose={() => setHandover(false)}
          onDone={(updated) => {
            setHandover(false);
            setFound((f) => f && f.map((b) => updated.find((u) => u.id === b.id) ?? b));
            load();
          }} />
      )}

      {/* KPI row — tiles double as quick filters */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button key={k.label} type="button" onClick={k.onClick} aria-pressed={k.active}
              className={`bg-card p-4 sm:p-5 rounded-xl border flex items-center gap-3 sm:gap-4 text-left transition-all hover:border-foreground/20 hover:shadow-sm ${k.active ? `ring-2 ${k.ring}` : ""}`}>
              <div className={`p-2.5 sm:p-3 rounded-lg ${k.tint}`}><Icon className="h-5 w-5" /></div>
              <div>
                <div className="text-xl sm:text-2xl font-bold">{k.value ?? "–"}</div>
                <div className="text-xs font-medium text-muted-foreground">{k.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar: search + dropdowns + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card px-3 h-9 rounded-lg border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input placeholder="Search code, customer, phone or bill..." value={q} onChange={(e) => setQ(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent h-8 px-0" />
        </div>
        <FilterSelect value={stage} onChange={(v) => setStage(v as Stage | "")}
          options={STAGES.map((s) => ({ value: s.key, label: s.label }))} placeholder="All Status" />
        <FilterSelect value={assignee} onChange={setAssignee}
          options={[{ value: "__none", label: "Unassigned" }, ...assignees.map((n) => ({ value: n, label: n }))]} placeholder="All Tailors" />
        <Button variant={activeFilterCount > 0 ? "secondary" : "outline"} className="h-9" onClick={() => setShowFilters(true)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </Button>
      </div>

      {/* Quick status tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[{ key: "" as const, label: "All Open", count: summary?.open }, ...STAGES.map((s) => ({ key: s.key, label: s.label, count: countOf(s.key) }))].map((t) => {
          const active = stage === t.key;
          return (
            <button key={t.key || "all"} type="button" onClick={() => setStage(t.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-accent"}`}>
              {t.label}
              {t.count !== undefined && (
                <span className={`text-[11px] px-1.5 rounded-full font-semibold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {effectiveView === "list" ? (
        <ResponsiveList
          items={pageRows}
          loading={loading}
          getRowKey={(b) => b.id}
          onRowClick={(b) => navigate(`/bundles/${b.id}`)}
          emptyIcon={ClipboardList}
          emptyTitle="No orders found"
          emptyDescription="No orders match your search or filters."
          columns={columns}
          renderCard={(b) => {
            const d = dueInfo(b);
            const bal = Number(b.balanceDue ?? 0);
            return (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold">{b.code}</span>
                    <StatusPill status={b.status} handoverMode={b.handoverMode} />
                  </div>
                  <div className="font-semibold truncate">{b.customerName || "Walk-in"}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.itemCount} item{b.itemCount === 1 ? "" : "s"}{b.assigneeName ? ` · ${b.assigneeName}` : ""}</div>
                  <div className="text-xs flex flex-wrap gap-x-2">
                    {d && <span className={d.tone}>{d.text}</span>}
                    {bal > 0 && <span className="font-semibold text-amber-600">{inr(bal)} due</span>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            );
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {columns3(stage).map((col) => {
            const items = filtered.filter((b) => b.status === col.key);
            return (
              <div key={col.key} className="bg-muted/40 rounded-xl border p-3 flex flex-col">
                <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs font-medium text-muted-foreground bg-card rounded-full px-2 py-0.5 border">{items.length}</span>
                </div>
                <div className="space-y-2.5 min-h-[80px]">
                  {items.map((b) => <OrderCard key={b.id} b={b} canMove={canMove} onMove={() => quickMove(b)} />)}
                  {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">{loading ? "Loading…" : "No orders"}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {effectiveView === "list" && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{from}</span> to <span className="font-medium text-foreground">{to}</span> of <span className="font-medium text-foreground">{filtered.length}</span> orders
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rows</span>
              <FilterSelect value={String(size)} onChange={(v) => setSize(Number(v) || 10)}
                options={[{ value: "10", label: "10" }, { value: "25", label: "25" }, { value: "50", label: "50" }]} placeholder="10" />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters sheet (mobile-friendly mirror of the dropdowns) */}
      <FilterSheet open={showFilters} onClose={() => setShowFilters(false)} activeCount={activeFilterCount}
        onClear={() => { setAssignee(""); setInstallOnly(false); setDueOnly(false); setOverdueOnly(false); }}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tailor / installer</label>
          <FilterSelect value={assignee} onChange={setAssignee}
            options={[{ value: "__none", label: "Unassigned" }, ...assignees.map((n) => ({ value: n, label: n }))]} placeholder="All Tailors" />
        </div>
        {([
          [overdueOnly, setOverdueOnly, "Overdue only"],
          [installOnly, setInstallOnly, "Install orders only"],
          [dueOnly, setDueOnly, "Balance still due on the bill"],
        ] as [boolean, (v: boolean) => void, string][]).map(([on, set, label]) => (
          <label key={label} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4" /> {label}
          </label>
        ))}
      </FilterSheet>
    </div>
  );
}

const columns3 = (stage: Stage | "") =>
  stage && stage !== "DELIVERED" ? OPEN_STAGES.filter((s) => s.key === stage) : OPEN_STAGES;

/** Small styled native select that matches the toolbar pill look in both themes. */
function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-card border rounded-lg pl-3 pr-8 h-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function Owner({ name }: { name?: string | null }) {
  if (!name) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{initials(name)}</span>
      <span className="text-sm truncate">{name}</span>
    </div>
  );
}

/** What a bill number (or group code) found: its orders, the money still owed, reprint + hand over. */
function FoundPanel({ bundles, canMove, onClose, onReprint, onHandover }: {
  bundles: Bundle[]; canMove: boolean; onClose: () => void; onReprint: () => void; onHandover: () => void;
}) {
  const first = bundles[0];
  const due = Number(first?.balanceDue ?? 0);
  const openCount = bundles.filter((b) => b.status !== "DELIVERED" && b.status !== "CANCELLED").length;
  const readyCount = bundles.filter((b) => b.status === "COMPLETED").length;
  const install = first?.handoverMode === "INSTALL";
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 border-b">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">
            {first?.invoiceNumber ? <>Bill <Link className="hover:underline" to={`/billing/invoices/${first.invoiceId}`}>{first.invoiceNumber}</Link></> : first?.groupCode}
            <span className="ml-2 font-normal text-slate-500">{first?.customerName || "Walk-in"}{first?.customerPhone ? ` · ${first.customerPhone}` : ""}</span>
          </div>
          <div className="text-xs text-slate-500">
            {bundles.length} order{bundles.length === 1 ? "" : "s"} · {readyCount} completed{install && " · install"}
            {first?.invoiceId && (due > 0
              ? <span className="ml-2 font-semibold text-amber-700">₹{due.toLocaleString("en-IN")} due</span>
              : <span className="ml-2 font-medium text-emerald-700">Paid</span>)}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onReprint}><Printer className="w-4 h-4 mr-1" /> Reprint {bundles.length > 1 ? "all" : "sticker"}</Button>
          {canMove && openCount > 0 && <Button size="sm" onClick={onHandover}><HandCoins className="w-4 h-4 mr-1" /> {install ? "Mark installed" : "Hand over"}</Button>}
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700" title="Close"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <ul className="divide-y text-sm">
        {bundles.map((b) => (
          <li key={b.id}>
            <Link to={`/bundles/${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-slate-50">
              <span className="font-mono font-bold text-slate-800">{b.code}</span>
              <StatusPill status={b.status} handoverMode={b.handoverMode} />
              <span className="text-slate-500">{b.itemCount} item{b.itemCount === 1 ? "" : "s"}</span>
              {b.rackLocation && <span className="text-slate-500">· {b.rackLocation}</span>}
              {b.dueDate && <span className={b.overdue ? "text-red-600" : "text-slate-500"}>· due {b.dueDate}</span>}
              <ChevronRight className="ml-auto w-4 h-4 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusPill({ status, handoverMode }: { status: string; handoverMode?: string | null }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${BUNDLE_STATUS_STYLES[status] ?? ""}`}>
      {statusLabel({ status, handoverMode })}
    </span>
  );
}

function OrderCard({ b, canMove, onMove }: { b: Bundle; canMove: boolean; onMove: () => void }) {
  const due = dueInfo(b);
  const bal = Number(b.balanceDue ?? 0);
  const urgent = b.priority === "HIGH" || b.priority === "URGENT";
  const install = b.handoverMode === "INSTALL";
  const who = install && b.installerName ? b.installerName : b.assigneeName;
  return (
    <div className={`rounded-xl border bg-white shadow-sm transition hover:shadow-md ${b.overdue ? "border-red-300" : ""}`}>
      <Link to={`/bundles/${b.id}`} className="block p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-sm font-bold text-slate-900">{b.code}</div>
            <div className="text-sm text-slate-700 truncate">{b.customerName || "Walk-in"}</div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {urgent && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">{b.priority}</span>}
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${install ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
              {HANDOVER_LABELS[b.handoverMode] ?? b.handoverMode}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{b.itemCount} item{b.itemCount === 1 ? "" : "s"}{b.rackLocation ? ` · ${b.rackLocation}` : ""}</span>
          {due && (
            <span className={`inline-flex items-center gap-1 ${due.tone}`}>
              {b.overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{due.text}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          {who ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
              <span className="h-5 w-5 shrink-0 rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 inline-flex items-center justify-center">{initials(who)}</span>
              <span className="truncate">{who}</span>
            </span>
          ) : <span className="text-xs text-slate-400">Unassigned</span>}
          {b.invoiceId && (bal > 0
            ? <span className="text-xs font-semibold text-amber-700">{inr(bal)} due</span>
            : <span className="text-xs text-emerald-700">Paid</span>)}
        </div>
      </Link>
      {canMove && b.nextStatus && (
        <button onClick={onMove}
          className="w-full rounded-b-xl border-t bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-800 hover:text-white transition">
          {b.nextStatus === "DELIVERED" && install ? "Mark installed" : (BUNDLE_NEXT_ACTION[b.nextStatus] ?? BUNDLE_STATUS_LABELS[b.nextStatus])} →
        </button>
      )}
    </div>
  );
}

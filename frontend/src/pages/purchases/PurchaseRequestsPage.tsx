import { useEffect, useState } from "react";
import api from "@/lib/api";
import { purchaseApi } from "@/api/purchaseApi";
import { inventoryApi } from "@/api/inventoryApi";
import type { PurchaseRequest } from "@/types/purchase";
import { PR_STATUS_TONE, PRIORITY_TONE } from "@/types/purchase";
import type { Product, Warehouse } from "@/types/inventory";
import ProductSearchSelect from "@/pages/inventory/components/ProductSearchSelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2, ChevronDown, ChevronUp, CheckCircle2, XCircle, ArrowRightCircle } from "lucide-react";

const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED", "CONVERTED"] as const;
const SOURCES = ["INVENTORY", "PROJECT_MANAGER", "SITE_ENGINEER", "STORE_KEEPER", "EMPLOYEE_REQUEST"] as const;

interface PrLine { product: Product | null; quantity: number; estimatedUnitPrice?: number; notes?: string }

export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [projects, setProjects] = useState<{ id: number; label: string }[]>([]);
  const [form, setForm] = useState<any>({ priority: "MEDIUM", source: "PROJECT_MANAGER", approvalLevels: 1 });
  const [lines, setLines] = useState<PrLine[]>([{ product: null, quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  const load = () => purchaseApi.getPurchaseRequests(filter === "ALL" ? undefined : filter).then(setRequests).catch(console.error);

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isCreateOpen) return;
    inventoryApi.getWarehouses().then(setWarehouses).catch(console.error);
    api.get("/projects?size=200").then((res) => setProjects(
      (res.data.content || res.data || []).map((p: any) => ({ id: p.id, label: p.projectName }))
    )).catch(console.error);
  }, [isCreateOpen]);

  const runScan = () => {
    setScanning(true);
    purchaseApi.triggerLowStockScan()
      .then((r) => { alert(`Created ${r.created} low-stock purchase request(s).`); load(); })
      .finally(() => setScanning(false));
  };

  const submit = () => {
    const items = lines.filter((l) => l.product && l.quantity > 0)
      .map((l) => ({ productId: l.product!.id, quantity: l.quantity, estimatedUnitPrice: l.estimatedUnitPrice, notes: l.notes }));
    if (items.length === 0) return alert("Add at least one material line");
    setSaving(true);
    purchaseApi.createPurchaseRequest({
      projectId: form.projectId ? Number(form.projectId) : undefined,
      warehouseId: form.warehouseId ? Number(form.warehouseId) : undefined,
      priority: form.priority,
      requiredDate: form.requiredDate || undefined,
      reason: form.reason,
      source: form.source,
      approvalLevels: Number(form.approvalLevels) || 1,
      items,
    })
      .then(() => {
        setIsCreateOpen(false);
        setForm({ priority: "MEDIUM", source: "PROJECT_MANAGER", approvalLevels: 1 });
        setLines([{ product: null, quantity: 1 }]);
        load();
      })
      .catch((e) => alert(e?.response?.data?.message || "Failed to create purchase request"))
      .finally(() => setSaving(false));
  };

  const approve = (id: number) => {
    const comments = window.prompt("Approval comments (optional):") ?? "";
    purchaseApi.approvePurchaseRequest(id, comments).then(load).catch((e) => alert(e?.response?.data?.message || "Failed to approve"));
  };
  const reject = (id: number) => {
    const reason = window.prompt("Rejection reason:") ?? "";
    purchaseApi.rejectPurchaseRequest(id, reason).then(load).catch((e) => alert(e?.response?.data?.message || "Failed to reject"));
  };
  const convert = (id: number) => {
    purchaseApi.convertPurchaseRequest(id)
      .then((orders) => { alert(`Created ${orders.length} purchase order(s): ${orders.map((o) => o.poNumber).join(", ")}`); load(); })
      .catch((e) => alert(e?.response?.data?.message || "Failed to convert"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-white border rounded-xl p-1">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg ${filter === s ? "bg-primary text-primary-foreground" : "text-slate-500 hover:text-slate-800"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runScan} disabled={scanning}>
            <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? "animate-spin" : ""}`} /> Low-Stock Scan
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Request</Button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden divide-y">
        {requests.map((r) => (
          <div key={r.id}>
            <div className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 text-sm">{r.requestNumber}</span>
                  <Badge className={PR_STATUS_TONE[r.status]}>{r.status}</Badge>
                  <Badge className={PRIORITY_TONE[r.priority] || PRIORITY_TONE.MEDIUM}>{r.priority}</Badge>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{r.source?.replaceAll("_", " ")}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.items?.length ? `${r.items.length} item(s)` : r.product ? `${r.product.name} × ${r.quantity}` : "—"}
                  {r.project?.projectName ? ` · ${r.project.projectName}` : ""}
                  {r.requiredDate ? ` · needed by ${r.requiredDate}` : ""}
                  {r.requestedBy?.name ? ` · by ${r.requestedBy.name}` : r.triggeredBy === "SYSTEM" ? " · system generated" : ""}
                  {r.status === "PENDING" && r.approvalLevels > 1 ? ` · approval ${r.currentLevel}/${r.approvalLevels}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.status === "PENDING" && (
                  <>
                    <Button size="sm" onClick={() => approve(r.id)}><CheckCircle2 className="w-4 h-4 mr-1" /> Approve</Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => reject(r.id)}><XCircle className="w-4 h-4 mr-1" /> Reject</Button>
                    {r.triggeredBy === "SYSTEM" && (
                      <Button size="sm" variant="outline" onClick={() => convert(r.id)}><ArrowRightCircle className="w-4 h-4 mr-1" /> Convert</Button>
                    )}
                  </>
                )}
                {r.status === "APPROVED" && (
                  <Button size="sm" onClick={() => convert(r.id)}><ArrowRightCircle className="w-4 h-4 mr-1" /> Convert to PO</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  {expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {expanded === r.id && (
              <div className="px-4 pb-4 space-y-3 bg-slate-50/60">
                {r.reason && <p className="text-xs text-slate-600 pt-3"><span className="font-bold">Reason:</span> {r.reason}</p>}
                {(r.items?.length ?? 0) > 0 && (
                  <div className="border rounded-lg bg-white overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-slate-400 border-b">
                        <th className="p-2">Material</th><th className="p-2">Qty</th><th className="p-2">Est. Price</th><th className="p-2">Notes</th>
                      </tr></thead>
                      <tbody>
                        {r.items.map((it, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-2 font-semibold text-slate-700">{it.product?.name}</td>
                            <td className="p-2">{it.quantity} {it.product?.unit}</td>
                            <td className="p-2">{it.estimatedUnitPrice ? `₹${it.estimatedUnitPrice}` : "—"}</td>
                            <td className="p-2 text-slate-500">{it.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(r.approvals?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.approvals.map((a) => (
                      <div key={a.id} className="text-xs bg-white border rounded-lg px-3 py-1.5">
                        <span className="font-bold">L{a.level}</span>{" "}
                        <span className={a.status === "APPROVED" ? "text-emerald-600" : a.status === "REJECTED" ? "text-red-600" : "text-amber-600"}>{a.status}</span>
                        {a.approver?.name ? ` · ${a.approver.name}` : ""}{a.comments ? ` · "${a.comments}"` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No purchase requests found.</div>}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Requested As</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm" value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Project (optional)</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm" value={form.projectId || ""}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">— None —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Deliver To Warehouse</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm" value={form.warehouseId || ""}
                  onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
                  <option value="">— Select —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Required By</Label>
                <Input type="date" value={form.requiredDate || ""} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Approval Levels</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm" value={form.approvalLevels}
                  onChange={(e) => setForm({ ...form, approvalLevels: e.target.value })}>
                  <option value={1}>1 — Manager</option>
                  <option value={2}>2 — Manager + Admin</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="Why is this material needed?" value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>

            <div className="border rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                <span className="font-bold text-sm text-slate-700">Materials</span>
                <Button size="sm" variant="outline" onClick={() => setLines([...lines, { product: null, quantity: 1 }])}>
                  <Plus className="w-4 h-4 mr-1" /> Add Line
                </Button>
              </div>
              <div className="divide-y">
                {lines.map((line, idx) => (
                  <div key={idx} className="p-3 grid grid-cols-1 sm:grid-cols-[1fr_90px_120px_40px] gap-2 items-start">
                    <ProductSearchSelect value={line.product} onChange={(p) => {
                      const next = [...lines]; next[idx].product = p;
                      if (p?.purchasePrice || p?.costPrice) next[idx].estimatedUnitPrice = p.purchasePrice || p.costPrice;
                      setLines(next);
                    }} />
                    <Input type="number" min={1} value={line.quantity}
                      onChange={(e) => { const next = [...lines]; next[idx].quantity = parseInt(e.target.value) || 0; setLines(next); }} />
                    <Input type="number" step="0.01" placeholder="Est. price" value={line.estimatedUnitPrice ?? ""}
                      onChange={(e) => { const next = [...lines]; next[idx].estimatedUnitPrice = parseFloat(e.target.value) || undefined; setLines(next); }} />
                    <Button variant="ghost" size="icon" className="text-red-500"
                      onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit Purchase Request"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

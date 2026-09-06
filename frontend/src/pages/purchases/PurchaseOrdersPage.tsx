import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { purchaseApi } from "@/api/purchaseApi";
import type { PurchaseOrder, Supplier } from "@/types/purchase";
import { PO_STATUSES, PO_STATUS_TONE } from "@/types/purchase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SearchableSelect from "@/components/ui/searchable-select";
import { useHoverInfo, InfoRow } from "@/components/ui/hover-info";
import { Plus, ArrowRight, Search } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const humanizeStatus = (s: string) =>
  s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

// The clickable filter tiles: "All" plus every PO status, each with a live count.
const TILE_STATUSES = ["", ...PO_STATUSES];

/** Rich card shown when hovering a PO row. */
function POInfo({ po }: { po: PurchaseOrder }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-800">{po.poNumber}</span>
        <Badge className={PO_STATUS_TONE[po.status]}>{humanizeStatus(po.status)}</Badge>
      </div>
      <div className="divide-y divide-slate-100">
        <div className="pb-1.5">
          <InfoRow label="Supplier" value={po.supplier?.name} />
          <InfoRow label="Contact" value={po.supplier?.contactPerson} />
          <InfoRow label="Phone" value={po.supplier?.phone} />
        </div>
        <div className="py-1.5">
          <InfoRow label="Project" value={po.project?.projectName} />
          <InfoRow label="Warehouse" value={po.warehouse?.name} />
          <InfoRow label="Order date" value={po.date ? format(new Date(po.date), "MMM d, yyyy") : undefined} />
          <InfoRow label="Expected" value={po.expectedDeliveryDate} />
          <InfoRow label="Payment terms" value={po.paymentTerms} />
        </div>
        <div className="pt-1.5">
          <InfoRow label="Subtotal" value={po.subtotal != null ? currency(po.subtotal) : undefined} />
          <InfoRow label="Tax" value={po.taxAmount ? currency(po.taxAmount) : undefined} />
          <InfoRow label="Transport" value={po.transportationCost ? currency(po.transportationCost) : undefined} />
          <InfoRow label="Discount" value={po.discountAmount ? `− ${currency(po.discountAmount)}` : undefined} />
          <InfoRow label="Total" value={currency(po.totalAmount)} accent="text-slate-900 font-bold" />
        </div>
        {po.notes && <p className="pt-2 text-xs italic text-slate-500">“{po.notes}”</p>}
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const info = useHoverInfo();

  useEffect(() => { purchaseApi.getSuppliers().then(setSuppliers).catch(console.error); }, []);

  // Per-status counts for the filter tiles (one broad fetch; refreshed only on mount).
  useEffect(() => {
    purchaseApi.getPurchaseOrders({ size: 1000 })
      .then((res) => {
        const c: Record<string, number> = { "": res.totalElements ?? (res.content || []).length };
        (res.content || []).forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
        setCounts(c);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      purchaseApi.getPurchaseOrders({
        page, size: 15,
        status: status || undefined,
        supplierId: supplierId ? Number(supplierId) : undefined,
        search: search || undefined,
      }).then((res) => { setOrders(res.content || []); setTotalPages(res.totalPages || 0); }).catch(console.error);
    }, 250);
    return () => clearTimeout(t);
  }, [page, status, supplierId, search]);

  return (
    <div className="space-y-4">
      {/* Status filter tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {TILE_STATUSES.map((s) => {
          const active = status === s;
          const label = s === "" ? "All Orders" : humanizeStatus(s);
          const dot = s === "" ? "bg-slate-400" : ((PO_STATUS_TONE[s]?.split(" ")[0] || "bg-slate-300").replace("-100", "-500").replace("-200", "-500"));
          return (
            <button
              key={s || "all"}
              type="button"
              onClick={() => { setStatus(s); setPage(0); }}
              aria-pressed={active}
              className={`rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow ${active ? "ring-2 ring-primary border-primary" : ""}`}
            >
              <span className="text-lg font-black leading-none text-slate-800">{counts[s] ?? 0}</span>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <span className="text-xs font-semibold text-slate-500 truncate">{label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input className="pl-9 w-56" placeholder="Search PO / supplier…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <div className="w-52">
            <SearchableSelect value={supplierId} onChange={(v) => { setSupplierId(v); setPage(0); }}
              options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
              placeholder="All suppliers" clearLabel="All suppliers" />
          </div>
        </div>
        <Link to="/purchases/orders/new">
          <Button><Plus className="w-4 h-4 mr-2" /> Create Purchase Order</Button>
        </Link>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>PO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="hidden md:table-cell">Project</TableHead>
                <TableHead className="hidden md:table-cell">Expected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow key={po.id} {...info.bind(<POInfo po={po} />)}>
                  <TableCell className="font-bold text-slate-800">{po.poNumber}</TableCell>
                  <TableCell className="text-slate-500">{po.date ? format(new Date(po.date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="font-semibold text-slate-700">{po.supplier?.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-slate-500">{po.project?.projectName || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-slate-500">{po.expectedDeliveryDate || "—"}</TableCell>
                  <TableCell><Badge className={PO_STATUS_TONE[po.status]}>{po.status}</Badge></TableCell>
                  <TableCell className="text-right font-black text-slate-800">{currency(po.totalAmount)}</TableCell>
                  <TableCell>
                    <Link to={`/purchases/orders/${po.id}`}>
                      <Button variant="ghost" size="icon"><ArrowRight className="w-4 h-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No purchase orders found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 p-3 border-t">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </div>
      {info.portal}
    </div>
  );
}

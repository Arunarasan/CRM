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
import { Plus, ArrowRight, Search } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => { purchaseApi.getSuppliers().then(setSuppliers).catch(console.error); }, []);

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
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input className="pl-9 w-56" placeholder="Search PO / supplier…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <select className="h-10 rounded-md border border-input px-3 text-sm" value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            {PO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
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
                <TableRow key={po.id}>
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
    </div>
  );
}

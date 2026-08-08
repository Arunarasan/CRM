import { useEffect, useState } from "react";
import { inventoryApi } from "@/api/inventoryApi";
import type { InventoryTransaction, Product, Warehouse } from "@/types/inventory";
import { STOCK_ENTRY_TYPES } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeftRight, ScanLine } from "lucide-react";
import { format } from "date-fns";
import ProductSearchSelect from "./components/ProductSearchSelect";
import BarcodeScanner from "./components/BarcodeScanner";

const NEEDS_SOURCE = ["CONSUMPTION", "TRANSFER"];
const NEEDS_DEST = ["OPENING", "PURCHASE", "ADJUSTMENT", "PROJECT_RETURN", "SUPPLIER_RETURN", "TRANSFER"];

const TYPE_LABEL: Record<string, string> = {
  OPENING: "Opening Stock",
  PURCHASE: "Purchase Receipt",
  ADJUSTMENT: "Manual Adjustment",
  PROJECT_RETURN: "Project Return",
  SUPPLIER_RETURN: "Supplier Return",
  CONSUMPTION: "Consumption",
  TRANSFER: "Stock Transfer",
};

export default function StockMovement() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [type, setType] = useState<string>("PURCHASE");
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [reference, setReference] = useState("");

  const load = () => inventoryApi.getRecentTransactions().then(setTransactions);

  useEffect(() => {
    inventoryApi.getWarehouses().then(setWarehouses);
    load();
  }, []);

  const submit = () => {
    if (!product) { alert("Select a material first"); return; }
    const payload: Record<string, unknown> = {
      type,
      quantity,
      reference,
      product: { id: product.id },
      sourceWarehouse: sourceWarehouseId ? { id: Number(sourceWarehouseId) } : null,
      destinationWarehouse: destinationWarehouseId ? { id: Number(destinationWarehouseId) } : null,
    };
    inventoryApi.processTransaction(payload)
      .then(() => { setProduct(null); setQuantity(1); setReference(""); load(); })
      .catch(() => alert("Failed to record stock entry"));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-primary" /> Stock Entry</h2>
          <Button variant="outline" size="sm" onClick={() => setScannerOpen(true)}><ScanLine className="w-4 h-4 mr-1" /> Scan</Button>
        </div>

        <div className="space-y-2">
          <Label>Entry Type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STOCK_ENTRY_TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`p-2 rounded-lg border text-xs font-bold transition-all ${type === t ? "bg-primary text-primary-foreground border-primary" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {TYPE_LABEL[t] || t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Material</Label>
          <ProductSearchSelect value={product} onChange={setProduct} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Quantity</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO / Invoice #" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {NEEDS_SOURCE.includes(type) && (
            <div className="space-y-1">
              <Label>Source Warehouse</Label>
              <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)}>
                <option value="">Select...</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          {NEEDS_DEST.includes(type) && (
            <div className="space-y-1">
              <Label>Destination Warehouse</Label>
              <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)}>
                <option value="">Select...</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <Button size="lg" className="w-full font-bold" onClick={submit}>Record Entry</Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Movement History</h3>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last 50</span>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[560px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-white sticky top-0">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Movement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs text-slate-500">{tx.date ? format(new Date(tx.date), "MMM d, HH:mm") : "-"}</TableCell>
                  <TableCell><span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">{tx.type}</span></TableCell>
                  <TableCell className="font-semibold text-slate-800 text-sm">{tx.product?.name}</TableCell>
                  <TableCell className="text-xs">
                    {tx.sourceWarehouse?.name && <span className="text-red-500">From {tx.sourceWarehouse.name} </span>}
                    {tx.destinationWarehouse?.name && <span className="text-green-600">To {tx.destinationWarehouse.name}</span>}
                    <div className="font-black text-slate-900">{tx.quantity} {tx.product?.unit}</div>
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No movement yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetect={(code) => {
        inventoryApi.findByBarcode(code).then(setProduct).catch(() => alert(`No material found for code ${code}`));
      }} />
    </div>
  );
}

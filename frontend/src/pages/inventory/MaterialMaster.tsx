import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { inventoryApi } from "@/api/inventoryApi";
import type { InventoryCategory, Product, Warehouse } from "@/types/inventory";
import { INVENTORY_UNITS } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, ScanLine, QrCode } from "lucide-react";
import BarcodeScanner from "./components/BarcodeScanner";

const emptyForm: Partial<Product> = { unit: INVENTORY_UNITS[0], status: "ACTIVE", minStockLevel: 10 };

function Barcode({ value }: { value: string }) {
  const ref = (el: SVGSVGElement | null) => {
    if (el && value) {
      try { JsBarcode(el, value, { format: "CODE128", height: 32, fontSize: 11, margin: 4 }); } catch { /* invalid for barcode charset */ }
    }
  };
  return <svg ref={ref} />;
}

export default function MaterialMaster() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [codeDialogProduct, setCodeDialogProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => {
    inventoryApi.getProducts({ search, size: 50 }).then((r) => setProducts(r.content || []));
  };

  useEffect(() => { load(); }, [search]);
  useEffect(() => {
    inventoryApi.getCategories().then(setCategories);
    inventoryApi.getWarehouses().then(setWarehouses);
  }, []);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (p: Product) => { setForm(p); setEditingId(p.id); setDialogOpen(true); };

  const save = () => {
    const payload = { ...form } as any;
    if (payload.category?.id) payload.category = { id: payload.category.id };
    if (payload.defaultWarehouse?.id) payload.defaultWarehouse = { id: payload.defaultWarehouse.id };
    const action = editingId ? inventoryApi.updateProduct(editingId, payload) : inventoryApi.createProduct(payload);
    action.then(() => { setDialogOpen(false); load(); }).catch(() => alert("Failed to save material"));
  };

  const handleScanResult = (code: string) => {
    inventoryApi.findByBarcode(code)
      .then((p) => setSearch(p.materialCode || p.sku || code))
      .catch(() => alert(`No material found for code ${code}`));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name, code, barcode, brand..." className="pl-9 bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScannerOpen(true)}><ScanLine className="w-4 h-4 mr-2" /> Scan</Button>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Material</Button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Codes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(p)}>
                  <TableCell className="font-mono text-xs font-bold text-slate-500">{p.materialCode || p.sku}</TableCell>
                  <TableCell className="font-bold text-slate-800">{p.name}</TableCell>
                  <TableCell>{p.category?.name || "—"}</TableCell>
                  <TableCell>{p.brand || "—"}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell className="text-right">₹{p.costPrice ?? p.price ?? 0}</TableCell>
                  <TableCell className="text-right">₹{p.sellingPrice ?? p.price ?? 0}</TableCell>
                  <TableCell><Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setCodeDialogProduct(p); }}>
                      <QrCode className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No materials found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Material" : "Add New Material"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Material Name</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>SKU</Label>
              <Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Brand</Label>
              <Input value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={form.category?.id ?? ""}
                onChange={(e) => setForm({ ...form, category: e.target.value ? { id: Number(e.target.value) } : null })}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={form.unit || ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {INVENTORY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Default Warehouse</Label>
              <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={form.defaultWarehouse?.id ?? ""}
                onChange={(e) => setForm({ ...form, defaultWarehouse: e.target.value ? { id: Number(e.target.value) } : null })}>
                <option value="">—</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>HSN Code</Label>
              <Input value={form.hsnCode || ""} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>GST %</Label>
              <Input type="number" value={form.gstPercent ?? ""} onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Cost Price</Label>
              <Input type="number" value={form.costPrice ?? ""} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Selling Price</Label>
              <Input type="number" value={form.sellingPrice ?? ""} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Min Stock Level</Label>
              <Input type="number" value={form.minStockLevel ?? ""} onChange={(e) => setForm({ ...form, minStockLevel: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Max Stock Level</Label>
              <Input type="number" value={form.maxStockLevel ?? ""} onChange={(e) => setForm({ ...form, maxStockLevel: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Reorder Level</Label>
              <Input type="number" value={form.reorderLevel ?? ""} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Lead Time (days)</Label>
              <Input type="number" value={form.leadTimeDays ?? ""} onChange={(e) => setForm({ ...form, leadTimeDays: Number(e.target.value) })} />
            </div>
            {editingId && (
              <div className="space-y-1">
                <Label>Status</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={form.status || "ACTIVE"}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name}>Save Material</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode / QR display dialog */}
      <Dialog open={!!codeDialogProduct} onOpenChange={(v) => !v && setCodeDialogProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{codeDialogProduct?.name}</DialogTitle></DialogHeader>
          {codeDialogProduct && (
            <div className="flex flex-col items-center gap-4 py-2">
              <QRCodeSVG value={codeDialogProduct.qrCode || codeDialogProduct.materialCode || ""} size={140} />
              <Barcode value={codeDialogProduct.barcode || codeDialogProduct.materialCode || ""} />
              <p className="text-xs font-mono text-muted-foreground">{codeDialogProduct.materialCode}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetect={handleScanResult} />
    </div>
  );
}

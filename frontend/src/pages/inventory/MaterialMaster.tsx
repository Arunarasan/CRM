import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { inventoryApi } from "@/api/inventoryApi";
import { toast } from "@/components/ui/toast";
import SearchableSelect from "@/components/ui/searchable-select";
import type { InventoryCategory, Product, Warehouse } from "@/types/inventory";
import {
  INVENTORY_UNITS, PRODUCT_TYPES, FABRIC_WIDTHS, FABRIC_PATTERNS, COLOR_FAMILIES,
  CURTAIN_SIZES, WINDOW_TYPES, MOUNTING_TYPES, OPACITY_LEVELS, ROOM_TYPES, DESIGN_STYLES,
} from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, ScanLine, QrCode, X } from "lucide-react";
import { useHoverInfo, InfoRow } from "@/components/ui/hover-info";
import BarcodeScanner from "./components/BarcodeScanner";
import ImageCaptureField from "@/components/ImageCaptureField";
import MultiImageCaptureField from "@/components/MultiImageCaptureField";
import { resolveFileUrl } from "@/lib/uploadFile";

const emptyForm: Partial<Product> = { unit: INVENTORY_UNITS[0], status: "ACTIVE", minStockLevel: 10 };

function Barcode({ value }: { value: string }) {
  const ref = (el: SVGSVGElement | null) => {
    if (el && value) {
      try { JsBarcode(el, value, { format: "CODE128", height: 32, fontSize: 11, margin: 4 }); } catch { /* invalid for barcode charset */ }
    }
  };
  return <svg ref={ref} />;
}

/** Full-width section divider with a heading inside the form grid. */
function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-2 mt-2 border-b pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}

/** Labeled dropdown built from a readonly options list, with a blank "— none —" option. */
function PickOne({ label, value, options, onChange }: {
  label: string; value?: string; options: readonly string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={value || ""}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">— none —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/** Toggle-chip multi-select for list attributes (window types, rooms, sizes…). */
function CheckChips({ label, value, options, onChange }: {
  label: string; value?: string[]; options: readonly string[]; onChange: (v: string[]) => void;
}) {
  const selected = value || [];
  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
  return (
    <div className="col-span-2 space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button type="button" key={o} onClick={() => toggle(o)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on ? "border-primary bg-primary text-primary-foreground"
                   : "border-input bg-background text-slate-600 hover:border-primary"}`}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Rich card shown when hovering a material row. */
function ProductInfo({ p }: { p: Product }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        {p.imageUrl
          ? <img src={resolveFileUrl(p.imageUrl)} alt="" className="h-12 w-12 shrink-0 rounded-lg border object-cover" />
          : <div className="h-12 w-12 shrink-0 rounded-lg border bg-slate-100" />}
        <div className="min-w-0">
          <div className="font-bold text-slate-800 truncate">{p.name}</div>
          <div className="font-mono text-[11px] text-slate-400">{p.materialCode || p.sku}</div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        <div className="pb-1.5">
          <InfoRow label="Category" value={p.category?.name} />
          <InfoRow label="Brand" value={p.brand} />
          <InfoRow label="Unit" value={p.unit} />
          <InfoRow label="Status" value={p.status} accent={p.status === "ACTIVE" ? "text-emerald-600" : "text-slate-500"} />
        </div>
        <div className="py-1.5">
          <InfoRow label="Cost price" value={`₹${p.costPrice ?? p.price ?? 0}`} />
          <InfoRow label="Selling price" value={`₹${p.sellingPrice ?? p.price ?? 0}`} accent="text-slate-900 font-bold" />
          <InfoRow label="GST" value={p.gstPercent != null ? `${p.gstPercent}%` : undefined} />
          <InfoRow label="HSN" value={p.hsnCode} />
        </div>
        <div className="py-1.5">
          <InfoRow label="Min stock" value={p.minStockLevel != null ? `${p.minStockLevel} ${p.unit}` : undefined} />
          <InfoRow label="Reorder at" value={p.reorderLevel != null ? `${p.reorderLevel} ${p.unit}` : undefined} />
          <InfoRow label="Max stock" value={p.maxStockLevel != null ? `${p.maxStockLevel} ${p.unit}` : undefined} />
          <InfoRow label="Lead time" value={p.leadTimeDays != null ? `${p.leadTimeDays} days` : undefined} />
        </div>
        {(p.fabricComposition || p.color || p.productType) && (
          <div className="pt-1.5">
            <InfoRow label="Fabric" value={p.fabricComposition} />
            <InfoRow label="Colour" value={p.color} />
            <InfoRow label="Type" value={p.productType} />
          </div>
        )}
      </div>
    </div>
  );
}

type StatusFilter = "" | "ACTIVE" | "INACTIVE";
type StockFilter = "" | "low" | "out";

const STOCK_PILL: Record<Exclude<StockFilter, "">, { label: string; tone: string }> = {
  low: { label: "Low stock", tone: "bg-orange-100 text-orange-700" },
  out: { label: "Out of stock", tone: "bg-red-100 text-red-700" },
};

export default function MaterialMaster() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<number, number>>({});
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "");
  const [stockFilter, setStockFilter] = useState<StockFilter>(
    (searchParams.get("stock") as StockFilter) || "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [codeDialogProduct, setCodeDialogProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const info = useHoverInfo();

  const load = () => {
    inventoryApi.getProducts({ size: 1000 }).then((r) => setAllProducts(r.content || []));
    // On-hand available stock per product, summed across warehouses.
    inventoryApi.getAllStock().then((rows) => {
      const map: Record<number, number> = {};
      rows.forEach((it) => {
        const pid = it.product?.id;
        if (pid != null) map[pid] = (map[pid] || 0) + (it.availableQuantity ?? 0);
      });
      setStockByProduct(map);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    inventoryApi.getCategories().then(setCategories);
    inventoryApi.getWarehouses().then(setWarehouses);
  }, []);

  // A product's low-stock threshold: reorder level, else min stock, else 0.
  const threshold = (p: Product) => p.reorderLevel ?? p.minStockLevel ?? 0;
  const onHand = (p: Product) => stockByProduct[p.id] ?? 0;
  const isOut = (p: Product) => onHand(p) <= 0;
  const isLow = (p: Product) => { const q = onHand(p); return q > 0 && q <= threshold(p); };

  // Search + status + stock filtering happen client-side over the loaded set.
  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (statusFilter && (p.status || "ACTIVE") !== statusFilter) return false;
      if (stockFilter === "low" && !isLow(p)) return false;
      if (stockFilter === "out" && !isOut(p)) return false;
      if (!q) return true;
      return [p.name, p.materialCode, p.sku, p.brand, p.barcode]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, search, statusFilter, stockFilter, stockByProduct]);

  const counts = useMemo(() => ({
    "": allProducts.length,
    ACTIVE: allProducts.filter((p) => (p.status || "ACTIVE") === "ACTIVE").length,
    INACTIVE: allProducts.filter((p) => p.status === "INACTIVE").length,
  }), [allProducts]);

  const clearStockFilter = () => {
    setStockFilter("");
    const next = new URLSearchParams(searchParams);
    next.delete("stock");
    setSearchParams(next, { replace: true });
  };

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (p: Product) => { setForm(p); setEditingId(p.id); setDialogOpen(true); };

  const save = () => {
    const payload = { ...form } as any;
    if (payload.category?.id) payload.category = { id: payload.category.id };
    if (payload.defaultWarehouse?.id) payload.defaultWarehouse = { id: payload.defaultWarehouse.id };
    const action = editingId ? inventoryApi.updateProduct(editingId, payload) : inventoryApi.createProduct(payload);
    action.then(() => { setDialogOpen(false); load(); toast.success("Material saved."); }).catch(() => toast.error("Failed to save material."));
  };

  const handleScanResult = (code: string) => {
    inventoryApi.findByBarcode(code)
      .then((p) => setSearch(p.materialCode || p.sku || code))
      .catch(() => toast.error(`No material found for code ${code}`));
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

      {/* Status filter tiles */}
      <div className="grid grid-cols-3 gap-2 sm:max-w-md">
        {([
          { key: "" as StatusFilter, label: "All Materials", dot: "bg-slate-400" },
          { key: "ACTIVE" as StatusFilter, label: "Active", dot: "bg-emerald-500" },
          { key: "INACTIVE" as StatusFilter, label: "Inactive", dot: "bg-slate-400" },
        ]).map(({ key, label, dot }) => {
          const active = statusFilter === key;
          return (
            <button
              key={key || "all"}
              type="button"
              onClick={() => setStatusFilter(key)}
              aria-pressed={active}
              className={`rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow ${active ? "ring-2 ring-primary border-primary" : ""}`}
            >
              <span className="text-lg font-black leading-none text-slate-800">{counts[key]}</span>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <span className="text-xs font-semibold text-slate-500 truncate">{label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {stockFilter && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Showing</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STOCK_PILL[stockFilter].tone}`}>
            {STOCK_PILL[stockFilter].label} materials
            <button type="button" onClick={clearStockFilter} className="hover:opacity-70" title="Clear filter">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}

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
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Codes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(p)} {...info.bind(<ProductInfo p={p} />)}>
                  <TableCell className="font-mono text-xs font-bold text-slate-500">{p.materialCode || p.sku}</TableCell>
                  <TableCell className="font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      {p.imageUrl
                        ? <img src={resolveFileUrl(p.imageUrl)} alt="" className="h-8 w-8 shrink-0 rounded object-cover border" />
                        : <div className="h-8 w-8 shrink-0 rounded bg-slate-100 border" />}
                      <span>{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{p.category?.name || "—"}</TableCell>
                  <TableCell>{p.brand || "—"}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-semibold tabular-nums ${isOut(p) ? "text-red-600" : isLow(p) ? "text-orange-600" : "text-slate-700"}`}>
                      {onHand(p)}
                    </span>
                    {isOut(p) && <span className="ml-1 text-[10px] font-bold uppercase text-red-500">out</span>}
                    {isLow(p) && <span className="ml-1 text-[10px] font-bold uppercase text-orange-500">low</span>}
                  </TableCell>
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
              {products.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No materials found.</TableCell></TableRow>}
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
              <SearchableSelect value={form.category?.id ? String(form.category.id) : ""}
                onChange={(v) => setForm({ ...form, category: v ? { id: Number(v) } : null })}
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                placeholder="Search category…" clearLabel="— none —" />
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
              <SearchableSelect value={form.defaultWarehouse?.id ? String(form.defaultWarehouse.id) : ""}
                onChange={(v) => setForm({ ...form, defaultWarehouse: v ? { id: Number(v) } : null })}
                options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
                placeholder="Search warehouse…" clearLabel="— none —" />
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

            {/* ---- Media ---- */}
            <SectionHead>Photos</SectionHead>
            <div className="col-span-2">
              <ImageCaptureField
                module="MATERIAL"
                label="Primary Image"
                value={form.imageUrl ? resolveFileUrl(form.imageUrl) : ""}
                onChange={({ url }) => setForm({ ...form, imageUrl: url })}
              />
            </div>
            <div className="col-span-2">
              <MultiImageCaptureField
                module="MATERIAL"
                label="More Photos (swatches, close-ups, room shots)"
                value={(form.imageUrls || []).map((url) => ({ url, fileName: url.split("/").pop() || "image" }))}
                onChange={(imgs) => setForm({ ...form, imageUrls: imgs.map((i) => i.url) })}
              />
            </div>

            {/* ---- Fabric / cloth specifications ---- */}
            <SectionHead>Fabric / Cloth Specifications</SectionHead>
            <div className="space-y-1">
              <Label>Fabric Composition</Label>
              <Input placeholder="e.g. Cotton, Velvet, Polyester blend" value={form.fabricComposition || ""}
                onChange={(e) => setForm({ ...form, fabricComposition: e.target.value })} />
            </div>
            <PickOne label="Fabric Width" value={form.fabricWidth} options={FABRIC_WIDTHS}
              onChange={(v) => setForm({ ...form, fabricWidth: v })} />
            <div className="space-y-1">
              <Label>GSM (fabric weight)</Label>
              <Input type="number" placeholder="e.g. 220" value={form.gsm ?? ""}
                onChange={(e) => setForm({ ...form, gsm: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <PickOne label="Pattern" value={form.pattern} options={FABRIC_PATTERNS}
              onChange={(v) => setForm({ ...form, pattern: v })} />
            <div className="space-y-1">
              <Label>Colour</Label>
              <Input placeholder="e.g. Wine Red" value={form.color || ""}
                onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <PickOne label="Colour Family" value={form.colorFamily} options={COLOR_FAMILIES}
              onChange={(v) => setForm({ ...form, colorFamily: v })} />
            <CheckChips label="Available Sizes" value={form.availableSizes} options={CURTAIN_SIZES}
              onChange={(v) => setForm({ ...form, availableSizes: v })} />

            {/* ---- Window suitability & design structure ---- */}
            <SectionHead>Window Suitability &amp; Design</SectionHead>
            <PickOne label="Product Type" value={form.productType} options={PRODUCT_TYPES}
              onChange={(v) => setForm({ ...form, productType: v })} />
            <PickOne label="Mounting Type" value={form.mountingType} options={MOUNTING_TYPES}
              onChange={(v) => setForm({ ...form, mountingType: v })} />
            <PickOne label="Light Control / Opacity" value={form.opacity} options={OPACITY_LEVELS}
              onChange={(v) => setForm({ ...form, opacity: v })} />
            <PickOne label="Design Style" value={form.designStyle} options={DESIGN_STYLES}
              onChange={(v) => setForm({ ...form, designStyle: v })} />
            <CheckChips label="Suitable Window Types" value={form.suitableWindowTypes} options={WINDOW_TYPES}
              onChange={(v) => setForm({ ...form, suitableWindowTypes: v })} />
            <CheckChips label="Suitable Rooms" value={form.suitableRooms} options={ROOM_TYPES}
              onChange={(v) => setForm({ ...form, suitableRooms: v })} />
            <div className="col-span-2 space-y-1">
              <Label>Design / Structure Notes</Label>
              <textarea className="w-full border rounded-md px-2 py-1.5 text-sm bg-white min-h-[70px]"
                placeholder="Pleat style, lining, hardware, installation notes…"
                value={form.structureNotes || ""} onChange={(e) => setForm({ ...form, structureNotes: e.target.value })} />
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
      {info.portal}
    </div>
  );
}

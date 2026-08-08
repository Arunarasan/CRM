import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { BOQ_UNITS, type BoqItemMaterial, type ProductRef } from "@/types/boq";

interface Availability {
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  supplier?: string;
  brand?: string;
}

interface MaterialPickerProps {
  open: boolean;
  onClose: () => void;
  onSave: (material: Partial<BoqItemMaterial>) => void;
}

type Mode = "inventory" | "custom";

export default function MaterialPicker({ open, onClose, onSave }: MaterialPickerProps) {
  const [mode, setMode] = useState<Mode>("inventory");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [selected, setSelected] = useState<ProductRef | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [customName, setCustomName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [wastePercent, setWastePercent] = useState(0);
  const [unit, setUnit] = useState(BOQ_UNITS[0]);
  const [sellingRate, setSellingRate] = useState(0);

  useEffect(() => {
    if (!open) return;
    setMode("inventory");
    setSearch(""); setSelected(null); setAvailability(null);
    setCustomName(""); setQuantity(1); setWastePercent(0); setUnit(BOQ_UNITS[0]); setSellingRate(0);
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "inventory") return;
    const t = setTimeout(() => {
      api.get(`/inventory/products?search=${encodeURIComponent(search)}&size=20`)
        .then((res) => setProducts(res.data.content || []))
        .catch(console.error);
    }, 300);
    return () => clearTimeout(t);
  }, [search, open, mode]);

  const pickProduct = (p: ProductRef) => {
    setSelected(p);
    setUnit(p.unit || BOQ_UNITS[0]);
    setSellingRate(p.sellingPrice ?? p.price ?? 0);
    api.get(`/inventory/products/${p.id}/availability`).then((res) => setAvailability(res.data)).catch(console.error);
  };

  const finalQuantity = quantity * (1 + wastePercent / 100);
  const shortfall = availability && finalQuantity > availability.availableStock;

  // A custom material carries no inventory product — just a name, like a labour line.
  const isCustom = mode === "custom";
  const canSave = isCustom ? customName.trim().length > 0 : !!selected;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      product: isCustom || !selected ? undefined : { id: selected.id },
      materialName: isCustom ? customName.trim() : selected!.name,
      quantity,
      unit,
      wastePercent,
      sellingRate,
      costPrice: isCustom ? undefined : availability?.costPrice,
      vendor: isCustom ? undefined : availability?.supplier,
    });
    onClose();
  };

  const amountFields = (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="text-xs text-muted-foreground">Quantity</label>
        <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Waste %</label>
        <Input type="number" value={wastePercent} onChange={(e) => setWastePercent(Number(e.target.value))} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Rate (₹)</label>
        <Input type="number" value={sellingRate} onChange={(e) => setSellingRate(Number(e.target.value))} />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Material</DialogTitle>
        </DialogHeader>

        {/* Mode toggle — inventory item vs. free-text custom line (e.g. labour, misc charges) */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button"
            className={`border rounded-md p-2 text-sm ${mode === "inventory" ? "border-primary bg-primary/5 font-medium" : ""}`}
            onClick={() => setMode("inventory")}>
            From inventory
          </button>
          <button type="button"
            className={`border rounded-md p-2 text-sm ${mode === "custom" ? "border-primary bg-primary/5 font-medium" : ""}`}
            onClick={() => setMode("custom")}>
            Custom (write name)
          </button>
        </div>

        <div className="space-y-3">
          {mode === "inventory" && (
            <>
              <Input placeholder="Search inventory (name, SKU)..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {!selected && (
                <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                  {products.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      No matches. <button className="underline" onClick={() => setMode("custom")}>Add a custom material instead</button>.
                    </div>
                  ) : products.map((p) => (
                    <button key={p.id} className="w-full text-left p-2 text-sm hover:bg-muted/40" onClick={() => pickProduct(p)}>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.sku} · {p.unit} · ₹{p.sellingPrice ?? p.price ?? 0}</div>
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div className="space-y-3 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{selected.name}</div>
                    <button className="text-xs underline text-muted-foreground" onClick={() => { setSelected(null); setAvailability(null); }}>Change</button>
                  </div>

                  {availability && (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-md p-2">
                      <div>Current Stock: <b>{availability.currentStock}</b></div>
                      <div>Reserved: <b>{availability.reservedStock}</b></div>
                      <div>Available: <b>{availability.availableStock}</b></div>
                      <div>Unit: <b>{availability.unit}</b></div>
                      <div>Cost Price: <b>₹{availability.costPrice}</b></div>
                      <div>Selling Price: <b>₹{availability.sellingPrice}</b></div>
                      <div>Supplier: <b>{availability.supplier || "—"}</b></div>
                      <div>Brand: <b>{availability.brand || "—"}</b></div>
                    </div>
                  )}

                  {amountFields}

                  {shortfall && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                      ⚠ Only {availability?.availableStock} {unit} available in stock, {finalQuantity.toFixed(2)} {unit} required. You can still add it — stock will run negative.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {mode === "custom" && (
            <div className="space-y-3 border rounded-md p-3">
              <div>
                <label className="text-xs text-muted-foreground">Material name</label>
                <Input placeholder="e.g. Labour work, POP, Site cleaning" value={customName} onChange={(e) => setCustomName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unit</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  {BOQ_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {amountFields}
              <p className="text-xs text-muted-foreground">Not linked to inventory — no stock is reserved for custom materials.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={handleSave}>Add Material</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

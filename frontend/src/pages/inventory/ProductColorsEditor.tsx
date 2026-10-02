import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageCell } from "@/pages/leads/quote/productCells";
import type { ProductColor } from "@/types/inventory";

// The colours a product comes in. Each one has a name, a swatch and (optionally) its own photo; on a
// quotation the colour is picked per line, and picking it shows that colour's photo.

export default function ProductColorsEditor({ value, photos, onChange }: {
  value?: ProductColor[];
  /** The product's own photos, offered as a colour's photo. */
  photos: string[];
  onChange: (next: ProductColor[]) => void;
}) {
  const colors = value || [];
  const update = (i: number, patch: Partial<ProductColor>) =>
    onChange(colors.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(colors.filter((_, k) => k !== i));
  const add = () => onChange([...colors, { name: "", hex: "#d4c5a9" }]);

  return (
    <div className="space-y-2">
      {colors.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No colours yet. Add the colours this product comes in — they're picked per line on a quotation.
        </p>
      )}
      {colors.map((c, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
          <ImageCell url={c.imageUrl} options={photos} disabled={false} module="MATERIAL"
            onChange={(url) => update(i, { imageUrl: url })} />
          <label className="relative h-9 w-9 shrink-0 cursor-pointer rounded-full border shadow-inner"
            style={{ background: c.hex || "#ffffff" }} title="Pick the swatch colour">
            <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={c.hex || "#ffffff"} onChange={(e) => update(i, { hex: e.target.value })} aria-label={`Swatch for ${c.name || "colour"}`} />
          </label>
          <Input className="h-9 flex-1" placeholder="Colour name (e.g. Ivory)" value={c.name}
            onChange={(e) => update(i, { name: e.target.value })} />
          <button type="button" onClick={() => remove(i)} aria-label="Remove colour"
            className="h-9 w-9 shrink-0 rounded-md hover:bg-destructive/10 flex items-center justify-center">
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add colour
      </Button>
    </div>
  );
}

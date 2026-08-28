import { useEffect, useState } from 'react';
import { ArrowRight, Star, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import ResourceManager from './ResourceManager';
import { Field, TextInput, TextArea, StringListEditor, PairListEditor, Toggle, Group } from './ui';
import FileUploadField from '@/components/FileUploadField';
import SearchableSelect from '@/components/ui/searchable-select';
import { websiteAdminApi, Product, Category, SpecRow, ColorVariant } from '@/api/websiteAdminApi';

const EMPTY: Product = {
  name: '', slug: '', sku: '', categoryId: null, shortDescription: '', description: '', imageUrl: '',
  price: 0, discountPrice: null, stock: 0, rating: 0, reviewCount: 0, featured: false, active: true,
  material: '', dimensions: '', gallery: [], specifications: [], colors: [],
};

/** Editor for colour/finish variants: swatch colour + name + optional image URL. */
function ColorListEditor({ value, onChange }: { value: ColorVariant[]; onChange: (v: ColorVariant[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<ColorVariant>) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => onChange([...list, { name: '', hex: '#1f3d2b', image: '' }]);
  const remove = (i: number) => onChange(list.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      {list.map((c, i) => (
        <div key={i} className="flex items-start gap-1.5 rounded-md border border-dashed p-2">
          <input
            type="color"
            value={c.hex || '#000000'}
            onChange={(e) => set(i, { hex: e.target.value })}
            className="mt-0.5 h-9 w-9 shrink-0 cursor-pointer rounded border border-input bg-background"
            aria-label="Swatch colour"
          />
          <div className="flex-1 space-y-1.5">
            <TextInput value={c.name} placeholder="Colour name (e.g. Forest Green)" onChange={(e) => set(i, { name: e.target.value })} />
            <TextInput value={c.image ?? ''} placeholder="Image URL for this colour (optional)" onChange={(e) => set(i, { image: e.target.value })} />
          </div>
          <button type="button" onClick={() => remove(i)} className="mt-1 shrink-0 rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Add colour
      </button>
    </div>
  );
}

/** Live preview mirroring the public catalog card (enquiry model — no price / cart). */
function ProductPreview({ d }: { d: Product }) {
  const rating = Math.round(d.rating ?? 0);
  const colors = d.colors ?? [];
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-square bg-[#0f1f17]">
        {d.imageUrl ? (
          <img src={d.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600"><ImageIcon className="h-8 w-8" /></div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <h3 className="font-serif text-lg font-semibold leading-snug text-slate-800">{d.name || 'Product name'}</h3>
        {(d.reviewCount ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-3.5 w-3.5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300'}`} />
              ))}
            </div>
            <span className="text-xs text-slate-400">({d.reviewCount})</span>
          </div>
        )}
        <p className="line-clamp-2 text-sm text-slate-500">{d.shortDescription || 'Short description shown on the card.'}</p>
        {colors.length > 0 && (
          <div className="flex items-center gap-1.5">
            {colors.slice(0, 6).map((c, i) => (
              <span key={i} className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} title={c.name} />
            ))}
            <span className="text-[11px] text-slate-400">{colors.length} colour{colors.length === 1 ? '' : 's'}</span>
          </div>
        )}
        <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#a07d1e]">
          View Details <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

export default function ProductsAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => { websiteAdminApi.categories.list().then(setCategories).catch(() => setCategories([])); }, []);
  const catName = (id?: number | null) => categories.find((c) => c.id === id)?.name;
  const catOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <ResourceManager<Product>
      singular="Product"
      api={websiteAdminApi.products}
      emptyDraft={EMPTY}
      wide
      rowTitle={(p) => p.name}
      validate={(p) => (!p.name?.trim() ? 'Name is required' : !p.categoryId ? 'Pick a category' : null)}
      renderRow={(p) => (
        <div className="flex items-center gap-3 min-w-0">
          {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-11 w-11 rounded object-cover border shrink-0" /> : <div className="h-11 w-11 rounded bg-slate-100 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {p.name} {p.featured && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Featured</span>}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {[catName(p.categoryId), p.sku].filter(Boolean).join(' · ') || 'No category'}
              {(p.colors?.length ?? 0) > 0 ? ` · ${p.colors!.length} colour${p.colors!.length === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        </div>
      )}
      renderForm={(d, patch) => (
        // Two columns so the whole editor fits on screen without a scroll.
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Group label="Card preview">
              <ProductPreview d={d} />
              <FileUploadField module="WEBSITE" label="Main image" value={d.imageUrl} onChange={({ url }) => patch({ imageUrl: url })} accept="image/*" />
            </Group>

            <Group label="Basics">
              <Field label="Name" required><TextInput value={d.name} placeholder="Oakwood Lounge Chair" onChange={(e) => patch({ name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="SKU"><TextInput value={d.sku} placeholder="OLC-001" onChange={(e) => patch({ sku: e.target.value })} /></Field>
                <Field label="Slug" hint="Auto if blank"><TextInput value={d.slug} onChange={(e) => patch({ slug: e.target.value })} /></Field>
              </div>
              <Field label="Category" required>
                <SearchableSelect
                  value={d.categoryId ? String(d.categoryId) : ''}
                  onChange={(v) => patch({ categoryId: v ? Number(v) : null })}
                  options={catOptions}
                  placeholder="Select category…"
                  clearLabel="No category"
                />
              </Field>
            </Group>

            <Group label="Colour options">
              <p className="text-[11px] text-muted-foreground">Shown as selectable swatches on the product page. Add an image per colour to switch the photo when a customer picks it.</p>
              <ColorListEditor value={d.colors ?? []} onChange={(v) => patch({ colors: v })} />
            </Group>
          </div>

          <div className="space-y-4">
            <Group label="Description">
              <Field label="Short description" hint="One line shown on the card"><TextInput value={d.shortDescription} onChange={(e) => patch({ shortDescription: e.target.value })} /></Field>
              <Field label="Full description"><TextArea value={d.description} onChange={(e) => patch({ description: e.target.value })} className="min-h-[56px]" /></Field>
            </Group>

            <Group label="Attributes">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Material"><TextInput value={d.material} placeholder="Solid oak" onChange={(e) => patch({ material: e.target.value })} /></Field>
                <Field label="Dimensions"><TextInput value={d.dimensions} placeholder="120 × 60 × 75 cm" onChange={(e) => patch({ dimensions: e.target.value })} /></Field>
              </div>
              <Field label="Gallery images"><StringListEditor value={d.gallery ?? []} onChange={(v) => patch({ gallery: v })} placeholder="https://…" /></Field>
            </Group>

            <Group label="Specifications">
              <PairListEditor<SpecRow>
                value={d.specifications ?? []}
                onChange={(v) => patch({ specifications: v })}
                fields={[{ key: 'label', placeholder: 'Label (e.g. Weight)' }, { key: 'value', placeholder: 'Value (e.g. 12 kg)' }]}
                blank={{ label: '', value: '' }}
              />
            </Group>

            <Group label="Internal (not shown on site)">
              <p className="text-[11px] text-muted-foreground">The public site is enquiry-only — prices aren’t shown. Kept for your own reference.</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Price (₹)"><TextInput type="number" value={d.price ?? 0} onChange={(e) => patch({ price: Number(e.target.value) })} /></Field>
                <Field label="Rating (0–5)" hint="Shown on the product page"><TextInput type="number" min={0} max={5} step={0.1} value={d.rating ?? 0} onChange={(e) => patch({ rating: Number(e.target.value) })} /></Field>
              </div>
              <Toggle checked={!!d.featured} onChange={(v) => patch({ featured: v })} label="Featured on homepage" />
            </Group>
          </div>
        </div>
      )}
    />
  );
}

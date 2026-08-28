import { useEffect, useState } from 'react';
import { Heart, ShoppingBag, Star, Image as ImageIcon } from 'lucide-react';
import ResourceManager from './ResourceManager';
import { Field, TextInput, TextArea, StringListEditor, PairListEditor, Toggle, Group } from './ui';
import FileUploadField from '@/components/FileUploadField';
import SearchableSelect from '@/components/ui/searchable-select';
import { websiteAdminApi, Product, Category, SpecRow } from '@/api/websiteAdminApi';

const EMPTY: Product = {
  name: '', slug: '', sku: '', categoryId: null, shortDescription: '', description: '', imageUrl: '',
  price: 0, discountPrice: null, stock: 0, rating: 0, reviewCount: 0, featured: false, active: true,
  material: '', dimensions: '', gallery: [], specifications: [],
};

const inr = (n?: number | null) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

/** Live preview mirroring the public shop product card. */
function ProductPreview({ d }: { d: Product }) {
  const onSale = d.discountPrice != null && Number(d.discountPrice) > 0;
  const soldOut = Number(d.stock ?? 0) <= 0;
  const rating = Math.round(d.rating ?? 0);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-square bg-[#0f1f17]">
        {d.imageUrl ? (
          <img src={d.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600"><ImageIcon className="h-8 w-8" /></div>
        )}
        {onSale && <span className="absolute left-3 top-3 bg-[#c9a24b] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#0f1f17]">Sale</span>}
        {soldOut && <span className="absolute right-3 top-3 bg-[#14261d]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#f5f1e6]">Sold Out</span>}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <h3 className="font-serif text-lg font-semibold leading-snug text-slate-800">{d.name || 'Product name'}</h3>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-3.5 w-3.5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300'}`} />
            ))}
          </div>
          {(d.reviewCount ?? 0) > 0 && <span className="text-xs text-slate-400">({d.reviewCount})</span>}
        </div>
        <div className="mt-1 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-slate-800">{inr(onSale ? d.discountPrice : d.price)}</span>
            {onSale && <span className="text-sm text-slate-400 line-through">{inr(d.price)}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-500"><Heart className="h-4 w-4" /></span>
            <span className={`flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-500 ${soldOut ? 'opacity-40' : ''}`}><ShoppingBag className="h-4 w-4" /></span>
          </div>
        </div>
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
      validate={(p) => (!p.name?.trim() ? 'Name is required' : null)}
      renderRow={(p) => (
        <div className="flex items-center gap-3 min-w-0">
          {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-11 w-11 rounded object-cover border shrink-0" /> : <div className="h-11 w-11 rounded bg-slate-100 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {p.name} {p.featured && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Featured</span>}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {[catName(p.categoryId), p.sku].filter(Boolean).join(' · ')} · {inr(p.price)}
              {p.discountPrice ? ` (was ${inr(p.discountPrice)})` : ''} · stock {p.stock ?? 0}
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
              <Field label="Category">
                <SearchableSelect
                  value={d.categoryId ? String(d.categoryId) : ''}
                  onChange={(v) => patch({ categoryId: v ? Number(v) : null })}
                  options={catOptions}
                  placeholder="Select category…"
                  clearLabel="No category"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Price (₹)"><TextInput type="number" value={d.price ?? 0} onChange={(e) => patch({ price: Number(e.target.value) })} /></Field>
                <Field label="Discount price" hint="Shows a Sale badge"><TextInput type="number" value={d.discountPrice ?? ''} onChange={(e) => patch({ discountPrice: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                <Field label="Stock" hint="0 = Sold Out"><TextInput type="number" value={d.stock ?? 0} onChange={(e) => patch({ stock: Number(e.target.value) })} /></Field>
                <Field label="Rating (0–5)"><TextInput type="number" min={0} max={5} step={0.1} value={d.rating ?? 0} onChange={(e) => patch({ rating: Number(e.target.value) })} /></Field>
              </div>
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

            <Toggle checked={!!d.featured} onChange={(v) => patch({ featured: v })} label="Featured on homepage" />
          </div>
        </div>
      )}
    />
  );
}

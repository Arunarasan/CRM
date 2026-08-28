import ResourceManager from './ResourceManager';
import { Field, TextInput, Group } from './ui';
import { LucideByName } from './icons';
import { websiteAdminApi, Category } from '@/api/websiteAdminApi';

const EMPTY: Category = { name: '', slug: '', icon: '', displayOrder: 0, active: true };

/** Live preview mirroring the public category chip. */
function CategoryPreview({ d }: { d: Category }) {
  return (
    <div className="flex w-[150px] flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-6 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c9a24b]/40 text-[#c9a24b]">
        <LucideByName name={d.icon} className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <span className="text-sm font-medium text-slate-800">{d.name || 'Category name'}</span>
    </div>
  );
}

export default function CategoriesAdmin() {
  return (
    <ResourceManager<Category>
      singular="Category"
      api={websiteAdminApi.categories}
      emptyDraft={EMPTY}
      rowTitle={(c) => c.name}
      validate={(c) => (!c.name?.trim() ? 'Name is required' : null)}
      renderRow={(c) => (
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200 text-amber-600">
            <LucideByName name={c.icon} className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground truncate">/{c.slug} {c.icon && `· ${c.icon}`}</p>
          </div>
        </div>
      )}
      renderForm={(d, patch) => (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Live preview</p>
            <CategoryPreview d={d} />
          </div>

          <Group label="Details">
            <Field label="Name" required><TextInput value={d.name} placeholder="Furniture" onChange={(e) => patch({ name: e.target.value })} /></Field>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Icon" hint="Lucide name, e.g. sofa, lamp, gem"><TextInput value={d.icon} placeholder="sofa" onChange={(e) => patch({ icon: e.target.value })} /></Field>
              <Field label="Display order" hint="Lower shows first"><TextInput type="number" value={d.displayOrder ?? 0} onChange={(e) => patch({ displayOrder: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Slug" hint="Leave blank to auto-generate from the name"><TextInput value={d.slug} placeholder="furniture" onChange={(e) => patch({ slug: e.target.value })} /></Field>
          </Group>
        </div>
      )}
    />
  );
}

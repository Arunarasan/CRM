import { ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import ResourceManager from './ResourceManager';
import { Field, TextInput, TextArea, StringListEditor, Group } from './ui';
import FileUploadField from '@/components/FileUploadField';
import { websiteAdminApi, Material } from '@/api/websiteAdminApi';

const EMPTY: Material = {
  name: '', slug: '', category: '', imageUrl: '', description: '', finish: '', color: '',
  applications: [], displayOrder: 0, active: true,
};

/** Live preview mirroring the public materials card. */
function MaterialPreview({ d }: { d: Material }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-[#0f1f17]">
        {d.imageUrl ? (
          <img src={d.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600"><ImageIcon className="h-8 w-8" /></div>
        )}
        {d.category && (
          <span className="absolute left-3 top-3 bg-[#14261d]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#c9a24b]">{d.category}</span>
        )}
      </div>
      <div className="flex flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold text-slate-800">{d.name || 'Material name'}</h3>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 line-clamp-2">{d.description || 'A short description of the material and its feel.'}</p>
        <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span><span className="text-slate-400">Finish:</span> {d.finish || '—'}</span>
          <span><span className="text-slate-400">Colour:</span> {d.color || '—'}</span>
        </div>
      </div>
    </div>
  );
}

export default function MaterialsAdmin() {
  return (
    <ResourceManager<Material>
      singular="Material"
      api={websiteAdminApi.materials}
      emptyDraft={EMPTY}
      wide
      rowTitle={(m) => m.name}
      validate={(m) => (!m.name?.trim() ? 'Name is required' : null)}
      renderRow={(m) => (
        <div className="flex items-center gap-3 min-w-0">
          {m.imageUrl ? <img src={m.imageUrl} alt="" className="h-10 w-10 rounded object-cover border shrink-0" /> : <div className="h-10 w-10 rounded bg-slate-100 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{m.name}</p>
            <p className="text-xs text-muted-foreground truncate">{[m.category, m.finish, m.color].filter(Boolean).join(' · ') || '—'}</p>
          </div>
        </div>
      )}
      renderForm={(d, patch) => (
        // Two columns so the whole editor fits on screen without a scroll.
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Group label="Card preview">
              <MaterialPreview d={d} />
              <FileUploadField module="WEBSITE" label="Image" value={d.imageUrl} onChange={({ url }) => patch({ imageUrl: url })} accept="image/*" />
            </Group>

            <Group label="Basics">
              <Field label="Name" required><TextInput value={d.name} placeholder="Walnut Veneer" onChange={(e) => patch({ name: e.target.value })} /></Field>
              <Field label="Category" hint="Shown as a badge on the card"><TextInput value={d.category} placeholder="Wood / Marble / Laminate" onChange={(e) => patch({ category: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Finish"><TextInput value={d.finish} placeholder="Matte" onChange={(e) => patch({ finish: e.target.value })} /></Field>
                <Field label="Color"><TextInput value={d.color} placeholder="Walnut" onChange={(e) => patch({ color: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Slug" hint="Auto if blank"><TextInput value={d.slug} onChange={(e) => patch({ slug: e.target.value })} /></Field>
                <Field label="Display order" hint="Lower shows first"><TextInput type="number" value={d.displayOrder ?? 0} onChange={(e) => patch({ displayOrder: Number(e.target.value) })} /></Field>
              </div>
            </Group>
          </div>

          <div className="space-y-4">
            <Group label="Details">
              <Field label="Description"><TextArea value={d.description} placeholder="How it looks, feels and where it shines." onChange={(e) => patch({ description: e.target.value })} className="min-h-[120px]" /></Field>
              <Field label="Applications"><StringListEditor value={d.applications ?? []} onChange={(v) => patch({ applications: v })} placeholder="Wardrobes" /></Field>
            </Group>
          </div>
        </div>
      )}
    />
  );
}

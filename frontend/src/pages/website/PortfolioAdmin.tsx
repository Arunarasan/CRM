import { ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import ResourceManager from './ResourceManager';
import { Field, TextInput, TextArea, StringListEditor, Group } from './ui';
import FileUploadField from '@/components/FileUploadField';
import { websiteAdminApi, Portfolio } from '@/api/websiteAdminApi';

const EMPTY: Portfolio = {
  title: '', slug: '', category: '', location: '', year: new Date().getFullYear(),
  coverImage: '', concept: '', gallery: [], materialsList: [], servicesList: [], highlights: [],
  testimonial: { quote: '', name: '', role: '' }, displayOrder: 0, active: true,
};

/** Live preview mirroring the public portfolio card. */
function PortfolioPreview({ d }: { d: Portfolio }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-800 bg-[#0f1f17]">
      {d.coverImage ? (
        <img src={d.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600"><ImageIcon className="h-8 w-8" /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f17]/95 via-[#14261d]/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9a24b]">{d.category || 'Category'}</span>
          <h3 className="mt-1 font-serif text-lg font-semibold text-[#f5f1e6]">{d.title || 'Project title'}</h3>
          <p className="text-sm text-[#f5f1e6]/70">{[d.location, d.year].filter(Boolean).join(' · ') || 'Location · Year'}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#c9a24b]/60 text-[#c9a24b]"><ArrowUpRight className="h-5 w-5" /></span>
      </div>
    </div>
  );
}

export default function PortfolioAdmin() {
  return (
    <ResourceManager<Portfolio>
      singular="Project"
      api={websiteAdminApi.portfolio}
      emptyDraft={EMPTY}
      wide
      rowTitle={(p) => p.title}
      validate={(p) => (!p.title?.trim() ? 'Title is required' : null)}
      renderRow={(p) => (
        <div className="flex items-center gap-3 min-w-0">
          {p.coverImage ? <img src={p.coverImage} alt="" className="h-11 w-16 rounded object-cover border shrink-0" /> : <div className="h-11 w-16 rounded bg-slate-100 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{p.title}</p>
            <p className="text-xs text-muted-foreground truncate">{[p.category, p.location, p.year].filter(Boolean).join(' · ') || '—'}</p>
          </div>
        </div>
      )}
      renderForm={(d, patch) => {
        const t = d.testimonial ?? { quote: '', name: '', role: '' };
        const setT = (p: Partial<typeof t>) => patch({ testimonial: { ...t, ...p } });
        return (
          // Two columns so the whole editor fits on screen without a scroll.
          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Group label="Cover preview">
                <PortfolioPreview d={d} />
                <FileUploadField module="WEBSITE" label="Cover image" value={d.coverImage} onChange={({ url }) => patch({ coverImage: url })} accept="image/*" />
              </Group>

              <Group label="Project details">
                <Field label="Title" required><TextInput value={d.title} placeholder="Modern Villa Retreat" onChange={(e) => patch({ title: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Category"><TextInput value={d.category} placeholder="Residential" onChange={(e) => patch({ category: e.target.value })} /></Field>
                  <Field label="Location"><TextInput value={d.location} placeholder="Bengaluru" onChange={(e) => patch({ location: e.target.value })} /></Field>
                  <Field label="Year"><TextInput type="number" value={d.year ?? ''} onChange={(e) => patch({ year: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                  <Field label="Display order" hint="Lower shows first"><TextInput type="number" value={d.displayOrder ?? 0} onChange={(e) => patch({ displayOrder: Number(e.target.value) })} /></Field>
                </div>
                <Field label="Slug" hint="Auto from title if blank"><TextInput value={d.slug} placeholder="modern-villa-retreat" onChange={(e) => patch({ slug: e.target.value })} /></Field>
              </Group>
            </div>

            <div className="space-y-4">
              <Group label="Story">
                <Field label="Concept"><TextArea value={d.concept} placeholder="The vision, challenge and approach behind this project." onChange={(e) => patch({ concept: e.target.value })} className="min-h-[56px]" /></Field>
                <Field label="Gallery images"><StringListEditor value={d.gallery ?? []} onChange={(v) => patch({ gallery: v })} placeholder="https://…" /></Field>
              </Group>

              <Group label="Details">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Materials"><StringListEditor value={d.materialsList ?? []} onChange={(v) => patch({ materialsList: v })} placeholder="Italian marble" /></Field>
                  <Field label="Services"><StringListEditor value={d.servicesList ?? []} onChange={(v) => patch({ servicesList: v })} placeholder="Interior design" /></Field>
                  <Field label="Highlights"><StringListEditor value={d.highlights ?? []} onChange={(v) => patch({ highlights: v })} placeholder="Custom lighting" /></Field>
                </div>
              </Group>

              <Group label="Client testimonial (optional)">
                <Field label="Quote"><TextArea value={t.quote} placeholder="Working with them was effortless…" onChange={(e) => setT({ quote: e.target.value })} className="min-h-[48px]" /></Field>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="Client name"><TextInput value={t.name} onChange={(e) => setT({ name: e.target.value })} /></Field>
                  <Field label="Client role"><TextInput value={t.role} placeholder="Homeowner" onChange={(e) => setT({ role: e.target.value })} /></Field>
                </div>
              </Group>
            </div>
          </div>
        );
      }}
    />
  );
}

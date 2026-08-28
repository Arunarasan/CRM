import { ArrowRight, Image as ImageIcon } from 'lucide-react';
import ResourceManager from './ResourceManager';
import { Field, TextInput, TextArea, StringListEditor, PairListEditor, Group } from './ui';
import { LucideByName } from './icons';
import FileUploadField from '@/components/FileUploadField';
import { websiteAdminApi, Service, ProcessStep, FaqItem } from '@/api/websiteAdminApi';

const EMPTY: Service = {
  title: '', slug: '', shortDescription: '', imageUrl: '', icon: '', overview: '',
  benefits: [], materialsList: [], process: [], faq: [], displayOrder: 0, active: true,
};

/** Live preview mirroring the public service card. */
function ServicePreview({ d }: { d: Service }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-[#0f1f17]">
        {d.imageUrl ? (
          <img src={d.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600"><ImageIcon className="h-8 w-8" /></div>
        )}
        <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center bg-[#14261d]/90 text-[#c9a24b] backdrop-blur-sm">
          <LucideByName name={d.icon} className="h-5 w-5" strokeWidth={1.5} />
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="font-serif text-lg font-semibold text-slate-800">{d.title || 'Service title'}</h3>
        <p className="text-sm leading-relaxed text-slate-500 line-clamp-2">{d.shortDescription || 'A short one-line description shown on the card.'}</p>
        <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#a8862f]">
          Learn More <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

export default function ServicesAdmin() {
  return (
    <ResourceManager<Service>
      singular="Service"
      api={websiteAdminApi.services}
      emptyDraft={EMPTY}
      wide
      rowTitle={(s) => s.title}
      validate={(s) => (!s.title?.trim() ? 'Title is required' : null)}
      renderRow={(s) => (
        <div className="flex items-center gap-3 min-w-0">
          {s.imageUrl ? <img src={s.imageUrl} alt="" className="h-11 w-11 rounded object-cover border shrink-0" /> : <div className="h-11 w-11 rounded bg-slate-100 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{s.title}</p>
            <p className="text-xs text-muted-foreground truncate">{s.shortDescription || '—'}</p>
          </div>
        </div>
      )}
      renderForm={(d, patch) => (
        // Two columns so the whole editor fits on screen without a scroll.
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Group label="Card preview">
              <ServicePreview d={d} />
              <FileUploadField module="WEBSITE" label="Image" value={d.imageUrl} onChange={({ url }) => patch({ imageUrl: url })} accept="image/*" />
            </Group>

            <Group label="Basics">
              <Field label="Title" required><TextInput value={d.title} placeholder="Modular Kitchens" onChange={(e) => patch({ title: e.target.value })} /></Field>
              <Field label="Icon" hint="Lucide icon name, e.g. paint-roller, sofa, wrench"><TextInput value={d.icon} placeholder="paint-roller" onChange={(e) => patch({ icon: e.target.value })} /></Field>
              <Field label="Short description" hint="One line shown on the card"><TextInput value={d.shortDescription} placeholder="Bespoke kitchens built for how you cook." onChange={(e) => patch({ shortDescription: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Slug" hint="Auto if blank"><TextInput value={d.slug} placeholder="modular-kitchens" onChange={(e) => patch({ slug: e.target.value })} /></Field>
                <Field label="Display order" hint="Lower shows first"><TextInput type="number" value={d.displayOrder ?? 0} onChange={(e) => patch({ displayOrder: Number(e.target.value) })} /></Field>
              </div>
            </Group>
          </div>

          <div className="space-y-4">
            <Group label="Details">
              <Field label="Overview"><TextArea value={d.overview} placeholder="A fuller description shown on the service's own page." onChange={(e) => patch({ overview: e.target.value })} className="min-h-[56px]" /></Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Benefits"><StringListEditor value={d.benefits ?? []} onChange={(v) => patch({ benefits: v })} placeholder="10-year warranty" /></Field>
                <Field label="Materials used"><StringListEditor value={d.materialsList ?? []} onChange={(v) => patch({ materialsList: v })} placeholder="Marine plywood" /></Field>
              </div>
            </Group>

            <Group label="Process steps">
              <PairListEditor<ProcessStep>
                value={d.process ?? []}
                onChange={(v) => patch({ process: v })}
                fields={[{ key: 'title', placeholder: 'Step title (e.g. Consultation)' }, { key: 'description', placeholder: 'Step description — what happens in this step' }]}
                blank={{ title: '', description: '' }}
              />
            </Group>

            <Group label="FAQ">
              <PairListEditor<FaqItem>
                value={d.faq ?? []}
                onChange={(v) => patch({ faq: v })}
                fields={[{ key: 'question', placeholder: 'Question' }, { key: 'answer', placeholder: 'Answer — the full response shown to visitors' }]}
                blank={{ question: '', answer: '' }}
              />
            </Group>
          </div>
        </div>
      )}
    />
  );
}

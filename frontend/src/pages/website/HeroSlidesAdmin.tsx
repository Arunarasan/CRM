import { ArrowRight, Image as ImageIcon } from 'lucide-react';
import ResourceManager from './ResourceManager';
import { Field, TextInput, TextArea, Toggle, Group } from './ui';
import FileUploadField from '@/components/FileUploadField';
import { websiteAdminApi, HeroSlide } from '@/api/websiteAdminApi';

const EMPTY: HeroSlide = {
  imageUrl: '', eyebrow: '', title: '', titleAccent: '', description: '',
  primaryButtonText: '', primaryButtonLink: '', secondaryButtonText: '', secondaryButtonLink: '',
  displayOrder: 0, active: true,
};

/** Live preview mirroring the public hero — updates as the admin types. */
function SlidePreview({ d }: { d: HeroSlide }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-[#0f1f17] shadow-sm">
      {d.imageUrl ? (
        <img src={d.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f1f17] via-[#14261d]/85 to-[#14261d]/20" />
      <div className="relative px-5 py-6 sm:px-7 sm:py-8">
        {d.eyebrow && (
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9a24b]">
            <span className="h-px w-5 bg-[#c9a24b]" /> {d.eyebrow}
          </span>
        )}
        <h3 className="mt-2 max-w-md font-serif text-2xl font-semibold leading-tight text-[#f5f1e6] sm:text-3xl">
          {d.title || 'Your headline here'}{' '}
          {d.titleAccent && <span className="text-[#c9a24b]">{d.titleAccent}</span>}
        </h3>
        {d.description && (
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#f5f1e6]/70 line-clamp-2">{d.description}</p>
        )}
        {(d.primaryButtonText || d.secondaryButtonText) && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {d.primaryButtonText && (
              <span className="inline-flex items-center gap-1.5 rounded bg-[#c9a24b] px-3.5 py-1.5 text-xs font-semibold text-[#0f1f17]">
                {d.primaryButtonText} <ArrowRight className="h-3 w-3" />
              </span>
            )}
            {d.secondaryButtonText && (
              <span className="inline-flex items-center gap-1.5 rounded border border-[#c9a24b]/60 px-3.5 py-1.5 text-xs font-semibold text-[#c9a24b]">
                {d.secondaryButtonText} <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HeroSlidesAdmin() {
  return (
    <ResourceManager<HeroSlide>
      singular="Slide"
      api={websiteAdminApi.heroSlides}
      emptyDraft={EMPTY}
      wide
      rowTitle={(s) => s.title || s.eyebrow || 'Slide'}
      validate={(s) => (!s.title?.trim() && !s.imageUrl?.trim() ? 'Add a title or an image' : null)}
      renderRow={(s) => (
        <div className="flex items-center gap-3 min-w-0">
          {s.imageUrl ? (
            <img src={s.imageUrl} alt="" className="h-10 w-16 rounded object-cover border shrink-0" />
          ) : <div className="h-10 w-16 rounded bg-slate-100 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{s.title || '(no title)'} {s.titleAccent && <span className="text-primary">{s.titleAccent}</span>}</p>
            <p className="text-xs text-muted-foreground truncate">{s.eyebrow || s.description || '—'}</p>
          </div>
        </div>
      )}
      renderForm={(d, patch) => (
        // Two columns so the whole editor fits on screen without a scroll.
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-2">
          <div className="space-y-4">
            {/* Live preview — what visitors will see */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Live preview</p>
                <Toggle checked={d.active !== false} onChange={(v) => patch({ active: v })} label={d.active !== false ? 'Live on site' : 'Hidden'} />
              </div>
              <SlidePreview d={d} />
            </div>

            <Group label="Background image">
              <FileUploadField module="WEBSITE" label="Upload a photo or paste a link" value={d.imageUrl} onChange={({ url }) => patch({ imageUrl: url })} accept="image/*" />
              <Field label="Display order" hint="Lower numbers show first">
                <TextInput type="number" value={d.displayOrder ?? 0} onChange={(e) => patch({ displayOrder: Number(e.target.value) })} className="w-28" />
              </Field>
            </Group>
          </div>

          <div className="space-y-4">
            <Group label="Headline">
              <Field label="Eyebrow" hint="Small label above the title">
                <TextInput value={d.eyebrow} placeholder="e.g. Award-winning interiors" onChange={(e) => patch({ eyebrow: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Title"><TextInput value={d.title} placeholder="Crafting" onChange={(e) => patch({ title: e.target.value })} /></Field>
                <Field label="Accent word" hint="Shown in gold"><TextInput value={d.titleAccent} placeholder="elegance" onChange={(e) => patch({ titleAccent: e.target.value })} /></Field>
              </div>
              <Field label="Description">
                <TextArea value={d.description} placeholder="One or two sentences that sell the slide." onChange={(e) => patch({ description: e.target.value })} className="min-h-[56px]" />
              </Field>
            </Group>

            <Group label="Buttons">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Primary button"><TextInput value={d.primaryButtonText} placeholder="Explore services" onChange={(e) => patch({ primaryButtonText: e.target.value })} /></Field>
                <Field label="Primary link"><TextInput value={d.primaryButtonLink} placeholder="/services" onChange={(e) => patch({ primaryButtonLink: e.target.value })} /></Field>
                <Field label="Secondary button"><TextInput value={d.secondaryButtonText} placeholder="View portfolio" onChange={(e) => patch({ secondaryButtonText: e.target.value })} /></Field>
                <Field label="Secondary link"><TextInput value={d.secondaryButtonLink} placeholder="/portfolio" onChange={(e) => patch({ secondaryButtonLink: e.target.value })} /></Field>
              </div>
            </Group>
          </div>
        </div>
      )}
    />
  );
}

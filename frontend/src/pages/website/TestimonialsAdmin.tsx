import { Quote, Star } from 'lucide-react';
import ResourceManager from './ResourceManager';
import { Field, TextInput, TextArea, Group } from './ui';
import { websiteAdminApi, Testimonial } from '@/api/websiteAdminApi';

const EMPTY: Testimonial = { name: '', role: '', location: '', rating: 5, quote: '', displayOrder: 0, active: true };

/** Clickable 1–5 star picker, mirroring the site's Rating display. */
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="text-amber-400 hover:scale-110 transition-transform" aria-label={`${n} star${n > 1 ? 's' : ''}`}>
          <Star className={`h-6 w-6 ${n <= value ? 'fill-amber-400' : 'fill-transparent text-slate-300'}`} />
        </button>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">{value} / 5</span>
    </div>
  );
}

/** Live preview mirroring the public testimonial card. */
function TestimonialPreview({ d }: { d: Testimonial }) {
  return (
    <figure className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <Quote className="h-6 w-6 text-[#c9a24b]" />
      <blockquote className="font-serif text-base leading-relaxed text-slate-700 line-clamp-3">
        “{d.quote || 'The testimonial quote will appear here as you type.'}”
      </blockquote>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={`h-4 w-4 ${n <= (d.rating ?? 5) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300'}`} />
        ))}
      </div>
      <figcaption className="border-t border-slate-100 pt-3">
        <div className="font-semibold text-slate-800">{d.name || 'Client name'}</div>
        <div className="text-sm text-slate-500">{[d.role, d.location].filter(Boolean).join(' · ') || 'Role · Location'}</div>
      </figcaption>
    </figure>
  );
}

export default function TestimonialsAdmin() {
  return (
    <ResourceManager<Testimonial>
      singular="Testimonial"
      api={websiteAdminApi.testimonials}
      emptyDraft={EMPTY}
      rowTitle={(t) => t.name}
      validate={(t) => (!t.name?.trim() ? 'Name is required' : !t.quote?.trim() ? 'Quote is required' : null)}
      renderRow={(t) => (
        <div className="min-w-0">
          <p className="text-sm font-medium">{t.name} <span className="text-amber-500">{'★'.repeat(t.rating ?? 5)}</span></p>
          <p className="text-xs text-muted-foreground truncate">“{t.quote}”</p>
        </div>
      )}
      renderForm={(d, patch) => (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Live preview</p>
            <TestimonialPreview d={d} />
          </div>

          <Group label="Quote">
            <Field label="What the client said" required>
              <TextArea value={d.quote} placeholder="They transformed our home beyond what we imagined…" onChange={(e) => patch({ quote: e.target.value })} className="min-h-[70px]" />
            </Field>
            <Field label="Rating"><StarPicker value={d.rating ?? 5} onChange={(v) => patch({ rating: v })} /></Field>
          </Group>

          <Group label="Who said it">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Name" required><TextInput value={d.name} placeholder="Priya Sharma" onChange={(e) => patch({ name: e.target.value })} /></Field>
              <Field label="Role / title"><TextInput value={d.role} placeholder="Homeowner" onChange={(e) => patch({ role: e.target.value })} /></Field>
              <Field label="Location"><TextInput value={d.location} placeholder="Bengaluru" onChange={(e) => patch({ location: e.target.value })} /></Field>
              <Field label="Display order" hint="Lower numbers show first"><TextInput type="number" value={d.displayOrder ?? 0} onChange={(e) => patch({ displayOrder: Number(e.target.value) })} className="w-28" /></Field>
            </div>
          </Group>
        </div>
      )}
    />
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, RotateCcw, Eye, EyeOff, FileText } from 'lucide-react';
import { websiteAdminApi, ContentBlock } from '@/api/websiteAdminApi';
import { toast } from '@/components/ui/toast';

/**
 * Page content editor — the copy shown on the public site (Home sections, About, Contact). Edits are
 * inline and in plain language: each section is a card with a friendly name, a "where it appears"
 * note, and Heading / Subheading / Text fields. No technical ids are exposed. Saved edits are live on
 * the site on its next load.
 */

const PAGE_NAMES: Record<string, string> = {
  home: 'Home page', about: 'About page', contact: 'Contact page',
  services: 'Services page', shop: 'Shop page',
};

// Friendly name + where-it-shows for the known, wired sections. Unknown sections fall back to a
// title-cased version of their key.
const SECTION_META: Record<string, { name: string; where: string }> = {
  'home/why_choose_us': { name: 'Why Choose Us', where: 'The trust section on the Home page' },
  'home/consultation_cta': { name: 'Consultation banner', where: 'The “Book a consultation” band on the Home page' },
  'about/intro': { name: 'About introduction', where: 'The opening section of the About page' },
  'contact/intro': { name: 'Contact introduction', where: 'The heading area of the Contact page' },
};

const titleize = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const metaFor = (b: ContentBlock) =>
  SECTION_META[`${b.page}/${b.sectionKey}`] ?? { name: titleize(b.sectionKey), where: `${PAGE_NAMES[b.page] ?? b.page}` };

function SectionCard({ block, onSaved }: { block: ContentBlock; onSaved: (b: ContentBlock) => void }) {
  const [draft, setDraft] = useState(block);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(block), [block]);

  const meta = metaFor(block);
  const dirty =
    (draft.title ?? '') !== (block.title ?? '') ||
    (draft.subtitle ?? '') !== (block.subtitle ?? '') ||
    (draft.body ?? '') !== (block.body ?? '');
  const live = block.active !== false;

  const save = async () => {
    setBusy(true);
    try {
      const saved = await websiteAdminApi.content.update(block.id!, { ...block, ...draft });
      onSaved(saved);
      toast.success(`“${meta.name}” updated — live on the site shortly.`);
    } catch (e: any) { toast.error(e?.message || 'Could not save.'); }
    finally { setBusy(false); }
  };

  const toggle = async () => {
    try {
      const saved = await websiteAdminApi.content.toggle(block.id!);
      onSaved(saved);
      toast.success(saved.active === false ? 'Hidden from the site.' : 'Now showing on the site.');
    } catch (e: any) { toast.error(e?.message || 'Could not update.'); }
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{meta.name}</h3>
          <p className="text-xs text-muted-foreground">{meta.where}</p>
        </div>
        <button
          onClick={toggle}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            live ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
          title={live ? 'Showing on the site — click to hide' : 'Hidden — click to show'}
        >
          {live ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {live ? 'Showing' : 'Hidden'}
        </button>
      </div>

      <div className="space-y-4 p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Heading</span>
          <input
            value={draft.title ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Main heading for this section"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Subheading</span>
          <input
            value={draft.subtitle ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
            placeholder="Short line shown near the heading"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Text</span>
          <textarea
            value={draft.body ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={3}
            placeholder="The paragraph shown in this section"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
        {dirty && (
          <button
            onClick={() => setDraft(block)}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>
    </div>
  );
}

export default function ContentAdmin() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    websiteAdminApi.content.list()
      .then((rows) => setBlocks([...rows].sort((a, b) =>
        a.page.localeCompare(b.page) || (a.displayOrder ?? 0) - (b.displayOrder ?? 0))))
      .catch(() => toast.error('Could not load content.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onSaved = (saved: ContentBlock) =>
    setBlocks((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));

  const byPage = useMemo(() => {
    const g: Record<string, ContentBlock[]> = {};
    blocks.forEach((b) => { (g[b.page] ||= []).push(b); });
    return g;
  }, [blocks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading content…
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-white py-14 text-center text-sm text-muted-foreground">
        <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        No editable content yet. Restart the backend once so the defaults seed, then refresh.
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <p className="text-sm text-muted-foreground">
        Edit the wording shown on your public website. Changes go live on the site’s next load.
      </p>
      {Object.entries(byPage).map(([page, items]) => (
        <section key={page} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {PAGE_NAMES[page] ?? titleize(page)}
          </h2>
          <div className="space-y-4">
            {items.map((b) => <SectionCard key={b.id} block={b} onSaved={onSaved} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

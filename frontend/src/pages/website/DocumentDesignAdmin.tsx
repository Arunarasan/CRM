import { useEffect, useState } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  DEFAULT_DESIGN, designApi, fetchDocDesign, resetDocDesignCache, type DocDesign, type DocKind,
} from '@/lib/docDesign';

type BoolKey = { [K in keyof DocDesign]: DocDesign[K] extends boolean ? K : never }[keyof DocDesign];
type Option = { key: BoolKey; label: string; hint?: string; only?: DocKind };

const SECTIONS: { title: string; options: Option[] }[] = [
  { title: 'Header', options: [
    { key: 'letterhead', label: 'Letterhead banner', hint: 'Company logo, address and phone at the top.' },
  ] },
  { title: 'Info cards', options: [
    { key: 'showDateCard', label: 'Date card' },
    { key: 'showCustomerCard', label: 'Customer name card' },
    { key: 'showCustomerDetail', label: 'Customer area / GSTIN line' },
    { key: 'showSiteCard', label: 'Site / project card' },
  ] },
  { title: 'Items table', options: [
    { key: 'categoryHeader', label: 'Category heading' },
    { key: 'categoryTotal', label: 'Category total row' },
    { key: 'colPhoto', label: 'Product photo' },
    { key: 'colTag', label: 'CUSTOM / INVENTORY tag', only: 'quotation' },
    { key: 'colDescription', label: 'Product details', hint: 'Description, colour and room under the product name.' },
    { key: 'colQty', label: 'Qty column' },
    { key: 'colUnit', label: 'Unit column' },
    { key: 'colRate', label: 'Rate column' },
    { key: 'colExtra', label: 'Discount % / GST % column' },
  ] },
  { title: 'Bottom of the page', options: [
    { key: 'showTerms', label: 'Terms & conditions' },
    { key: 'showBank', label: 'Bank details' },
    { key: 'showQr', label: 'UPI scan-to-pay QR' },
    { key: 'showFooter', label: 'Footer line & page numbers' },
    { key: 'showSignatures', label: 'Signature boxes', hint: 'Print preview only.', only: 'quotation' },
    { key: 'showContact', label: 'Contact & website QR', hint: 'Print preview only.', only: 'quotation' },
  ] },
];

/**
 * Document Design — choose what the printed quotation and invoice show (letterhead, customer, address
 * cards, bank details, which item columns…). Saved per document type; the PDF and the print preview
 * both read it, so a change applies to the next document opened or printed.
 */
export default function DocumentDesignAdmin() {
  const [kind, setKind] = useState<DocKind>('quotation');
  const [design, setDesign] = useState<DocDesign>(DEFAULT_DESIGN);
  const [saved, setSaved] = useState<DocDesign>(DEFAULT_DESIGN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    resetDocDesignCache();
    fetchDocDesign(kind).then((d) => { setDesign(d); setSaved(d); }).finally(() => setLoading(false));
  }, [kind]);

  const dirty = JSON.stringify(design) !== JSON.stringify(saved);
  const set = <K extends keyof DocDesign>(k: K, v: DocDesign[K]) => setDesign((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await designApi.save(kind, design);
      setSaved(design);
      toast.success(`${kind === 'quotation' ? 'Quotation' : 'Invoice'} design saved.`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the design.');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-5 pb-4">
      <p className="text-sm text-muted-foreground">
        Choose what appears on printed documents. Changes apply the next time a quotation or invoice is opened or printed.
      </p>

      <div className="inline-flex rounded-lg border bg-white p-1 text-sm">
        {(['quotation', 'invoice'] as DocKind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-md px-4 py-1.5 font-medium capitalize ${kind === k ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-slate-100'}`}>
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-5 py-3"><h2 className="text-sm font-semibold text-slate-900">Wording</h2></div>
            <div className="grid gap-4 p-5">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Heading</span>
                <input value={design.titleText} onChange={(e) => set('titleText', e.target.value)}
                  placeholder={kind === 'quotation' ? 'QUOTATION' : 'TAX INVOICE'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <span className="mt-1 block text-[11px] text-muted-foreground">Leave blank for the default heading.</span>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Footer note</span>
                <textarea value={design.footerText} onChange={(e) => set('footerText', e.target.value)} rows={2}
                  placeholder="e.g. Goods once sold will not be taken back."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
            </div>
          </section>

          {SECTIONS.map((sec) => (
            <section key={sec.title} className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-5 py-3"><h2 className="text-sm font-semibold text-slate-900">{sec.title}</h2></div>
              <div className="divide-y">
                {sec.options.filter((o) => !o.only || o.only === kind).map((o) => (
                  <label key={o.key} className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3">
                    <span>
                      <span className="block text-sm text-slate-800">{o.label}</span>
                      {o.hint && <span className="block text-[11px] text-muted-foreground">{o.hint}</span>}
                    </span>
                    <input type="checkbox" checked={design[o.key]} onChange={(e) => set(o.key, e.target.checked)}
                      className="h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
                  </label>
                ))}
              </div>
            </section>
          ))}

          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-slate-50/80 py-3 backdrop-blur">
            {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
            <Button variant="outline" onClick={() => setDesign(DEFAULT_DESIGN)} disabled={saving}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reset to default
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Save design
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

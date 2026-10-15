import { BaseInput } from '@/components/ui/input';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { LeadFormType, LeadFormMedia } from '@/types/employeeTask';
import { useT } from '@/i18n';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select';
type Scope = 'top' | 'data';
interface Field { key: string; label: string; type: FieldType; scope: Scope; options?: string[]; placeholder?: string }

// Per-task field schema. `top` keys map to the payload root (outcome/notes/nextFollowUpDate);
// `data` keys map into payload.data. Kept declarative so adding a task type is one array entry.
const SCHEMAS: Record<LeadFormType, { fields: Field[]; photos?: boolean }> = {
  FOLLOW_UP: {
    fields: [
      { key: 'method', label: 'pw.lt.f.method', type: 'select', scope: 'data', options: ['Call', 'WhatsApp', 'Email', 'Meeting'] },
      { key: 'outcome', label: 'pw.lt.f.outcome', type: 'select', scope: 'top', options: ['Connected', 'No Answer', 'Callback Requested', 'Not Reachable', 'Interested', 'Not Interested'] },
      { key: 'customerResponse', label: 'pw.lt.f.customerResponse', type: 'textarea', scope: 'data', placeholder: 'pw.lt.p.customerResponse' },
      { key: 'nextFollowUpDate', label: 'pw.lt.f.nextFollowUpDate', type: 'date', scope: 'top' },
      { key: 'nextFollowUpTime', label: 'pw.lt.f.nextFollowUpTime', type: 'time', scope: 'data' },
      { key: 'notes', label: 'pw.lt.f.notes', type: 'textarea', scope: 'top' },
    ],
  },
  REQUIREMENT: {
    fields: [
      { key: 'customerRequirements', label: 'pw.lt.f.customerRequirements', type: 'textarea', scope: 'data', placeholder: 'pw.lt.p.customerRequirements' },
      { key: 'roomsRequired', label: 'pw.lt.f.roomsRequired', type: 'text', scope: 'data', placeholder: 'pw.lt.p.roomsRequired' },
      { key: 'requirementCategory', label: 'pw.lt.f.requirementCategory', type: 'text', scope: 'data', placeholder: 'pw.lt.p.requirementCategory' },
      { key: 'estimatedBudget', label: 'pw.lt.f.estimatedBudget', type: 'number', scope: 'data' },
      { key: 'minimumBudget', label: 'pw.lt.f.minimumBudget', type: 'number', scope: 'data' },
      { key: 'maximumBudget', label: 'pw.lt.f.maximumBudget', type: 'number', scope: 'data' },
      { key: 'preferredDesignStyle', label: 'pw.lt.f.preferredDesignStyle', type: 'text', scope: 'data' },
      { key: 'preferredMaterial', label: 'pw.lt.f.preferredMaterial', type: 'text', scope: 'data' },
      { key: 'preferredCompletionDate', label: 'pw.lt.f.preferredCompletionDate', type: 'date', scope: 'data' },
      { key: 'notes', label: 'pw.lt.f.notes', type: 'textarea', scope: 'top' },
    ],
  },
  QUALIFY: {
    fields: [
      { key: 'decision', label: 'pw.lt.f.decision', type: 'select', scope: 'data', options: ['Qualified', 'Not Qualified', 'Nurture'] },
      { key: 'temperature', label: 'pw.lt.f.temperature', type: 'select', scope: 'data', options: ['Hot', 'Warm', 'Cold'] },
      { key: 'reason', label: 'pw.lt.f.reason', type: 'textarea', scope: 'data', placeholder: 'pw.lt.p.reason' },
      { key: 'nextFollowUpDate', label: 'pw.lt.f.nextFollowUpDate', type: 'date', scope: 'top' },
      { key: 'nextFollowUpTime', label: 'pw.lt.f.nextFollowUpTime', type: 'time', scope: 'data' },
      { key: 'notes', label: 'pw.lt.f.notes', type: 'textarea', scope: 'top' },
    ],
  },
  SCHEDULE_VISIT: {
    fields: [
      { key: 'visitDate', label: 'pw.lt.f.visitDate', type: 'date', scope: 'data' },
      { key: 'visitTime', label: 'pw.lt.f.visitTime', type: 'time', scope: 'data' },
      { key: 'outcome', label: 'pw.lt.f.status', type: 'select', scope: 'top', options: ['Scheduled', 'Pending Confirmation'] },
      { key: 'notes', label: 'pw.lt.f.notes', type: 'textarea', scope: 'top' },
    ],
  },
  SITE_VISIT: {
    fields: [
      { key: 'observations', label: 'pw.lt.f.observations', type: 'textarea', scope: 'data', placeholder: 'pw.lt.p.observations' },
      { key: 'outcome', label: 'pw.lt.f.outcome', type: 'select', scope: 'top', options: ['Completed', 'Needs Revisit'] },
      { key: 'notes', label: 'pw.lt.f.notes', type: 'textarea', scope: 'top' },
    ],
    photos: true,
  },
  REVIEW: {
    fields: [
      { key: 'outcome', label: 'pw.lt.f.outcome', type: 'select', scope: 'top', options: ['Reviewed', 'Needs Info'] },
      { key: 'notes', label: 'pw.lt.f.notes', type: 'textarea', scope: 'top', placeholder: 'pw.lt.p.review' },
    ],
  },
};

export default function LeadTaskFormSheet({ taskId, formType, open, onOpenChange, onSaved }: {
  taskId: number; formType: LeadFormType; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const { t } = useT();
  const schema = SCHEMAS[formType];
  const [values, setValues] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<LeadFormMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await employeeTaskApi.uploadFile(file, 'lead-task');
        setMedia((prev) => [...prev, { url: res.fileUrl, type: 'PHOTO', caption: res.fileName }]);
      }
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const top: Record<string, string> = {};
      const data: Record<string, string> = {};
      for (const f of schema.fields) {
        const v = values[f.key];
        if (v == null || v === '') continue;
        (f.scope === 'top' ? top : data)[f.key] = v;
      }
      await employeeTaskApi.submitLeadForm(taskId, {
        outcome: top.outcome,
        notes: top.notes,
        nextFollowUpDate: top.nextFollowUpDate,
        media: media.length ? media : undefined,
        data,
      });
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f: Field) => {
    const common = 'mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]';
    if (f.type === 'select') {
      return (
        <select value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} className={common}>
          <option value="">{t('pw.lt.select')}</option>
          {f.options!.map((o) => <option key={o} value={o}>{t(`pw.lt.o.${o}`)}</option>)}
        </select>
      );
    }
    if (f.type === 'textarea') {
      return <textarea value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} rows={3}
        className={common} placeholder={f.placeholder ? t(f.placeholder) : undefined} />;
    }
    return <BaseInput type={f.type} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
      className={common} placeholder={f.placeholder ? t(f.placeholder) : undefined} />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t(`pw.lt.title.${formType}`)}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          {schema.fields.map((f) => (
            <div key={f.key}>
              <Label>{t(f.label)}</Label>
              {renderField(f)}
            </div>
          ))}

          {schema.photos && (
            <div>
              <Label>{t('pw.lt.photos')}</Label>
              <BaseInput type="file" accept="image/*" multiple capture="environment"
                onChange={(e) => onFiles(e.target.files)} className="w-full text-xs" />
              {uploading && <p className="mt-1 text-xs text-muted-foreground">{t('pw.lt.uploading')}</p>}
              {media.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {media.map((m, i) => (
                    <div key={i} className="relative shrink-0">
                      <img src={m.url} alt="" className="h-16 w-16 rounded-md object-cover" />
                      <button type="button" onClick={() => setMedia((prev) => prev.filter((_, x) => x !== i))}
                        className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || uploading} className="w-full bg-[#0A573B] text-white hover:bg-[#06452F]">
            {saving ? t('pw.lt.saving') : t('pw.lt.saveComplete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

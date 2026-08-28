import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { LeadFormType, LeadFormMedia } from '@/types/employeeTask';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select';
type Scope = 'top' | 'data';
interface Field { key: string; label: string; type: FieldType; scope: Scope; options?: string[]; placeholder?: string }

// Per-task field schema. `top` keys map to the payload root (outcome/notes/nextFollowUpDate);
// `data` keys map into payload.data. Kept declarative so adding a task type is one array entry.
const SCHEMAS: Record<LeadFormType, { title: string; fields: Field[]; photos?: boolean }> = {
  FOLLOW_UP: {
    title: 'Log Follow-up',
    fields: [
      { key: 'method', label: 'Contacted via', type: 'select', scope: 'data', options: ['Call', 'WhatsApp', 'Email', 'Meeting'] },
      { key: 'outcome', label: 'Outcome', type: 'select', scope: 'top', options: ['Connected', 'No Answer', 'Callback Requested', 'Not Reachable', 'Interested', 'Not Interested'] },
      { key: 'customerResponse', label: 'Customer response', type: 'textarea', scope: 'data', placeholder: 'What did the customer say?' },
      { key: 'nextFollowUpDate', label: 'Next follow-up date', type: 'date', scope: 'top' },
      { key: 'notes', label: 'Notes', type: 'textarea', scope: 'top' },
    ],
  },
  REQUIREMENT: {
    title: 'Capture Requirement',
    fields: [
      { key: 'customerRequirements', label: 'Requirement / scope', type: 'textarea', scope: 'data', placeholder: 'What does the customer want done?' },
      { key: 'roomsRequired', label: 'Rooms required', type: 'text', scope: 'data', placeholder: 'e.g. Kitchen, 2 Bedrooms, Living' },
      { key: 'requirementCategory', label: 'Category', type: 'text', scope: 'data', placeholder: 'e.g. Full Interior, Modular Kitchen' },
      { key: 'estimatedBudget', label: 'Estimated budget (₹)', type: 'number', scope: 'data' },
      { key: 'minimumBudget', label: 'Min budget (₹)', type: 'number', scope: 'data' },
      { key: 'maximumBudget', label: 'Max budget (₹)', type: 'number', scope: 'data' },
      { key: 'preferredDesignStyle', label: 'Preferred style', type: 'text', scope: 'data' },
      { key: 'preferredMaterial', label: 'Preferred material', type: 'text', scope: 'data' },
      { key: 'preferredCompletionDate', label: 'Target completion', type: 'date', scope: 'data' },
      { key: 'notes', label: 'Notes', type: 'textarea', scope: 'top' },
    ],
  },
  QUALIFY: {
    title: 'Qualify Lead',
    fields: [
      { key: 'decision', label: 'Decision', type: 'select', scope: 'data', options: ['Qualified', 'Not Qualified', 'Nurture'] },
      { key: 'temperature', label: 'Temperature', type: 'select', scope: 'data', options: ['Hot', 'Warm', 'Cold'] },
      { key: 'reason', label: 'Reason', type: 'textarea', scope: 'data', placeholder: 'Why this decision?' },
      { key: 'nextFollowUpDate', label: 'Next follow-up date', type: 'date', scope: 'top' },
      { key: 'notes', label: 'Notes', type: 'textarea', scope: 'top' },
    ],
  },
  SCHEDULE_VISIT: {
    title: 'Schedule Site Visit',
    fields: [
      { key: 'visitDate', label: 'Visit date', type: 'date', scope: 'data' },
      { key: 'visitTime', label: 'Visit time', type: 'time', scope: 'data' },
      { key: 'outcome', label: 'Status', type: 'select', scope: 'top', options: ['Scheduled', 'Pending Confirmation'] },
      { key: 'notes', label: 'Notes', type: 'textarea', scope: 'top' },
    ],
  },
  SITE_VISIT: {
    title: 'Site Visit Report',
    fields: [
      { key: 'observations', label: 'Site observations', type: 'textarea', scope: 'data', placeholder: 'Site condition, measurements needed, access…' },
      { key: 'outcome', label: 'Outcome', type: 'select', scope: 'top', options: ['Completed', 'Needs Revisit'] },
      { key: 'notes', label: 'Notes', type: 'textarea', scope: 'top' },
    ],
    photos: true,
  },
  REVIEW: {
    title: 'Review Lead',
    fields: [
      { key: 'outcome', label: 'Outcome', type: 'select', scope: 'top', options: ['Reviewed', 'Needs Info'] },
      { key: 'notes', label: 'Notes', type: 'textarea', scope: 'top', placeholder: 'What did you review / decide?' },
    ],
  },
};

export default function LeadTaskFormSheet({ taskId, formType, open, onOpenChange, onSaved }: {
  taskId: number; formType: LeadFormType; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
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
    const common = 'w-full rounded-md border px-3 py-2 text-sm';
    if (f.type === 'select') {
      return (
        <select value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} className={common}>
          <option value="">Select…</option>
          {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === 'textarea') {
      return <textarea value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} rows={3}
        className={common} placeholder={f.placeholder} />;
    }
    return <input type={f.type} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
      className={common} placeholder={f.placeholder} />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{schema.title}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          {schema.fields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              {renderField(f)}
            </div>
          ))}

          {schema.photos && (
            <div>
              <Label>Photos</Label>
              <input type="file" accept="image/*" multiple capture="environment"
                onChange={(e) => onFiles(e.target.files)} className="w-full text-xs" />
              {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
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
          <Button onClick={submit} disabled={saving || uploading} className="w-full">
            {saving ? 'Saving…' : 'Save & Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

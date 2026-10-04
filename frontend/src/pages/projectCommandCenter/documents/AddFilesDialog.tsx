import { useEffect, useRef, useState } from 'react';
import { Camera, UploadCloud, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileThumb } from './FileTile';
import { UPLOAD_TYPES, guessType, kindOfFile } from './fileTypes';

export interface PendingFile {
  id: string;
  file: File;
  type: string;
  description: string;
  previewUrl?: string;
}

/**
 * "Add files": pick several files (or drop them, or take a photo), say what each one is and add an
 * optional note. Submitting hands them back to the page, which shows them at once while they upload.
 */
export default function AddFilesDialog({ open, onOpenChange, onSubmit }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (files: PendingFile[]) => void;
}) {
  const [items, setItems] = useState<PendingFile[]>([]);
  const [drag, setDrag] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!open) setItems([]); }, [open]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const next = Array.from(list).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      type: guessType(f),
      description: '',
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }));
    setItems((cur) => [...cur, ...next]);
  };
  const patch = (id: string, p: Partial<PendingFile>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const drop = (id: string) => setItems((cur) => cur.filter((i) => i.id !== id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Add files to the project</DialogTitle></DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
          <UploadCloud className="h-9 w-9 text-emerald-600" />
          <p className="text-sm text-slate-600">Drop photos, PDFs, drawings, videos or voice notes here</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => pickRef.current?.click()}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Choose files</button>
            <button type="button" onClick={() => cameraRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Camera className="h-4 w-4" /> Take photo
            </button>
          </div>
          <input ref={pickRef} type="file" multiple className="hidden"
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.dwg,.dxf,.skp"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {items.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {items.map((i) => (
              <li key={i.id} className="flex gap-3 rounded-xl border border-slate-200 p-2.5">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                  <FileThumb kind={kindOfFile(i.file)} name={i.file.name} previewUrl={i.previewUrl} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{i.file.name}</p>
                    <button type="button" onClick={() => drop(i.id)} aria-label="Remove" className="text-slate-400 hover:text-rose-600"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-[160px_1fr]">
                    <select value={i.type} onChange={(e) => patch(i.id, { type: e.target.value })} aria-label="What is this?"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px] outline-none focus:border-emerald-500">
                      {UPLOAD_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <input value={i.description} onChange={(e) => patch(i.id, { description: e.target.value })}
                      placeholder="What is it about? (optional)"
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
          <button type="button" disabled={!items.length} onClick={() => { onSubmit(items); onOpenChange(false); }}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Add {items.length || ''} file{items.length === 1 ? '' : 's'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

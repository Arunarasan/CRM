import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Pencil, Trash2, X, Crop, Info, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { resolveFileUrl } from '@/lib/uploadFile';
import { useImageViewer } from '@/components/ImageViewerProvider';
import { toast } from '@/components/ui/toast';
import { FileThumb, SourceChip } from './FileTile';
import { ProjectFile, SOURCES, UPLOAD_TYPES, fmtWhen, projectFilesApi } from './fileTypes';
import AudioPlayer from "@/components/AudioPlayer";
import CallDetails from "@/components/callRecordings/CallDetails";

const barBtn = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20';
const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

/**
 * Full-screen gallery: the file itself (photo / PDF / video / voice) — swipe, arrow keys or the thumbnail
 * strip to move through files, double-click / double-tap a photo to zoom — plus a hideable details panel:
 * what it is, where it came from, who added it, with edit / delete for files uploaded to the project.
 */
export default function FileViewer({ files, index, onIndex, onClose, onChanged, canEdit, onDelete }: {
  files: ProjectFile[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  onChanged: () => void;
  canEdit: boolean;
  /** Delete files with a docId some other way (e.g. lead documents) instead of as project documents. */
  onDelete?: (file: ProjectFile) => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const { openImage } = useImageViewer();
  const file = index != null ? files[index] : null;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fileName: '', documentType: '', remarks: '' });
  const [busy, setBusy] = useState(false);
  // Phones open on the picture alone; the details come up on demand.
  const [showInfo, setShowInfo] = useState(isWide);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const go = (i: number) => { if (i >= 0 && i < files.length) onIndex(i); };

  useEffect(() => {
    setEditing(false);
    setZoom(null);
    if (file) setForm({ fileName: file.fileName, documentType: file.type, remarks: file.description || '' });
    // Keep the current thumbnail in view, and warm up the neighbouring photos so sliding feels instant.
    stripRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if (index != null) [index - 1, index + 1].forEach((i) => {
      const f = files[i];
      if (f?.kind === 'image') new Image().src = resolveFileUrl(f.fileUrl);
    });
  }, [file?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' && index < files.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      if (e.key === 'Home') onIndex(0);
      if (e.key === 'End') onIndex(files.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, files.length, onIndex]);

  if (!file) return null;
  const url = resolveFileUrl(file.fileUrl);
  const editable = canEdit && file.editable && file.docId != null;
  const deletable = editable || (!!onDelete && canEdit && file.docId != null);

  // A zoomed photo follows the pointer / finger, so you can look around without dragging.
  const zoomAt = (el: Element, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };
  const toggleZoom = (e?: React.MouseEvent<HTMLImageElement>) => {
    const at = e ? zoomAt(e.currentTarget, e.clientX, e.clientY) : { x: 50, y: 50 };
    setZoom((z) => (z ? null : at));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!zoom || e.touches.length !== 1) return;
    const img = e.currentTarget.querySelector('img');
    if (img) setZoom(zoomAt(img, e.touches[0].clientX, e.touches[0].clientY));
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || zoom) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index! + (dx < 0 ? 1 : -1));
  };

  const save = async () => {
    setBusy(true);
    try {
      await projectFilesApi.update(file.docId!, form);
      toast.success('Details saved');
      setEditing(false);
      onChanged();
    } catch { toast.error('Could not save the details'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Delete "${file.fileName}"?`)) return;
    setBusy(true);
    try {
      await (onDelete ? onDelete(file) : projectFilesApi.remove(file.docId!));
      toast.success('File deleted');
      onClose();
      onChanged();
    } catch { toast.error('Could not delete the file'); }
    finally { setBusy(false); }
  };

  const editImage = () => {
    openImage({
      src: url, fileName: file.fileName, editable: true, module: 'PROJECT',
      onReplace: ({ url: newUrl, fileName }) => {
        projectFilesApi.replaceFile(file.docId!, { fileUrl: newUrl, fileName })
          .then(() => { toast.success('Image updated'); onChanged(); })
          .catch(() => toast.error('Failed to save the edited image.'));
      },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[94vh] sm:max-h-[94vh] sm:w-[97vw] sm:max-w-7xl sm:rounded-2xl lg:flex-row [&>button]:hidden">
        <DialogTitle className="sr-only">{file.fileName}</DialogTitle>
        {/* Media */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-950">
          {/* Top bar */}
          <div className="flex shrink-0 items-center gap-2 px-3 py-2 text-white">
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-medium tabular-nums">{index! + 1} / {files.length}</span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-white/80" title={file.fileName}>{file.fileName}</p>
            {file.kind === 'image' && (
              <button onClick={() => toggleZoom()} aria-label={zoom ? 'Zoom out' : 'Zoom in'} className={barBtn}>
                {zoom ? <ZoomOut className="h-[18px] w-[18px]" /> : <ZoomIn className="h-[18px] w-[18px]" />}
              </button>
            )}
            {!file.generated && (
              <a href={url} target="_blank" rel="noreferrer" download aria-label="Download" className={barBtn}>
                <Download className="h-[18px] w-[18px]" />
              </a>
            )}
            <button onClick={() => setShowInfo((v) => !v)} aria-label="Details" aria-pressed={showInfo}
              className={`${barBtn} ${showInfo ? 'bg-white/25' : ''}`}>
              <Info className="h-[18px] w-[18px]" />
            </button>
            <button onClick={onClose} aria-label="Close" className={barBtn}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stage — swipe left / right to move between files */}
          <div className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            {file.kind === 'image' ? (
              <img key={file.key} src={url} alt={file.fileName} draggable={false}
                onDoubleClick={toggleZoom}
                onMouseMove={(e) => { if (zoom) setZoom(zoomAt(e.currentTarget, e.clientX, e.clientY)); }}
                style={zoom ? { transform: 'scale(2.5)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
                className={`max-h-full max-w-full select-none object-contain transition-transform duration-200 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`} />
            ) : file.kind === 'pdf' && !file.generated ? (
              <iframe key={file.key} src={url} title={file.fileName} className="h-full w-full bg-white" />
            ) : file.kind === 'video' ? (
              <video key={file.key} src={url} controls className="max-h-full max-w-full" />
            ) : file.kind === 'audio' ? (
              <div className="flex w-full max-w-md flex-col items-center gap-4 p-6">
                <div className="h-40 w-40 overflow-hidden rounded-3xl"><FileThumb kind="audio" /></div>
                <AudioPlayer key={file.key} src={url} className="w-full" autoPlay />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="h-40 w-40 overflow-hidden rounded-3xl"><FileThumb kind={file.kind} name={file.fileName} /></div>
                <p className="max-w-sm text-sm text-slate-300">
                  {file.generated ? 'This document is generated by the CRM — open it to view or print.' : 'No preview for this file type — download or open it.'}
                </p>
                {file.generated ? (
                  <button onClick={() => navigate(file.fileUrl)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                    <ExternalLink className="h-4 w-4" /> Open {file.type.toLowerCase()}
                  </button>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                    <ExternalLink className="h-4 w-4" /> Open file
                  </a>
                )}
              </div>
            )}
            {index! > 0 && (
              <button onClick={() => go(index! - 1)} aria-label="Previous"
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60 sm:left-3">
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            {index! < files.length - 1 && (
              <button onClick={() => go(index! + 1)} aria-label="Next"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60 sm:right-3">
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Thumbnail strip — tap any file to jump to it */}
          {files.length > 1 && (
            <div ref={stripRef} className="flex shrink-0 gap-1.5 overflow-x-auto px-3 py-2.5 [scrollbar-width:thin]">
              {files.map((f, i) => (
                <button key={f.key} data-i={i} onClick={() => go(i)} aria-label={f.fileName} title={f.fileName}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg transition ${i === index ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950' : 'opacity-50 hover:opacity-90'}`}>
                  <FileThumb kind={f.kind} url={f.kind === 'video' ? undefined : f.fileUrl} name={f.fileName} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        {showInfo && <aside className="flex max-h-[45dvh] w-full shrink-0 flex-col overflow-y-auto border-t border-slate-200 bg-white lg:max-h-none lg:w-[340px] lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{file.type}</p>
              <p className="break-words text-[15px] font-semibold text-slate-800">{file.fileName}</p>
            </div>
            <button onClick={() => setShowInfo(false)} aria-label="Hide details" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          {editing ? (
            <div className="flex flex-col gap-3 p-4">
              <label className="text-[12px] font-medium text-slate-600">Name
                <input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
              </label>
              <label className="text-[12px] font-medium text-slate-600">What is this?
                <select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500">
                  {[...new Set([form.documentType, ...UPLOAD_TYPES])].filter(Boolean).map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-medium text-slate-600">About this file
                <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={3}
                  placeholder="e.g. Signed agreement with the customer"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
              </label>
              <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="flex-1 rounded-lg bg-emerald-700 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
                <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600">Cancel</button>
              </div>
            </div>
          ) : (
            <dl className="flex flex-col gap-3 p-4 text-[13px]">
              {file.call && (
                <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-700">Call details</p>
                  <CallDetails call={file.call} />
                </div>
              )}
              {!file.call && <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">About</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-slate-700">{file.description || <span className="text-slate-400">No description</span>}</dd>
              </div>}
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">From</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <SourceChip file={file} />
                  {file.link && (
                    <button onClick={() => { onClose(); navigate(file.link!); }} className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline">
                      Go there <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Added by</dt>
                  <dd className="mt-0.5 text-slate-700">{file.addedBy || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date</dt>
                  <dd className="mt-0.5 text-slate-700">{fmtWhen(file.addedAt) || '—'}</dd>
                </div>
              </div>
              {!deletable && !file.generated && (
                <p className="rounded-lg bg-slate-50 p-2.5 text-[12px] text-slate-500">
                  Added in {(SOURCES[file.source] || 'another module').toLowerCase()} — change or remove it there.
                </p>
              )}
            </dl>
          )}

          {deletable && <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 p-4">
            {editable && !editing && (
              <button onClick={() => setEditing(true)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Pencil className="h-4 w-4" /> Edit details
              </button>
            )}
            {editable && file.kind === 'image' && (
              <button onClick={editImage} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Crop className="h-4 w-4" /> Crop / rotate
              </button>
            )}
            <button onClick={remove} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>}
        </aside>}
      </DialogContent>
    </Dialog>
  );
}

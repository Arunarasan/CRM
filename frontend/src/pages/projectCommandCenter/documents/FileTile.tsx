import { FileSpreadsheet, FileText, Film, Loader2, Mic, Play, Ruler, File as FileIcon, ExternalLink } from 'lucide-react';
import { resolveFileUrl } from '@/lib/uploadFile';
import { FileKind, ProjectFile, SOURCES, extOf, fmtWhen } from './fileTypes';

/** The visual for a file: a real thumbnail for photos, a recognisable coloured tile for everything else. */
export function FileThumb({ kind, url, name, className = '', previewUrl }: {
  kind: FileKind; url?: string; name?: string; className?: string; previewUrl?: string;
}) {
  if (kind === 'image' && (previewUrl || url)) {
    return <img src={previewUrl || resolveFileUrl(url!)} alt={name || ''} loading="lazy"
      className={`h-full w-full object-cover ${className}`} />;
  }
  const tiles: Record<string, { bg: string; fg: string; icon: typeof FileText; label: string }> = {
    pdf: { bg: 'bg-rose-50', fg: 'text-rose-600', icon: FileText, label: 'PDF' },
    video: { bg: 'bg-slate-800', fg: 'text-white', icon: Film, label: 'VIDEO' },
    audio: { bg: 'bg-amber-50', fg: 'text-amber-700', icon: Mic, label: 'VOICE' },
    cad: { bg: 'bg-sky-50', fg: 'text-sky-700', icon: Ruler, label: extOf(name) },
    sheet: { bg: 'bg-emerald-50', fg: 'text-emerald-700', icon: FileSpreadsheet, label: extOf(name) },
    doc: { bg: 'bg-indigo-50', fg: 'text-indigo-700', icon: FileText, label: extOf(name) },
    file: { bg: 'bg-slate-100', fg: 'text-slate-500', icon: FileIcon, label: extOf(name) },
    image: { bg: 'bg-slate-100', fg: 'text-slate-400', icon: FileIcon, label: 'IMAGE' },
  };
  const t = tiles[kind] || tiles.file;
  if (kind === 'video' && url) {
    return (
      <div className={`relative h-full w-full bg-slate-900 ${className}`}>
        <video src={resolveFileUrl(url) + '#t=0.5'} preload="metadata" muted className="h-full w-full object-cover opacity-80" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900"><Play className="h-5 w-5" /></span>
        </span>
      </div>
    );
  }
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-1.5 ${t.bg} ${className}`}>
      <t.icon className={`h-9 w-9 ${t.fg}`} />
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${t.fg} bg-white/70`}>{t.label}</span>
    </div>
  );
}

const sourceTone: Record<string, string> = {
  PROJECT: 'bg-emerald-50 text-emerald-700', LEAD: 'bg-violet-50 text-violet-700', MEASUREMENT: 'bg-sky-50 text-sky-700',
  SITE_VISIT: 'bg-sky-50 text-sky-700', QUOTATION: 'bg-amber-50 text-amber-700', INVOICE: 'bg-amber-50 text-amber-700',
  TASK: 'bg-slate-100 text-slate-600', CHAT: 'bg-teal-50 text-teal-700', DAILY_LOG: 'bg-lime-50 text-lime-700',
  DAILY_REPORT: 'bg-lime-50 text-lime-700', WORK_STEP: 'bg-orange-50 text-orange-700', GRN: 'bg-cyan-50 text-cyan-700',
  HANDOVER: 'bg-emerald-50 text-emerald-700', CONTRACTOR: 'bg-rose-50 text-rose-700', CALL: 'bg-sky-50 text-sky-700',
};

export function SourceChip({ file }: { file: ProjectFile }) {
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10.5px] font-medium ${sourceTone[file.source] || 'bg-slate-100 text-slate-600'}`}
      title={file.sourceLabel}>
      {file.source === 'PROJECT' ? SOURCES.PROJECT : file.sourceLabel || SOURCES[file.source]}
    </span>
  );
}

/** Grid card: thumbnail, what it is, where it came from, who/when. */
export default function FileTile({ file, onOpen, uploading, previewUrl }: {
  file: ProjectFile; onOpen: () => void; uploading?: boolean; previewUrl?: string;
}) {
  return (
    <button type="button" onClick={onOpen} disabled={uploading}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-emerald-300 hover:shadow-md disabled:cursor-wait">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50">
        <FileThumb kind={file.kind} url={file.fileUrl} name={file.fileName} previewUrl={previewUrl}
          className="transition duration-300 group-hover:scale-[1.03]" />
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 shadow-sm">{file.type}</span>
        {file.generated && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 shadow-sm">
            <ExternalLink className="h-3 w-3" /> Open
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-white/60 text-[12px] font-semibold text-emerald-800">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <p className="truncate text-[13px] font-semibold text-slate-800" title={file.fileName}>{file.fileName}</p>
        {file.description && <p className="line-clamp-2 text-[12px] leading-snug text-slate-500">{file.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <SourceChip file={file} />
          <span className="shrink-0 text-[10.5px] text-slate-400">{fmtWhen(file.addedAt)}</span>
        </div>
      </div>
    </button>
  );
}

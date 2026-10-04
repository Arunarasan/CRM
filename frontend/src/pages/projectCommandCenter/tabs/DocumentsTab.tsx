import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, LayoutGrid, List, Plus, Search } from 'lucide-react';
import { uploadFile } from '@/lib/uploadFile';
import { compressImageFile } from '@/lib/imageProcessing';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import FileTile, { FileThumb, SourceChip } from '../documents/FileTile';
import FileViewer from '../documents/FileViewer';
import AddFilesDialog, { PendingFile } from '../documents/AddFilesDialog';
import {
  CATEGORIES, FileCategory, ProjectFile, ProjectFilesResponse, SOURCES, fmtWhen, kindOfFile, projectFilesApi,
} from '../documents/fileTypes';

interface Props {
  projectId: number;
  /** Called after a file is added / edited / removed, so the rest of the project page can refresh. */
  onChanged?: () => void;
}

type Uploading = PendingFile & { kind: ProjectFile['kind'] };

/**
 * Project Documents: every file on the project in one place — uploads plus the lead, measurement, site
 * visits, quotation, invoices, tasks, team chat, daily logs, execution steps, goods received and
 * contractors. Each file says what it is and where it came from; photos show as pictures straight away.
 */
export default function DocumentsTab({ projectId, onChanged }: Props) {
  const navigate = useNavigate();
  const { hasAuthority } = useAuth();
  const canEdit = hasAuthority('PROJECT_WRITE');
  const [data, setData] = useState<ProjectFilesResponse | null>(null);
  const [category, setCategory] = useState<'ALL' | FileCategory>('ALL');
  const [source, setSource] = useState('ALL');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { return (localStorage.getItem('projectDocsView') as 'grid' | 'list') || 'grid'; } catch { return 'grid'; }
  });
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(() => {
    projectFilesApi.list(projectId).then(setData).catch(() => setData({ files: [], byCategory: {}, bySource: {}, total: 0 }));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const setViewMode = (v: 'grid' | 'list') => {
    setView(v);
    try { localStorage.setItem('projectDocsView', v); } catch { /* ignore */ }
  };

  // Show new files at once (photos as pictures) while they upload in the background.
  const submit = async (items: PendingFile[]) => {
    const pending = items.map((i) => ({ ...i, kind: kindOfFile(i.file) }));
    setUploading((cur) => [...pending, ...cur]);
    let ok = 0;
    for (const p of pending) {
      try {
        const file = p.kind === 'image' ? await compressImageFile(p.file) : p.file;
        const { fileUrl, fileName } = await uploadFile(file, 'PROJECT');
        // Keep the name the user knows — compression renames the uploaded copy.
        await projectFilesApi.add(projectId, {
          fileName: p.file.name || fileName, fileUrl, documentType: p.type, remarks: p.description.trim() || undefined,
        });
        ok++;
      } catch {
        toast.error(`Could not upload ${p.file.name}`);
      } finally {
        setUploading((cur) => cur.filter((u) => u.id !== p.id));
      }
    }
    if (ok) {
      toast.success(`${ok} file${ok === 1 ? '' : 's'} added`);
      load();
      onChanged?.();
    }
  };

  const files = data?.files ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((f) =>
      (category === 'ALL' || f.category === category)
      && (source === 'ALL' || f.source === source)
      && (!q || [f.fileName, f.type, f.description, f.sourceLabel, f.addedBy].some((v) => v?.toLowerCase().includes(q))));
  }, [files, category, source, query]);

  // Generated documents (quotation / invoices) open their own page; everything else opens the viewer.
  const open = (f: ProjectFile) => {
    if (f.generated) { navigate(f.fileUrl); return; }
    const i = viewerFiles.indexOf(f);
    if (i >= 0) setViewerIndex(i);
  };
  const viewerFiles = useMemo(() => filtered.filter((f) => !f.generated), [filtered]);

  // Grid grouped by category when nothing narrows the list.
  const grouped = category === 'ALL' && source === 'ALL' && !query.trim();
  const sections = grouped
    ? CATEGORIES.map((c) => ({ ...c, items: filtered.filter((f) => f.category === c.id) })).filter((s) => s.items.length)
    : [{ id: 'ALL', label: '', items: filtered }];

  const uploadingTiles = uploading.map((u) => ({
    file: {
      key: u.id, source: 'PROJECT', sourceLabel: 'Uploaded here', type: u.type, kind: u.kind, category: 'PHOTO' as FileCategory,
      fileName: u.file.name, fileUrl: '', description: u.description, editable: false, generated: false,
    } as ProjectFile,
    previewUrl: u.previewUrl,
  }));

  const sourceKeys = Object.keys(data?.bySource ?? {});

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-800">Documents</h2>
          <p className="text-[13px] text-slate-500">
            {data ? `${data.total} file${data.total === 1 ? '' : 's'} — uploads, lead, measurement, quotation, bills, tasks, chat and site photos` : 'Loading…'}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Add files
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {[{ id: 'ALL' as const, label: 'All' }, ...CATEGORIES].map((c) => {
            const n = c.id === 'ALL' ? data?.total ?? 0 : data?.byCategory?.[c.id] ?? 0;
            if (c.id !== 'ALL' && !n) return null;
            const on = category === c.id;
            return (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${on ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {c.label} <span className={on ? 'text-emerald-100' : 'text-slate-400'}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, type, note, person…"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-[13px] outline-none focus:border-emerald-500" />
          </div>
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source"
            className="rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-emerald-500">
            <option value="ALL">All sources</option>
            {sourceKeys.map((s) => <option key={s} value={s}>{SOURCES[s] || s} ({data?.bySource[s]})</option>)}
          </select>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['grid', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setViewMode(v)} aria-label={v === 'grid' ? 'Grid view' : 'List view'}
                className={`rounded-lg p-1.5 ${view === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
                {v === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Files */}
      {!data ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading files…</p>
      ) : filtered.length === 0 && uploading.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center">
          <FolderOpen className="h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600">{files.length ? 'No files match these filters' : 'No files on this project yet'}</p>
          {canEdit && !files.length && (
            <button onClick={() => setAdding(true)} className="mt-1 text-sm font-semibold text-emerald-700 hover:underline">Add the first file</button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="flex flex-col gap-6">
          {uploadingTiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5">
              {uploadingTiles.map((u) => <FileTile key={u.file.key} file={u.file} previewUrl={u.previewUrl} uploading onOpen={() => {}} />)}
            </div>
          )}
          {sections.map((s) => (
            <section key={s.id}>
              {s.label && (
                <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                  {s.label} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{s.items.length}</span>
                </h3>
              )}
              <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5">
                {s.items.map((f) => <FileTile key={f.key} file={f} onOpen={() => open(f)} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {uploadingTiles.map((u) => (
              <li key={u.file.key} className="flex items-center gap-3 p-3 opacity-70">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg"><FileThumb kind={u.file.kind} previewUrl={u.previewUrl} name={u.file.fileName} /></div>
                <p className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{u.file.fileName}</p>
                <span className="text-[12px] text-emerald-700">Uploading…</span>
              </li>
            ))}
            {filtered.map((f) => (
              <li key={f.key}>
                <button onClick={() => open(f)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                    <FileThumb kind={f.kind} url={f.fileUrl} name={f.fileName} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{f.fileName}</p>
                    <p className="truncate text-[12px] text-slate-500">{f.description || f.type}</p>
                  </div>
                  <span className="hidden w-36 shrink-0 truncate text-[12px] font-medium text-slate-600 @3xl:block">{f.type}</span>
                  <span className="hidden w-48 shrink-0 @2xl:block"><SourceChip file={f} /></span>
                  <span className="hidden w-28 shrink-0 truncate text-[12px] text-slate-500 @4xl:block">{f.addedBy || '—'}</span>
                  <span className="w-20 shrink-0 text-right text-[12px] text-slate-400">{fmtWhen(f.addedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AddFilesDialog open={adding} onOpenChange={setAdding} onSubmit={submit} />
      {viewerIndex != null && (
        <FileViewer files={viewerFiles} index={viewerIndex} onIndex={setViewerIndex} onClose={() => setViewerIndex(null)}
          onChanged={() => { load(); onChanged?.(); }} canEdit={canEdit} />
      )}
    </div>
  );
}


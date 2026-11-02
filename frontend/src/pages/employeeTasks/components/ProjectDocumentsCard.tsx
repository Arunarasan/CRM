import { useCallback, useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import api from '@/lib/api';
import { ProjectFile, fmtWhen } from '@/pages/projectCommandCenter/documents/fileTypes';
import { FileThumb } from '@/pages/projectCommandCenter/documents/FileTile';
import FileViewer from '@/pages/projectCommandCenter/documents/FileViewer';

/**
 * "Documents" for a project task: every file on the project (quotation, drawings, photos,
 * agreements, site logs…) so the field team can open them, and rename, edit or delete the ones uploaded to the project.
 */
export default function ProjectDocumentsCard({ taskId }: { taskId: number }) {
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);

  const load = useCallback(() => {
    api.get(`/employee-tasks/${taskId}/project-files`)
      .then((r) => setFiles(r.data?.files || []))
      .catch(() => setFiles([]));
  }, [taskId]);
  useEffect(load, [load]);

  const taskApi = {
    update: (docId: number, body: { fileName?: string; documentType?: string; remarks?: string }) =>
      api.put(`/employee-tasks/${taskId}/project-files/${docId}`, body).then((r) => r.data),
    remove: (docId: number) => api.delete(`/employee-tasks/${taskId}/project-files/${docId}`),
    replaceFile: (docId: number, body: { fileUrl: string; fileName?: string }) =>
      api.put(`/employee-tasks/${taskId}/project-files/${docId}/file`, body).then((r) => r.data),
  };

  if (files === null) return null;
  const shown = all ? files : files.slice(0, 8);

  return (
    <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F2EC] text-[#0A573B]">
          <FolderOpen className="h-4 w-4" />
        </span>
        <h3 className="flex-1 text-[13px] font-bold uppercase tracking-wide text-[#1A211E]">Documents</h3>
        <span className="text-[12px] font-semibold text-[#7A817C]">{files.length}</span>
      </div>
      {files.length === 0 ? (
        <p className="mt-2.5 rounded-xl border border-dashed border-[#DDE2DE] bg-[#F7F8F6] px-3 py-3 text-center text-[12.5px] text-[#8A918C]">
          No documents on this project yet.
        </p>
      ) : (
        <>
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {shown.map((f, i) => (
              <button key={f.key} type="button" onClick={() => setOpen(i)} className="text-left">
                <div className="aspect-square overflow-hidden rounded-xl border border-[#ECEAE5] bg-[#F7F6F2]">
                  <FileThumb kind={f.kind} url={f.fileUrl} name={f.fileName} />
                </div>
                <p className="mt-1 truncate text-[10.5px] font-medium text-[#1A211E]">{f.fileName}</p>
                <p className="truncate text-[10px] text-[#8A918C]">{f.sourceLabel || fmtWhen(f.addedAt)}</p>
              </button>
            ))}
          </div>
          {files.length > 8 && (
            <button type="button" onClick={() => setAll((v) => !v)}
              className="mt-2 w-full rounded-lg bg-[#F7F8F6] py-1.5 text-[12px] font-semibold text-[#0A573B]">
              {all ? 'Show less' : `View all ${files.length}`}
            </button>
          )}
        </>
      )}
      <FileViewer files={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
        onChanged={load} canEdit api={taskApi} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { EmployeeDocumentEntry } from '@/types/employeePortal';
import { PortalHeader, EmptyState } from './_shared';

export default function Documents() {
  const [docs, setDocs] = useState<EmployeeDocumentEntry[]>([]);

  useEffect(() => { employeePortalApi.documents().then(setDocs).catch(() => setDocs([])); }, []);

  return (
    <div className="flex flex-col">
      <PortalHeader title="Documents" />
      <div className="mx-3 my-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {docs.length === 0 ? (
          <EmptyState message="No documents uploaded yet." />
        ) : (
          docs.map((d) => (
            <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 px-4 py-3 active:bg-accent/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.documentName}</p>
                <p className="text-xs text-muted-foreground">{d.documentType.replace(/_/g, ' ')}{d.uploadedDate ? ` · ${d.uploadedDate}` : ''}</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </a>
          ))
        )}
      </div>
    </div>
  );
}

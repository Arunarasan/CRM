import { useState } from "react";
import { FileImage, FileText } from "lucide-react";
import api from "@/lib/api";
import { uploadFile, resolveFileUrl } from "@/lib/uploadFile";
import { useImageViewer } from "@/components/ImageViewerProvider";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import CameraCaptureButton from "@/components/CameraCaptureButton";

const DOC_TYPES = ["Photos", "Videos", "Floor Plan", "CAD", "Agreement", "Invoice", "PO", "BOQ", "Approval"];

interface Props {
  projectId: number;
  documents: any[];
  onChanged: () => void;
}

/** Project document storage — upload from device/camera, import from the originating lead, view/edit images. */
export default function DocumentsTab({ projectId, documents, onChanged }: Props) {
  const [docType, setDocType] = useState('Photos');
  const [docUploading, setDocUploading] = useState(false);
  const [importingLeadDocs, setImportingLeadDocs] = useState(false);
  const { openImage } = useImageViewer();

  const uploadProjectDocument = async (file: File) => {
    setDocUploading(true);
    try {
      const { fileUrl, fileName } = await uploadFile(file, 'PROJECT');
      await api.post(`/projects/${projectId}/documents`, { fileName, fileUrl, documentType: docType });
      onChanged();
    } catch (err) {
      console.error('Failed to upload document', err);
      toast.error('Failed to upload document. Please try again.');
    } finally {
      setDocUploading(false);
    }
  };

  const importLeadDocuments = async () => {
    setImportingLeadDocs(true);
    try {
      const { data: res } = await api.post(`/projects/${projectId}/import-lead-assets`);
      onChanged();
      const n = res?.imported ?? 0;
      if (n > 0) toast.success(`Imported ${n} file${n === 1 ? '' : 's'} from the lead and measurement.`);
      else toast.info('Nothing new to import — the lead/measurement files are already here (or none were uploaded).');
    } catch (err) {
      console.error('Failed to import lead documents', err);
      toast.error('Could not import files from the lead. Please try again.');
    } finally {
      setImportingLeadDocs(false);
    }
  };

  const isImageDoc = (doc: any) => /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)(\?|#|$)/i.test(doc?.fileUrl || '');
  const openDocument = (doc: any) => {
    openImage({
      src: resolveFileUrl(doc.fileUrl),
      fileName: doc.fileName,
      editable: true,
      module: 'PROJECT',
      onReplace: ({ url, fileName }) => {
        api.put(`/projects/documents/${doc.id}/file`, { fileUrl: url, fileName })
          .then(() => onChanged())
          .catch(err => { console.error('Failed to replace document image', err); toast.error('Failed to save the edited image.'); });
      },
    });
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="text-center max-w-md mx-auto mb-6">
        <FileImage className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">Document Storage</h3>
        <p className="text-slate-500 mb-6">
          Upload architectural plans, site photos, approvals, and contracts straight from your device.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            {DOC_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          <Button asChild disabled={docUploading}>
            <label className="cursor-pointer">
              {docUploading ? "Uploading…" : "Upload File"}
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProjectDocument(f); e.target.value = ''; }}
              />
            </label>
          </Button>
          <CameraCaptureButton onCapture={uploadProjectDocument} disabled={docUploading} label="Camera"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-60" />
        </div>
        <div className="mt-3">
          <Button variant="outline" onClick={importLeadDocuments} disabled={importingLeadDocs}>
            {importingLeadDocs ? 'Importing…' : 'Import from Lead & Measurement'}
          </Button>
          <p className="text-xs text-slate-400 mt-1">Pulls in documents from the originating lead and drawings/photos from its measurement.</p>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="mt-4 text-left grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc: any) => (
            <a key={doc.id} href={resolveFileUrl(doc.fileUrl)} target="_blank" rel="noreferrer"
               onClick={isImageDoc(doc) ? (e) => { e.preventDefault(); e.stopPropagation(); openDocument(doc); } : undefined}
               className="p-4 border rounded-xl flex items-center gap-3 hover:border-emerald-400 hover:bg-slate-50 transition-colors">
              <FileText className="w-8 h-8 text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{doc.fileName}</div>
                <div className="text-xs text-slate-500 uppercase">{doc.documentType}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

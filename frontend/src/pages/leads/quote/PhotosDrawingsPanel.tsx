import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { resolveFileUrl, uploadFile } from "@/lib/uploadFile";
import { measurementApi } from "@/api/measurementApi";
import { leadApi } from "../leadApi";
import PhotoPickButtons from "@/pages/employeeTasks/components/PhotoPickButtons";
import FileViewer from "@/pages/projectCommandCenter/documents/FileViewer";
import type { ProjectFile } from "@/pages/projectCommandCenter/documents/fileTypes";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp"];
const isImage = (type?: string, url?: string) => {
  const t = (type || "").toLowerCase();
  if (t === "image" || t === "photo") return true;
  const ext = ((url || "").split("?")[0].split(".").pop() || "").toLowerCase();
  return IMAGE_EXT.includes(ext);
};
const isDrawingCategory = (c?: string) => /drawing/i.test(c || "");

const PHOTO_CATEGORY = "Site Photos";

/**
 * Site photos and drawing images for a lead's quote, in one list: add them here (camera or gallery — they are filed in
 * the lead's Documents) and tap any thumbnail for the full-screen viewer. Drawings already captured on
 * the lead's measurement show up too.
 */
export default function PhotosDrawingsPanel({ leadId, measurement, fieldMode }: {
  leadId: string;
  measurement?: any;
  fieldMode?: boolean;
}) {
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ list: ProjectFile[]; index: number } | null>(null);

  const load = useCallback(async () => {
    const [docs, drawings] = await Promise.all([
      leadApi.getDocuments(leadId).then((r) => r.data || []).catch(() => []),
      measurement?.id ? measurementApi.getDrawings(measurement.id).catch(() => []) : Promise.resolve([]),
    ]);
    const out: ProjectFile[] = [
      ...(docs as any[]).filter((d) => d.fileUrl && isImage(d.documentType, d.fileName || d.fileUrl)).map((d): ProjectFile => ({
        key: `doc${d.id}`, source: "LEAD", sourceLabel: "Lead documents", type: d.category || "Photo", kind: "image",
        category: isDrawingCategory(d.category) ? "DRAWING" : "PHOTO", fileName: d.fileName || "Image", fileUrl: d.fileUrl,
        description: d.description, addedBy: d.uploadedBy?.name, addedAt: d.createdAt, editable: false, generated: false,
      })),
      ...(drawings as any[]).filter((d) => d.filePath && isImage(undefined, d.filePath)).map((d): ProjectFile => ({
        key: `dr${d.id}`, source: "MEASUREMENT", sourceLabel: "Measurement", type: d.drawingType || "Drawing", kind: "image",
        category: "DRAWING", fileName: d.fileName || "Drawing", fileUrl: d.filePath, addedAt: d.createdAt, editable: false, generated: false,
      })),
    ];
    setFiles(out);
  }, [leadId, measurement?.id]);
  useEffect(() => { load(); }, [load]);

  const add = async (picked: File[]) => {
    setBusy(true);
    try {
      for (const f of picked) {
        const { fileUrl, fileName } = await uploadFile(f, "LEAD");
        await leadApi.addDocument(leadId, {
          fileUrl, fileName: fileName || f.name || "Site photo", category: PHOTO_CATEGORY, documentType: "Image", description: "",
        });
      }
      toast.success(picked.length > 1 ? `${picked.length} images added` : "Image added");
      await load();
    } catch {
      toast.error("Couldn't add that. Please try again.");
    } finally { setBusy(false); }
  };

  if (files === null) return <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border p-3">
        <div className="mb-2.5 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="flex-1 text-sm font-semibold">Photos &amp; drawings</h3>
          <span className="text-xs text-muted-foreground">{files.length}</span>
        </div>
        {files.length === 0 ? (
          <p className="mb-2.5 text-xs text-muted-foreground">Nothing added yet.</p>
        ) : (
          <div className="mb-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {files.map((f, i) => (
              <button key={f.key} type="button" onClick={() => setViewer({ list: files, index: i })}
                className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground/50" />
                <img src={resolveFileUrl(f.fileUrl)} alt={f.fileName} loading="lazy" className="relative h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
              </button>
            ))}
          </div>
        )}
        <PhotoPickButtons busy={busy} onPicked={add} />
      </section>
      {!fieldMode && (
        <Link to={`/leads/${leadId}?tab=documents`}>
          <Button variant="outline" size="sm">Open Documents</Button>
        </Link>
      )}
      {viewer && (
        <FileViewer files={viewer.list} index={viewer.index} onIndex={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewer(null)} onChanged={() => {}} canEdit={false} />
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { FolderOpen, Plus, Trash2, FileIcon, Ruler, PhoneCall, GalleryHorizontal } from "lucide-react";
import { measurementApi } from "@/api/measurementApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { formatDate } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";
import AddDocumentDialog from "./AddDocumentDialog";
import { resolveFileUrl } from "@/lib/uploadFile";
import AudioPlayer from "@/components/AudioPlayer";
import CallDetails from "@/components/callRecordings/CallDetails";
import { callRecordingApi, fmtCallTime, type CallRecording } from "@/api/callRecordingApi";
import FileViewer from "@/pages/projectCommandCenter/documents/FileViewer";
import { kindOfName, type ProjectFile } from "@/pages/projectCommandCenter/documents/fileTypes";

// Classify a document so photos render as thumbnails and voice notes as inline players.
// Prefer the stored documentType (set on capture); fall back to the file extension.
const extOf = (doc: any) => ((doc.fileName || doc.fileUrl || "").split("?")[0].split(".").pop() || "").toLowerCase();
const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif"];
const AUDIO_EXT = ["mp3", "wav", "ogg", "webm", "m4a", "aac", "opus", "oga"];
const isImageDoc = (doc: any) => doc.documentType === "Image" || IMAGE_EXT.includes(extOf(doc));
const isAudioDoc = (doc: any) => doc.documentType === "Audio" || AUDIO_EXT.includes(extOf(doc));

type MeasurementFile = { key: string; name: string; url: string; kind: string; date?: string; image: boolean };

// Shape lead documents and measurement files for the shared full-screen gallery viewer.
const docToFile = (doc: any): ProjectFile => ({
  key: `doc${doc.id}`, docId: doc.id, source: "LEAD", sourceLabel: "Lead documents",
  type: doc.documentType || doc.category || "File",
  kind: isImageDoc(doc) ? "image" : isAudioDoc(doc) ? "audio" : kindOfName(doc.fileName || doc.fileUrl),
  category: "DOCUMENT", fileName: doc.fileName, fileUrl: doc.fileUrl, description: doc.description || doc.remarks,
  addedBy: doc.uploadedBy?.name, addedAt: doc.createdAt, editable: false, generated: false,
});
const measurementToFile = (f: MeasurementFile): ProjectFile => ({
  key: f.key, source: "MEASUREMENT", sourceLabel: "Measurement", type: f.kind,
  kind: f.image ? "image" : kindOfName(f.name || f.url), category: f.image ? "PHOTO" : "DRAWING",
  fileName: f.name, fileUrl: f.url, addedAt: f.date, editable: false, generated: false,
});

/** "View all" — opens the gallery at the first file of a group. */
function ViewAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-primary hover:bg-primary/10">
      <GalleryHorizontal className="h-3.5 w-3.5" /> View all
    </button>
  );
}

export default function DocumentsTab({ leadId }: { leadId: string }) {
  const { items: allItems, loading, reload } = useLeadList<any>(() => leadApi.getDocuments(leadId), [leadId]);
  const [calls, setCalls] = useState<CallRecording[]>([]);
  useEffect(() => {
    callRecordingApi.forLead(Number(leadId)).then(setCalls).catch(() => setCalls([]));
  }, [leadId]);
  // A call's recording is also stored as a lead document — show it once, in Call recordings, with its details.
  const callUrls = new Set(calls.map((c) => c.fileUrl));
  const items = allItems.filter((d: any) => !callUrls.has(d.fileUrl));
  const [open, setOpen] = useState(false);
  const measurementFiles = useMeasurementFiles(leadId);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const remove = (doc: any) => {
    if (!confirm(`Remove document "${doc.fileName}"?`)) return;
    leadApi.deleteDocument(leadId, doc.id).then(reload).catch(console.error);
  };

  const grouped = items.reduce((acc: Record<string, any[]>, doc: any) => {
    const key = doc.category || "Other";
    (acc[key] = acc[key] || []).push(doc);
    return acc;
  }, {});

  // The gallery slides through files in the order they appear: measurement files, then each document group.
  const groupedDocs = (Object.values(grouped).flat() as any[]).filter((d) => d.fileUrl);
  const viewerFiles = [...(measurementFiles || []).filter((f) => f.url).map(measurementToFile), ...groupedDocs.map(docToFile)];
  const view = (key: string) => {
    const i = viewerFiles.findIndex((f) => f.key === key);
    if (i >= 0) setViewerIndex(i);
  };

  return (
    <div className="space-y-4">
    <MeasurementFiles files={measurementFiles} onOpen={view} />
    {calls.length > 0 && <CallRecordingsCard calls={calls} />}
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Document</Button>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No documents" description="Attach property images, floor plans, reference images, videos and agreements." />
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, docs]) => (
              <div key={category}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</h4>
                  {(docs as any[]).some((d) => d.fileUrl) && (
                    <ViewAllButton onClick={() => view(`doc${(docs as any[]).find((d) => d.fileUrl).id}`)} />
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(docs as any[]).map((doc) => {
                    const url = doc.fileUrl ? resolveFileUrl(doc.fileUrl) : "";
                    const meta = (
                      <div className="text-xs text-muted-foreground">
                        {doc.documentType || "File"} · {formatDate(doc.createdAt)}
                        {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ""}
                      </div>
                    );
                    // Photo: thumbnail preview that opens in the gallery.
                    if (isImageDoc(doc) && url) {
                      return (
                        <div key={doc.id} className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                          <button onClick={() => view(`doc${doc.id}`)} className="shrink-0">
                            <img src={url} alt={doc.fileName} className="h-14 w-14 rounded-md object-cover border" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <button onClick={() => view(`doc${doc.id}`)} className="text-sm font-medium text-primary hover:underline truncate block max-w-full text-left">
                              {doc.fileName}
                            </button>
                            {meta}
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(doc)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    }
                    // Voice note / audio: inline player.
                    if (isAudioDoc(doc) && url) {
                      return (
                        <div key={doc.id} className="border rounded-lg p-3 flex flex-col gap-2 bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate block">{doc.fileName}</span>
                              {meta}
                            </div>
                            <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(doc)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <AudioPlayer src={url} className="w-full" />
                        </div>
                      );
                    }
                    // Everything else: generic file row.
                    return (
                      <div key={doc.id} className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                        <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          {url ? (
                            <button onClick={() => view(`doc${doc.id}`)} className="text-sm font-medium text-primary hover:underline truncate block max-w-full text-left">
                              {doc.fileName}
                            </button>
                          ) : (
                            <span className="text-sm font-medium truncate block">{doc.fileName}</span>
                          )}
                          {meta}
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(doc)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AddDocumentDialog leadId={leadId} open={open} onOpenChange={setOpen} onAdded={reload} />
    </Card>
    {viewerIndex != null && (
      <FileViewer files={viewerFiles} index={viewerIndex} onIndex={setViewerIndex} onClose={() => setViewerIndex(null)}
        onChanged={reload} canEdit onDelete={(f) => leadApi.deleteDocument(leadId, f.docId!)} />
    )}
    </div>
  );
}

/** Call recordings that created this lead or were added to it, each with its call details. */
function CallRecordingsCard({ calls }: { calls: CallRecording[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PhoneCall className="h-4 w-4" /> Call recordings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {calls.map((c) => (
            <div key={c.id} className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <AudioPlayer src={resolveFileUrl(c.fileUrl)} fileName={c.calledAt ? `Call · ${fmtCallTime(c.calledAt)}` : c.fileName} />
              <CallDetails call={c} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Drawings and site photos captured on this lead's measurements (null while loading). */
function useMeasurementFiles(leadId: string) {
  const [files, setFiles] = useState<MeasurementFile[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ms: any[] = (await leadApi.getMeasurements(leadId).catch(() => ({ data: [] }))).data || [];
      const lists = await Promise.all(ms.map(async (m) => {
        const [drawings, media] = await Promise.all([
          measurementApi.getDrawings(m.id).catch(() => []),
          measurementApi.getMedia(m.id).catch(() => []),
        ]);
        return [
          ...drawings.map((d) => ({ key: `d${d.id}`, name: d.fileName, url: d.filePath, kind: d.drawingType || "Drawing", date: d.createdAt })),
          ...media.map((x) => ({
            key: `m${x.id}`, name: x.fileName, url: x.filePath,
            kind: [x.category || "Photo", x.measurementRoom?.roomName].filter(Boolean).join(" · "), date: x.createdAt,
          })),
        ];
      }));
      // Stored URLs are kept as-is: the viewer and the thumbnails resolve them.
      if (alive) setFiles(lists.flat().map((f) => ({ ...f, url: f.url || "", image: isImageDoc({ fileName: f.name, fileUrl: f.url }) })));
    })();
    return () => { alive = false; };
  }, [leadId]);

  return files;
}

/**
 * Drawings and site photos captured on this lead's measurements (the Quote's "Drawings & photos"
 * link lands here). Read-only — they're added/removed on the measurement itself.
 */
function MeasurementFiles({ files, onOpen }: { files: MeasurementFile[] | null; onOpen: (key: string) => void }) {
  if (!files || files.length === 0) return null;
  const first = files.find((f) => f.url);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Ruler className="h-4 w-4" /> Measurement drawings & photos</CardTitle>
        {first && <ViewAllButton onClick={() => onOpen(first.key)} />}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {files.map((f) => (
            <button key={f.key} onClick={() => onOpen(f.key)} disabled={!f.url}
              className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30 hover:bg-muted/60 text-left">
              {f.image && f.url
                ? <img src={resolveFileUrl(f.url)} alt={f.name} className="h-14 w-14 rounded-md object-cover border shrink-0" />
                : <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-primary truncate block">{f.name}</span>
                <div className="text-xs text-muted-foreground">{f.kind}{f.date ? ` · ${formatDate(f.date)}` : ""}</div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { FolderOpen, Plus, Trash2, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { DOCUMENT_CATEGORIES, formatDate } from "../constants";
import { SelectField, TextAreaField, TextField } from "../fields";
import { ListSkeleton, useLeadList } from "./shared";
import FileUploadField from "@/components/FileUploadField";
import { resolveFileUrl } from "@/lib/uploadFile";

const EMPTY = { fileName: "", fileUrl: "", category: "Property Images", documentType: "", description: "" };

export default function DocumentsTab({ leadId }: { leadId: string }) {
  const { items, loading, reload } = useLeadList<any>(() => leadApi.getDocuments(leadId), [leadId]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    leadApi.addDocument(leadId, form)
      .then(() => { setOpen(false); setForm({ ...EMPTY }); reload(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  const remove = (doc: any) => {
    if (!confirm(`Remove document "${doc.fileName}"?`)) return;
    leadApi.deleteDocument(leadId, doc.id).then(reload).catch(console.error);
  };

  const grouped = items.reduce((acc: Record<string, any[]>, doc: any) => {
    const key = doc.category || "Other";
    (acc[key] = acc[key] || []).push(doc);
    return acc;
  }, {});

  return (
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
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{category}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(docs as any[]).map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                      <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        {doc.fileUrl ? (
                          <a href={resolveFileUrl(doc.fileUrl)} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">
                            {doc.fileName}
                          </a>
                        ) : (
                          <span className="text-sm font-medium truncate block">{doc.fileName}</span>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {doc.documentType || "File"} · {formatDate(doc.createdAt)}
                          {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ""}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(doc)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <FileUploadField
              label="File"
              required
              module="LEAD"
              value={form.fileUrl}
              onChange={({ url, fileName }) => setForm((f: any) => ({
                ...f,
                fileUrl: url,
                fileName: f.fileName || fileName || "",
                documentType: f.documentType || (fileName ? fileName.split(".").pop()?.toUpperCase() : ""),
              }))}
            />
            <TextField label="File Name" required value={form.fileName} onChange={set("fileName")} />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Category" value={form.category} onChange={set("category")} options={DOCUMENT_CATEGORIES} allowEmpty={false} />
              <TextField label="File Type" value={form.documentType} onChange={set("documentType")} placeholder="PDF, Image, Video, CAD..." />
            </div>
            <TextAreaField label="Description" value={form.description} onChange={set("description")} />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

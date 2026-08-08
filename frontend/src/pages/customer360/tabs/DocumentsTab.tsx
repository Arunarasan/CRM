import { useState } from "react";
import { FileText, Download, Upload, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";
import { useAuth } from "@/hooks/useAuth";
import FileUploadField from "@/components/FileUploadField";
import { resolveFileUrl } from "@/lib/uploadFile";

const SOURCE_LABEL: Record<string, string> = {
  CUSTOMER: "Customer",
  PROJECT: "Project",
  QUOTATION: "Quotation",
  LEAD: "Lead",
};

export default function DocumentsTab({ customerId }: { customerId: string }) {
  const { hasAuthority } = useAuth();
  const canWrite = hasAuthority("CUSTOMER_WRITE");
  const { items, page, setPage, totalPages, isLoading, reload } = usePagedTab<any>(
    (page, size) => customer360Api.getDocuments(customerId, page, size),
    [customerId]
  );
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ fileName: "", fileUrl: "", fileType: "Photos" });

  const upload = () => {
    customer360Api.uploadDocument(customerId, form).then(() => {
      setIsOpen(false);
      setForm({ fileName: "", fileUrl: "", fileType: "Photos" });
      reload();
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-end mb-4">
          {canWrite && <Button size="sm" onClick={() => setIsOpen(true)}><Plus className="w-4 h-4" /> Upload Document</Button>}
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Floor plans, design files, agreements, invoices and photos across this customer's leads, quotations and projects will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={`${d.sourceType}-${d.id}`}>
                    <TableCell className="font-medium max-w-[200px] truncate">{d.fileName}</TableCell>
                    <TableCell>{d.documentType || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{SOURCE_LABEL[d.sourceType] || d.sourceType}</Badge>
                      {d.sourceLabel && <span className="ml-1 text-xs text-muted-foreground">{d.sourceLabel}</span>}
                    </TableCell>
                    <TableCell>{d.documentVersion ? `v${d.documentVersion}` : "—"}</TableCell>
                    <TableCell>{d.uploadedByName || "—"}</TableCell>
                    <TableCell>{d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      {d.fileUrl && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={resolveFileUrl(d.fileUrl)} target="_blank" rel="noreferrer"><Download className="w-3.5 h-3.5" /> Download</a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationFooter page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle><Upload className="w-4 h-4 inline mr-1" /> Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <FileUploadField
              label="File"
              required
              module="CUSTOMER"
              value={form.fileUrl}
              onChange={({ url, fileName }) => setForm((f) => ({ ...f, fileUrl: url, fileName: f.fileName || fileName || "" }))}
            />
            <div className="space-y-1"><Label>File Name</Label><Input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={form.fileType} onChange={(e) => setForm({ ...form, fileType: e.target.value })}>
                {["Floor Plan", "Design File", "Agreement", "Invoice", "Quotation PDF", "Photos", "Videos", "Warranty", "Completion Certificate"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={upload} disabled={!form.fileName || !form.fileUrl}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

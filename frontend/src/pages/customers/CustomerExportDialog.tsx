import { useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

type Row = Record<string, any>;
type Format = "xlsx" | "csv" | "pdf";

const FIELDS: { key: string; label: string; get?: (c: Row) => any; defaultOn?: boolean }[] = [
  { key: "customerCode", label: "Customer Code", defaultOn: true },
  { key: "name", label: "Name", defaultOn: true },
  { key: "customerSegment", label: "Segment", defaultOn: true },
  { key: "customerType", label: "Type" },
  { key: "companyName", label: "Company" },
  { key: "contactPersonName", label: "Contact Person" },
  { key: "phone", label: "Phone", defaultOn: true },
  { key: "alternatePhone", label: "Alternate Phone" },
  { key: "whatsappNumber", label: "WhatsApp" },
  { key: "email", label: "Email", defaultOn: true },
  { key: "billingAddress", label: "Billing Address" },
  { key: "siteAddress", label: "Site Address" },
  { key: "city", label: "City", defaultOn: true },
  { key: "district", label: "District" },
  { key: "state", label: "State", defaultOn: true },
  { key: "pincode", label: "Pincode" },
  { key: "country", label: "Country" },
  { key: "gstNumber", label: "GST Number" },
  { key: "status", label: "Status" },
  { key: "customerSince", label: "Customer Since" },
  { key: "tags", label: "Tags", defaultOn: true },
  { key: "leadCount", label: "Leads" },
  { key: "projectCount", label: "Projects" },
  { key: "totalPaid", label: "Total Paid" },
  { key: "lastPaymentDate", label: "Last Payment Date" },
  { key: "lastContact", label: "Last Contact", get: (c) => (c.lastContact ? String(c.lastContact).replace("T", " ").slice(0, 16) : "") },
];

export default function CustomerExportDialog({
  open, onOpenChange, params,
}: { open: boolean; onOpenChange: (o: boolean) => void; params: URLSearchParams }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(FIELDS.filter((f) => f.defaultOn).map((f) => f.key)));
  const [format, setFormat] = useState<Format>("xlsx");
  const [busy, setBusy] = useState(false);

  const toggle = (key: string) =>
    setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // Server-side export: every customer matching the current search / segment / filters, with tags and rollups.
  const fetchAll = async (): Promise<Row[]> => (await api.get(`/customers/export?${params.toString()}`)).data;

  const run = async () => {
    const cols = FIELDS.filter((f) => selected.has(f.key));
    if (!cols.length) return;
    setBusy(true);
    try {
      const rows = (await fetchAll()).map((c) => cols.map((f) => (f.get ? f.get(c) : c[f.key]) ?? ""));
      const head = cols.map((f) => f.label);
      if (format === "pdf") {
        const doc = new jsPDF({ orientation: cols.length > 6 ? "landscape" : "portrait" });
        doc.text("Customers List", 14, 15);
        (doc as any).autoTable({ head: [head], body: rows, startY: 20, styles: { fontSize: 8 } });
        doc.save("customers_export.pdf");
      } else {
        const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Customers");
        XLSX.writeFile(wb, `customers_export.${format}`, { bookType: format });
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Export Customers</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Exports all customers matching the current search, segment and filters.
        </p>

        <div className="flex gap-2">
          {(["xlsx", "csv", "pdf"] as Format[]).map((f) => (
            <Button key={f} size="sm" variant={format === f ? "default" : "outline"} onClick={() => setFormat(f)}>
              {f === "xlsx" ? "Excel" : f.toUpperCase()}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Columns ({selected.size})</span>
          <span className="space-x-3">
            <button className="text-primary" onClick={() => setSelected(new Set(FIELDS.map((f) => f.key)))}>All</button>
            <button className="text-primary" onClick={() => setSelected(new Set())}>None</button>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-64 overflow-y-auto">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={selected.has(f.key)} onChange={() => toggle(f.key)} />
              {f.label}
            </label>
          ))}
        </div>

        <Button onClick={run} disabled={busy || selected.size === 0}>
          <Download className="mr-2 h-4 w-4" /> {busy ? "Exporting..." : "Export"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

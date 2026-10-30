import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import api from "@/lib/api";
import {
  buildCatalogueMessage, matchCategories, waDigits, type CatalogCategory,
} from "@/lib/shareCategoryLinks";

/** Send the website pages of the categories a lead asked for, on WhatsApp. */
export default function ShareCatalogueDialog({ open, onClose, customerName, phone, categoryNames }: {
  open: boolean;
  onClose: () => void;
  customerName: string;
  phone: string;
  categoryNames: string[];
}) {
  const [all, setAll] = useState<CatalogCategory[] | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [to, setTo] = useState(phone);
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTo(phone);
    setOff(new Set());
    setEdited(false);
    if (!all) api.get("/public/categories").then((r) => setAll(r.data || [])).catch(() => setAll([]));
  }, [open, phone, all]);

  const matched = useMemo(() => matchCategories(categoryNames, all ?? []), [categoryNames, all]);
  const picked = matched.filter((m) => m.url && !off.has(m.name)) as { name: string; url: string }[];

  useEffect(() => {
    if (!edited) setMessage(picked.length ? buildCatalogueMessage(customerName, picked) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, off, customerName, edited, categoryNames]);

  const send = () => {
    const digits = waDigits(to);
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Message copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Share catalogue on WhatsApp</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            {matched.map((m) => (
              <label key={m.name} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" disabled={!m.url}
                  checked={!!m.url && !off.has(m.name)}
                  onChange={() => setOff((s) => { const n = new Set(s); n.has(m.name) ? n.delete(m.name) : n.add(m.name); return n; })} />
                <span className="min-w-0">
                  <span className="font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.url ?? (all ? "No website page found for this category" : "Loading…")}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">WhatsApp to</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Customer's number (or leave empty to pick in WhatsApp)"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
          </div>
          <textarea value={message} onChange={(e) => { setMessage(e.target.value); setEdited(true); }} rows={9}
            className="w-full rounded-md border bg-background p-2 text-sm" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={copy} disabled={!message}><Copy className="mr-1.5 h-4 w-4" /> Copy</Button>
            <Button onClick={send} disabled={!message} className="bg-emerald-700 hover:bg-emerald-800">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Send on WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

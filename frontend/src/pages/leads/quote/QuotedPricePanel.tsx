import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { quotationApi } from "@/api/quotationApi";
import type { Quotation } from "@/types/quotation";
import { pricingPatch, quoteTotals, readPricing, type QuotePricing } from "@/pages/quotations/quotationPricing";
import { NumCell } from "./cells";

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Once a quotation is raised, the Sales Journey shows the QUOTED price (not the locked pricing sheet):
 * customer discount and GST are editable right here and save to the quotation, and the difference
 * against the pricing sheet is spelled out so price changes are tracked instead of looking like a
 * mismatch.
 */
export default function QuotedPricePanel({
  quotationId, pricingSheetTotal, leadId, onChanged,
}: {
  quotationId: number;
  /** Grand total of the BOQ the quotation was raised from. */
  pricingSheetTotal?: number;
  leadId: string;
  onChanged: () => void;
}) {
  const { hasAuthority, isAdmin } = useAuth();
  const [q, setQ] = useState<Quotation | null>(null);
  const [pricing, setPricing] = useState<QuotePricing>({ mode: "PERCENT", value: 0, gst: 0 });
  const [saving, setSaving] = useState(false);

  const adopt = (fresh: Quotation) => { setQ(fresh); setPricing(readPricing(fresh)); };
  useEffect(() => { quotationApi.get(quotationId).then(adopt).catch(console.error); }, [quotationId]);

  if (!q) return <div className="h-40 rounded-lg border bg-muted/30 animate-pulse" />;

  const status = q.status || "DRAFT";
  const isManager = isAdmin || hasAuthority("ROLE_MANAGER") || hasAuthority("ROLE_PROJECT_MANAGER");
  const editable = (hasAuthority("QUOTATION_WRITE") || isAdmin) && status !== "CONVERTED" && (status !== "APPROVED" || isManager);
  const t = quoteTotals(q, { pricing });

  const save = async (next: QuotePricing) => {
    setPricing(next);
    setSaving(true);
    try {
      adopt(await quotationApi.update(quotationId, { ...q, ...pricingPatch(next) } as Quotation));
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not update the quotation.");
      setPricing(readPricing(q));
    } finally { setSaving(false); }
  };

  const sheet = Number(pricingSheetTotal ?? 0);
  const diff = t.grand - sheet;
  const showDiff = sheet > 0 && Math.abs(diff) >= 0.5;
  const dropped = (q.items || []).filter((i) => i.status === "REJECTED").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border p-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">{q.quotationNumber}</span>
          <Link to={`/quotations/${q.id}`} state={{ from: `/leads/${leadId}` }} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            Edit item prices <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <Row label={`Items (${t.count})${dropped ? ` · ${dropped} dropped` : ""}`} value={inr(t.subtotal)} />
        <Row label="Material" value={inr(t.material)} muted />
        <Row label="Labour" value={inr(t.labour)} muted />
        {sheet > 0 && <Row label="Pricing sheet total" value={inr(sheet)} muted />}
        {showDiff && (
          <div className={`flex items-center justify-between rounded px-2 py-1 text-xs font-medium ${diff < 0 ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
            <span className="flex items-center gap-1">
              {diff < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
              Quoted vs pricing sheet
            </span>
            <span className="tabular-nums">{diff > 0 ? "+" : "−"}{inr(Math.abs(diff))} ({((diff / sheet) * 100).toFixed(1)}%)</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground flex items-center gap-1">
            Discount
            <select className="h-7 rounded border bg-background px-1 text-xs" value={pricing.mode} disabled={!editable || saving}
              onChange={(e) => save({ ...pricing, mode: e.target.value as QuotePricing["mode"], value: 0 })}>
              <option value="PERCENT">%</option>
              <option value="FLAT">₹</option>
            </select>
          </span>
          <div className="flex items-center gap-2">
            <div className="w-24"><NumCell value={pricing.value} disabled={!editable || saving} className="h-7 border-border"
              onCommit={(v) => save({ ...pricing, value: v ?? 0 })} /></div>
            <span className="w-24 text-right tabular-nums text-muted-foreground">−{inr(t.discount)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">GST %</span>
          <div className="flex items-center gap-2">
            <div className="w-24"><NumCell value={pricing.gst} disabled={!editable || saving} className="h-7 border-border"
              onCommit={(v) => save({ ...pricing, gst: v ?? 0 })} /></div>
            <span className="w-24 text-right tabular-nums text-muted-foreground">+{inr(t.gst)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5">
          <span className="font-semibold flex items-center gap-1">Quoted total {saving && <Loader2 className="h-3 w-3 animate-spin" />}</span>
          <span className="font-bold text-base tabular-nums text-primary">{inr(t.grand)}</span>
        </div>
        {!editable && status !== "CONVERTED" && (
          <p className="text-[11px] text-muted-foreground">Approved quotations can be repriced by a manager.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-xs text-muted-foreground" : ""}`}>
      <span className={muted ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

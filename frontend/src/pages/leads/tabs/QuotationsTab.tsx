import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectClass } from "@/pages/leads/fields";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { boqApi } from "@/api/boqApi";
import { leadApi } from "../leadApi";
import { formatDate, formatINR, statusStyle } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";
import type { Boq } from "@/types/boq";

export default function QuotationsTab({ leadId }: { leadId: string }) {
  const navigate = useNavigate();
  const { items, loading } = useLeadList<any>(() => leadApi.getQuotations(leadId), [leadId]);
  // A quotation is generated from one of this lead's approved BOQs — no need to leave the lead for it.
  const { items: boqs, loading: boqLoading } = useLeadList<Boq>(() => leadApi.getBoqs(leadId), [leadId]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  // Which approved BOQ to raise the quotation from — the user picks instead of us guessing.
  const [selectedBoqId, setSelectedBoqId] = useState<number | "">("");

  // Only APPROVED BOQs can produce a quotation (backend guards on status). Show the latest
  // revision first so the default selection matches the most recent approved work.
  const approvedBoqs = useMemo(
    () =>
      boqs
        .filter((b) => b.status === "APPROVED" && b.id != null)
        .sort((a, b) => (b.isLatestVersion === true ? 1 : 0) - (a.isLatestVersion === true ? 1 : 0)),
    [boqs],
  );
  const latestBoq = boqs.find((b) => b.isLatestVersion !== false) ?? boqs[0];

  // Default to the first (latest) approved BOQ once they load, and keep the selection valid.
  useEffect(() => {
    if (approvedBoqs.length === 0) {
      if (selectedBoqId !== "") setSelectedBoqId("");
      return;
    }
    if (selectedBoqId === "" || !approvedBoqs.some((b) => b.id === selectedBoqId)) {
      setSelectedBoqId(approvedBoqs[0].id as number);
    }
  }, [approvedBoqs, selectedBoqId]);

  const handleGenerate = () => {
    if (selectedBoqId === "") return;
    setGenerating(true);
    setError("");
    // Full-house is the common case; partial/budget scoping stays on the BOQ page.
    boqApi.generateQuotation(selectedBoqId, { mode: "FULL_HOUSE" })
      .then((q: any) => navigate(`/quotations/${q.id}`))
      .catch((e) => setError(e?.response?.data?.message || e?.response?.data || "Failed to generate quotation."))
      .finally(() => setGenerating(false));
  };

  const boqLabel = (b: Boq) =>
    `${b.boqNumber ?? `BOQ #${b.id}`} · Rev ${b.revisionNumber ?? 1}` +
    `${b.isLatestVersion === true ? " (latest)" : ""} · ${formatINR(b.grandTotal)}`;

  // Explain why generation is unavailable rather than leaving a dead button.
  const disabledReason = (() => {
    if (boqLoading) return null;
    if (boqs.length === 0) return "Generate a BOQ (BOQ tab) and get it approved before raising a quotation.";
    if (approvedBoqs.length === 0) return "A BOQ must be approved before a quotation can be generated from it.";
    return null;
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Quotations</CardTitle>
        <div className="flex items-center gap-2">
          {approvedBoqs.length > 0 && (
            <select
              className={`${selectClass} h-9 w-auto max-w-[16rem]`}
              value={selectedBoqId}
              onChange={(e) => setSelectedBoqId(e.target.value ? Number(e.target.value) : "")}
              disabled={generating}
              aria-label="Select BOQ to generate quotation from"
            >
              {approvedBoqs.map((b) => (
                <option key={b.id} value={b.id}>{boqLabel(b)}</option>
              ))}
            </select>
          )}
          <Button size="sm" onClick={handleGenerate} disabled={selectedBoqId === "" || generating}>
            <Plus className="h-4 w-4 mr-2" />
            {generating ? "Generating..." : "Generate Quotation"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {disabledReason && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground flex items-center justify-between gap-3">
            <span>{disabledReason}</span>
            {boqs.length > 0 && approvedBoqs.length === 0 && latestBoq && (
              <Link to={`/boq/${latestBoq.id}`}>
                <Button variant="outline" size="sm" className="shrink-0">Open BOQ</Button>
              </Link>
            )}
          </div>
        )}

        {loading ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <EmptyState icon={FileText} title="No quotations" description="All quotation versions raised for this lead will appear here with their approval status." />
        ) : (
          items.map((q) => (
            <div key={q.id} className="border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/30">
              <div>
                <div className="flex items-center gap-2">
                  <Link to={`/quotations/${q.id}`} className="font-medium text-sm text-primary hover:underline">{q.quotationNumber}</Link>
                  <span className="text-xs px-2 py-0.5 bg-background border rounded-full">Rev {q.revisionNumber ?? 0}</span>
                  {q.status && <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusStyle(q.status)}`}>{q.status}</span>}
                  {q.internalApprovalStatus && (
                    <span className="text-[10px] uppercase px-2 py-0.5 bg-muted rounded-full">Approval: {q.internalApprovalStatus}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDate(q.quotationDate)} · Total: <span className="font-semibold text-foreground">{formatINR(q.grandTotal ?? q.totalAmount)}</span>
                  {q.expiryDate ? ` · valid till ${formatDate(q.expiryDate)}` : ""}
                </div>
              </div>
              <Link to={`/quotations/${q.id}`}>
                <Button variant="outline" size="sm">Open</Button>
              </Link>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

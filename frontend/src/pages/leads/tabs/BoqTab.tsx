import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileSpreadsheet, Plus, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { boqApi } from "@/api/boqApi";
import { leadApi } from "../leadApi";
import { formatDate, formatINR, statusStyle } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";
import type { Boq } from "@/types/boq";

export default function BoqTab({ leadId }: { leadId: string }) {
  const navigate = useNavigate();
  const { items, loading } = useLeadList<Boq>(() => leadApi.getBoqs(leadId), [leadId]);
  // A lead has a single measurement, but it stays editable until finalised — the BOQ is generated
  // from whatever that measurement holds once it reaches "Completed".
  const { items: measurements, loading: measLoading } = useLeadList<any>(
    () => leadApi.getMeasurements(leadId), [leadId]);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const measurement = measurements[0];
  const measStatus: string | undefined = measurement?.status;
  const hasBoq = items.length > 0;
  // Mirror MeasurementDetails: one master BOQ per measurement, only once the measurement is Completed.
  const canCreate = !!measurement && measStatus === "Completed" && !hasBoq;

  const handleCreate = () => {
    if (!measurement) return;
    setCreating(true);
    setError("");
    boqApi.createFromMeasurement(measurement.id)
      .then((boq) => navigate(`/boq/${boq.id}/edit`))
      .catch((e) => setError(e?.response?.data?.message || e?.response?.data || "Failed to create BOQ."))
      .finally(() => setCreating(false));
  };

  // Explain why the create button is unavailable, so it is never a mysteriously dead control.
  const disabledReason = (() => {
    if (measLoading) return null;
    if (!measurement) return null; // handled by the dedicated no-measurement panel below
    if (hasBoq) return "A BOQ already exists for this measurement. Open it to create a revision or sync the latest measurement changes.";
    if (measStatus !== "Completed")
      return `The measurement (${measurement.measurementNumber || `#${measurement.id}`}) is currently "${measStatus || "Draft"}". Complete it before generating the BOQ.`;
    return null;
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Bill of Quantities</CardTitle>
        {measurement && (
          <Button size="sm" onClick={handleCreate} disabled={!canCreate || creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? "Creating..." : "Create New BOQ"}
          </Button>
        )}
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
            {measStatus !== "Completed" && !hasBoq && (
              <Link to={`/measurements/${measurement.id}`} state={{ from: `/leads/${leadId}` }}>
                <Button variant="outline" size="sm" className="shrink-0">Open Measurement</Button>
              </Link>
            )}
          </div>
        )}

        {loading || measLoading ? (
          <ListSkeleton />
        ) : !measurement ? (
          <EmptyState
            icon={Ruler}
            title="No measurement yet"
            description="A BOQ is generated from this lead's measurement. Record and complete a measurement first, then create the BOQ here."
            action={
              <Link to={`/measurements/new?leadId=${leadId}`} state={{ from: `/leads/${leadId}` }}>
                <Button size="sm" variant="outline">Record Measurement</Button>
              </Link>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No BOQs" description="BOQs generated from this lead's measurement will appear here." />
        ) : (
          items.map((b) => (
            <div key={b.id} className="border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/30">
              <div>
                <div className="flex items-center gap-2">
                  <Link to={`/boq/${b.id}`} state={{ from: `/leads/${leadId}` }} className="font-medium text-sm text-primary hover:underline">{b.boqNumber}</Link>
                  <span className="text-xs px-2 py-0.5 bg-background border rounded-full">Rev {b.revisionNumber ?? 1}</span>
                  {b.status && <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusStyle(b.status)}`}>{b.status}</span>}
                  {b.linkStatus === "UNLINKED_LEGACY" && (
                    <span className="text-[10px] uppercase px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Unlinked</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDate(b.createdAt)} · Total: <span className="font-semibold text-foreground">{formatINR(b.grandTotal)}</span>
                </div>
              </div>
              <Link to={`/boq/${b.id}`} state={{ from: `/leads/${leadId}` }}>
                <Button variant="outline" size="sm">Open</Button>
              </Link>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

import { Link } from "react-router-dom";
import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { formatDate, statusStyle } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";

export default function MeasurementsTab({ leadId }: { leadId: string }) {
  const { items, loading } = useLeadList<any>(() => leadApi.getMeasurements(leadId), [leadId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Measurements</CardTitle>
        <Link to={`/measurements/new?leadId=${leadId}`} state={{ from: `/leads/${leadId}` }}>
          <Button size="sm" variant="outline">New Measurement</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={Ruler} title="No measurements" description="Measurements recorded for this lead's site will be listed here." />
        ) : (
          <div className="space-y-3">
            {items.map((m) => (
              <div key={m.id} className="border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/measurements/${m.id}`} state={{ from: `/leads/${leadId}` }} className="font-medium text-sm text-primary hover:underline">
                      {m.measurementNumber || `Measurement #${m.id}`}
                    </Link>
                    {m.status && <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusStyle(m.status)}`}>{m.status}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {m.measurementType || "Measurement"} · {formatDate(m.measurementDate)}
                    {m.measuredBy ? ` · by ${m.measuredBy}` : ""}
                    {m.totalArea ? ` · ${m.totalArea} sq.ft` : ""}
                  </div>
                </div>
                <Link to={`/measurements/${m.id}`} state={{ from: `/leads/${leadId}` }}>
                  <Button variant="outline" size="sm">Open</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


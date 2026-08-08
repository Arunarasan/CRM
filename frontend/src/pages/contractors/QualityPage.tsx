import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorQualityInspection } from "@/types/contractor";
import { QC_RESULT_TONE } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Quality control across contractors: open failures/rework first, full inspection history second. */
export default function QualityPage() {
  const [open, setOpen] = useState<ContractorQualityInspection[]>([]);
  const [all, setAll] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(() => {
    contractorApi.getOpenQualityIssues().then(setOpen).catch(() => setOpen([]));
    contractorApi.reportQuality().then(setAll).catch(() => setAll([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open issues ({open.length})</TabsTrigger>
          <TabsTrigger value="all">All inspections</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <Panel title="Failed and rework inspections"
                 subtitle="A package with an open failure cannot be closed until a fresh inspection passes.">
            <table className="w-full text-sm">
              <thead className="text-slate-500 border-b">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Inspection</th>
                  <th className="p-3 font-semibold">Work package</th>
                  <th className="p-3 font-semibold">Contractor</th>
                  <th className="p-3 font-semibold">Defects</th>
                  <th className="p-3 font-semibold">Corrective action</th>
                  <th className="p-3 font-semibold">Rework due</th>
                  <th className="p-3 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {open.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No open quality issues.</td></tr>
                )}
                {open.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{q.inspectionNumber}
                      <div className="text-slate-400">{q.inspectionDate}</div>
                    </td>
                    <td className="p-3">
                      <Link to={`/contractors/work-packages/${q.workPackage.id}`}
                            className="font-semibold text-slate-800 hover:text-primary">
                        {q.workPackage.packageName}
                      </Link>
                      <div className="text-[11px] text-slate-400">{q.project?.projectName}</div>
                    </td>
                    <td className="p-3">{q.contractor?.name}</td>
                    <td className="p-3 text-rose-600">{q.defects ?? "—"}</td>
                    <td className="p-3">{q.correctiveAction ?? "—"}</td>
                    <td className="p-3">{q.reworkDueDate ?? "—"}</td>
                    <td className="p-3"><Badge className={QC_RESULT_TONE[q.result]}>{q.result}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </TabsContent>

        <TabsContent value="all">
          <Panel title="Inspection history">
            <table className="w-full text-sm">
              <thead className="text-slate-500 border-b">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Inspection</th>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Contractor</th>
                  <th className="p-3 font-semibold">Package</th>
                  <th className="p-3 font-semibold text-center">Score</th>
                  <th className="p-3 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {all.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No inspections recorded.</td></tr>
                )}
                {all.map((q, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{String(q.inspectionNumber ?? "—")}</td>
                    <td className="p-3">{String(q.inspectionDate ?? "—")}</td>
                    <td className="p-3 text-xs">{String(q.inspectionType ?? "—").replace(/_/g, " ")}</td>
                    <td className="p-3">{String(q.contractorName ?? "—")}</td>
                    <td className="p-3 text-xs">{String(q.workPackage ?? "—")}</td>
                    <td className="p-3 text-center font-semibold">{q.score == null ? "—" : String(q.score)}</td>
                    <td className="p-3">
                      <Badge className={QC_RESULT_TONE[String(q.result)] ?? "bg-slate-100 text-slate-700"}>
                        {String(q.result)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mt-4">
      <div className="p-4 border-b bg-slate-50">
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { contractorApi } from "@/api/contractorApi";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type Row = Record<string, unknown>;

const REPORTS: {
  key: string; label: string; description: string;
  load: () => Promise<Row[]>;
  columns: { key: string; label: string; align?: "right" | "center"; money?: boolean }[];
}[] = [
  {
    key: "performance",
    label: "Contractor Performance",
    description: "Delivery, quality and safety scorecard per contractor.",
    load: () => contractorApi.reportPerformance(),
    columns: [
      { key: "contractorCode", label: "Code" },
      { key: "contractorName", label: "Contractor" },
      { key: "trade", label: "Trade" },
      { key: "totalPackages", label: "Packages", align: "center" },
      { key: "completedPackages", label: "Completed", align: "center" },
      { key: "delayedPackages", label: "Delayed", align: "center" },
      { key: "onTimePercent", label: "On time %", align: "center" },
      { key: "qualityRating", label: "Quality", align: "center" },
      { key: "safetyRating", label: "Safety", align: "center" },
      { key: "overallRating", label: "Overall", align: "center" },
      { key: "totalBilled", label: "Billed", align: "right", money: true },
    ],
  },
  {
    key: "delayed-works",
    label: "Delayed Works",
    description: "Packages past their end date and still open.",
    load: () => contractorApi.reportDelayedWorks(),
    columns: [
      { key: "packageCode", label: "Package" },
      { key: "packageName", label: "Name" },
      { key: "projectName", label: "Project" },
      { key: "contractors", label: "Contractor" },
      { key: "endDate", label: "Due" },
      { key: "daysDelayed", label: "Days late", align: "center" },
      { key: "completionPercentage", label: "Progress %", align: "center" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "cost-analysis",
    label: "Cost Analysis",
    description: "Estimated vs approved vs billed vs paid, per work package.",
    load: () => contractorApi.reportCostAnalysis(),
    columns: [
      { key: "packageCode", label: "Package" },
      { key: "projectName", label: "Project" },
      { key: "contractors", label: "Contractor" },
      { key: "estimatedCost", label: "Estimated", align: "right", money: true },
      { key: "approvedCost", label: "Approved", align: "right", money: true },
      { key: "billedAmount", label: "Billed", align: "right", money: true },
      { key: "paidAmount", label: "Paid", align: "right", money: true },
      { key: "outstanding", label: "Outstanding", align: "right", money: true },
      { key: "variance", label: "Variance", align: "right", money: true },
      { key: "variancePercent", label: "Var %", align: "center" },
    ],
  },
  {
    key: "payment-summary",
    label: "Payment Summary",
    description: "Advances, payments, outstanding and retention per contractor.",
    load: () => contractorApi.reportPaymentSummary(),
    columns: [
      { key: "contractorCode", label: "Code" },
      { key: "contractorName", label: "Contractor" },
      { key: "trade", label: "Trade" },
      { key: "advancesPaid", label: "Advances", align: "right", money: true },
      { key: "totalPaid", label: "Paid", align: "right", money: true },
      { key: "outstanding", label: "Outstanding", align: "right", money: true },
      { key: "retentionHeld", label: "Retention", align: "right", money: true },
      { key: "ledgerBalance", label: "Ledger", align: "right", money: true },
    ],
  },
  {
    key: "outstanding-bills",
    label: "Outstanding Bills",
    description: "Bills awaiting approval or payment, oldest first.",
    load: () => contractorApi.reportOutstandingBills(),
    columns: [
      { key: "billNumber", label: "Bill" },
      { key: "billType", label: "Type" },
      { key: "billDate", label: "Date" },
      { key: "ageDays", label: "Age (d)", align: "center" },
      { key: "contractorName", label: "Contractor" },
      { key: "projectName", label: "Project" },
      { key: "netAmount", label: "Net", align: "right", money: true },
      { key: "balanceAmount", label: "Balance", align: "right", money: true },
      { key: "currentApprovalStage", label: "Stage" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "material-consumption",
    label: "Material Consumption",
    description: "Materials issued to contractors and how they were accounted for.",
    load: () => contractorApi.reportMaterialConsumption(),
    columns: [
      { key: "issueNumber", label: "Issue" },
      { key: "contractorName", label: "Contractor" },
      { key: "workPackage", label: "Package" },
      { key: "material", label: "Material" },
      { key: "issuedQuantity", label: "Issued", align: "right" },
      { key: "returnedQuantity", label: "Returned", align: "right" },
      { key: "consumedQuantity", label: "Consumed", align: "right" },
      { key: "wasteQuantity", label: "Waste", align: "right" },
      { key: "damagedQuantity", label: "Damaged", align: "right" },
      { key: "recoverableValue", label: "Recoverable", align: "right", money: true },
    ],
  },
  {
    key: "quality",
    label: "Quality Report",
    description: "Every inspection with its outcome and score.",
    load: () => contractorApi.reportQuality(),
    columns: [
      { key: "inspectionNumber", label: "Inspection" },
      { key: "inspectionDate", label: "Date" },
      { key: "inspectionType", label: "Type" },
      { key: "contractorName", label: "Contractor" },
      { key: "workPackage", label: "Package" },
      { key: "result", label: "Result" },
      { key: "score", label: "Score", align: "center" },
      { key: "defects", label: "Defects" },
    ],
  },
  {
    key: "attendance",
    label: "Attendance Report",
    description: "Labour deployed per contractor over the last 30 days.",
    load: () => contractorApi.reportAttendance(),
    columns: [
      { key: "contractorName", label: "Contractor" },
      { key: "trade", label: "Trade" },
      { key: "workingDays", label: "Working days", align: "center" },
      { key: "absentDays", label: "Absent", align: "center" },
      { key: "totalManDays", label: "Man-days", align: "center" },
      { key: "averageWorkersPerDay", label: "Avg workers/day", align: "center" },
      { key: "totalHours", label: "Hours", align: "right" },
    ],
  },
  {
    key: "safety",
    label: "Safety Report",
    description: "PPE checks, incidents and violations.",
    load: () => contractorApi.reportSafety(),
    columns: [
      { key: "recordDate", label: "Date" },
      { key: "recordType", label: "Type" },
      { key: "severity", label: "Severity" },
      { key: "contractorName", label: "Contractor" },
      { key: "projectName", label: "Project" },
      { key: "ppeCompliant", label: "PPE", align: "center" },
      { key: "description", label: "Description" },
      { key: "penaltyAmount", label: "Penalty", align: "right", money: true },
      { key: "status", label: "Status" },
    ],
  },
];

const currency = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ContractorReportsPage() {
  const [active, setActive] = useState(REPORTS[0]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    active.load().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [active]);

  const exportCsv = () => {
    const header = active.columns.map((c) => c.label).join(",");
    const body = rows.map((r) =>
      active.columns.map((c) => {
        const v = r[c.key];
        const s = v == null ? "" : String(v);
        return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contractor-${active.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const render = (r: Row, c: (typeof active.columns)[number]) => {
    const v = r[c.key];
    if (v == null || v === "") return "—";
    if (c.money) return currency(v);
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v).replace(/_/g, " ");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button key={r.key} onClick={() => setActive(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    active.key === r.key ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
                  }`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{active.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{active.description}</p>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 border-b">
              <tr className="text-left">
                {active.columns.map((c) => (
                  <th key={c.key} className={`p-3 font-semibold ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr><td colSpan={active.columns.length} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={active.columns.length} className="p-8 text-center text-muted-foreground">
                  No data for this report yet.
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {active.columns.map((c) => (
                    <td key={c.key} className={`p-3 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                      {render(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

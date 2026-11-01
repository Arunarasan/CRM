import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { payrollApi } from "@/api/payrollApi";
import { useGoBack } from "@/hooks/useGoBack";
import type { Payslip } from "@/types/employeePortal";
import { buildPayslipHtml, downloadPayslipPdf, printPayslip, type PayslipEmployee } from "@/pages/employeePortal/printPayslip";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";

/** HR view of a payslip: previews the exact document the employee gets (shared builder) and prints it. */
export default function PayslipPrint() {
  const { id } = useParams();
  const goBack = useGoBack("/workforce/payroll");
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [opts, setOpts] = useState<PayslipEmployee>({ employeeName: "Employee" });
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    payrollApi.payslip(Number(id))
      .then(async (r) => {
        const rec = r.record;
        const emp = rec.employee || {};
        const o = {
          employeeName: [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "Employee",
          employeeCode: emp.employeeCode || undefined,
          designation: emp.designation,
          department: emp.department?.name,
          dateOfJoining: emp.dateOfJoining,
          bankAccount: emp.bankAccount,
          uan: emp.uan,
          pfNumber: emp.pfNumber,
          esiNumber: emp.esiNumber,
        };
        const s = rec as unknown as Payslip;
        setSlip(s);
        setOpts(o);
        setHtml(await buildPayslipHtml(s, o));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!slip) return <div className="p-8 text-center text-muted-foreground">Payslip not found.</div>;

  // A payslip is a snapshot of attendance at the moment it was generated. If hours were approved or
  // closed afterwards it shows zero earnings/attendance, so let HR rebuild it from today's attendance.
  const refresh = () => {
    if (!window.confirm("Rebuild this payslip from the current attendance? Manual line edits on it are replaced.")) return;
    setRefreshing(true);
    payrollApi.regeneratePayslip(Number(id))
      .then((rec) => { toast.success("Payslip rebuilt from attendance."); navigate(`/hr/payslip/${rec.id}`, { replace: true }); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Could not rebuild the payslip."))
      .finally(() => setRefreshing(false));
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2">
          {slip.status !== "PAID" && (
            <Button variant="outline" disabled={refreshing} onClick={refresh}><RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh from attendance</Button>
          )}
          <Button variant="outline" onClick={() => printPayslip(slip, opts)}><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Button disabled={downloading} onClick={() => {
            setDownloading(true);
            downloadPayslipPdf(slip, opts).catch(() => toast.error("Could not create the PDF. Please try again.")).finally(() => setDownloading(false));
          }}><Download className="w-4 h-4 mr-1" /> {downloading ? "Preparing…" : "Download PDF"}</Button>
        </div>
      </div>
      <iframe
        title="Payslip preview"
        srcDoc={html}
        className="w-full bg-white border rounded-2xl shadow-sm"
        style={{ height: "1100px" }}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { payrollApi } from "@/api/payrollApi";
import { useGoBack } from "@/hooks/useGoBack";
import type { Payslip } from "@/types/employeePortal";
import { buildPayslipHtml, printPayslip } from "@/pages/employeePortal/printPayslip";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

/** HR view of a payslip: previews the exact document the employee gets (shared builder) and prints it. */
export default function PayslipPrint() {
  const { id } = useParams();
  const goBack = useGoBack("/workforce/payroll");
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [opts, setOpts] = useState<{ employeeName: string; employeeCode?: string }>({ employeeName: "Employee" });
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    payrollApi.payslip(Number(id))
      .then(async (r) => {
        const rec = r.record;
        const emp = rec.employee || {};
        const o = {
          employeeName: [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "Employee",
          employeeCode: emp.employeeCode || undefined,
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

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Button onClick={() => printPayslip(slip, opts)}><Printer className="w-4 h-4 mr-1" /> Print / Save PDF</Button>
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

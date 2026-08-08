import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorDetail } from "@/types/contractor";
import {
  CONTRACTOR_STATUS_TONE, WP_STATUS_TONE, BILL_STATUS_TONE,
} from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Star, Phone, Mail, Building2, MapPin } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ContractorDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<ContractorDetail | null>(null);

  useEffect(() => {
    if (id) contractorApi.get(Number(id)).then(setData).catch(console.error);
  }, [id]);

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading contractor…</div>;

  const c = data.contractor;
  const p = data.performance;

  return (
    <div className="space-y-5">
      <Link to="/contractors/directory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> All contractors
      </Link>

      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-slate-900">{c.name}</h2>
              <Badge className={CONTRACTOR_STATUS_TONE[c.status]}>{c.status.replace(/_/g, " ")}</Badge>
              {c.trade && <Badge className="bg-slate-100 text-slate-700">{c.trade.replace(/_/g, " ")}</Badge>}
              <span className="font-mono text-xs text-slate-400">{c.contractorCode}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              {c.companyName && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{c.companyName}</span>}
              {c.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{c.phone}</span>}
              {c.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{c.email}</span>}
              {c.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{c.city}{c.state ? `, ${c.state}` : ""}</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <Stat label="Overall" value={c.overallRating} star />
            <Stat label="Quality" value={c.ratingQuality} star />
            <Stat label="Timeliness" value={c.ratingTimeliness} star />
            <Stat label="Safety" value={c.ratingSafety} star />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t">
          <Metric label="Work packages" value={`${p.completedPackages}/${p.totalPackages}`} hint={`${p.delayedPackages} delayed`} />
          <Metric label="On-time delivery" value={`${p.onTimeDeliveryPercent}%`} />
          <Metric label="Total billed" value={currency(p.totalBilled)} />
          <Metric label="Outstanding" value={currency(data.outstanding.billedOutstanding)} hint={`retention ${currency(data.outstanding.retentionHeld)}`} />
          <Metric label="Ledger balance" value={currency(data.outstanding.ledgerBalance)} hint="payable to contractor" />
        </div>
      </div>

      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages">Work Packages</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="statutory">Statutory</TabsTrigger>
        </TabsList>

        <TabsContent value="packages">
          <Card>
            <SimpleTable
              head={["Package", "Project", "Trade", "Status", "Progress", "Billed"]}
              rows={data.workPackages.map((w) => [
                <Link to={`/contractors/work-packages/${w.id}`} className="font-semibold text-slate-800 hover:text-primary">
                  {w.packageCode} · {w.packageName}
                </Link>,
                w.project?.projectName ?? "—",
                w.trade?.replace(/_/g, " ") ?? "—",
                <Badge className={WP_STATUS_TONE[w.status]}>{w.status.replace(/_/g, " ")}</Badge>,
                `${w.completionPercentage}%`,
                currency(w.billedAmount),
              ])}
              empty="No work packages assigned yet."
            />
          </Card>
        </TabsContent>

        <TabsContent value="bills">
          <Card>
            <SimpleTable
              head={["Bill", "Type", "Date", "Net", "Paid", "Balance", "Status"]}
              rows={data.bills.map((b) => [
                <Link to={`/contractors/bills/${b.id}`} className="font-semibold text-slate-800 hover:text-primary">{b.billNumber}</Link>,
                b.billType, b.billDate, currency(b.netAmount), currency(b.paidAmount), currency(b.balanceAmount),
                <Badge className={BILL_STATUS_TONE[b.status]}>{b.status.replace(/_/g, " ")}</Badge>,
              ])}
              empty="No bills raised yet."
            />
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <SimpleTable
              head={["Date", "Type", "Amount", "Mode", "Reference", "Bill"]}
              rows={data.payments.map((pm) => [
                pm.paymentDate ?? "—", pm.paymentType.replace(/_/g, " "), currency(pm.amount),
                pm.paymentMode ?? "—", pm.referenceNumber ?? "—", pm.bill?.billNumber ?? "—",
              ])}
              empty="No payments recorded yet."
            />
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <SimpleTable
              head={["Date", "Work package", "Status", "Workers", "In", "Out", "Hours"]}
              rows={data.attendance.map((a) => [
                a.date, a.workPackage?.packageCode ?? "—", a.status, a.workersCount ?? "—",
                a.inTime ?? "—", a.outTime ?? "—", a.hoursWorked ?? "—",
              ])}
              empty="No attendance recorded yet."
            />
          </Card>
        </TabsContent>

        <TabsContent value="safety">
          <Card>
            <SimpleTable
              head={["Date", "Type", "Severity", "PPE", "Description", "Penalty", "Status"]}
              rows={data.safety.map((s) => [
                s.recordDate, s.recordType.replace(/_/g, " "), s.severity ?? "—",
                s.ppeCompliant ? "Compliant" : "Non-compliant", s.description ?? "—",
                currency(s.penaltyAmount), s.status,
              ])}
              empty="No safety records."
            />
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <SimpleTable
              head={["Type", "File", "Number", "Expiry", "Verified", ""]}
              rows={data.documents.map((d) => [
                d.type, <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.fileName}</a>,
                d.documentNumber ?? "—",
                d.expiryDate ? <span className={d.expired ? "text-rose-600 font-semibold" : ""}>{d.expiryDate}</span> : "—",
                d.verified ? <Badge className="bg-emerald-100 text-emerald-700">Verified</Badge>
                           : <Badge className="bg-slate-100 text-slate-600">Pending</Badge>,
                !d.verified ? (
                  <Button size="sm" variant="outline"
                          onClick={() => {
                            contractorApi.verifyDocument(d.id)
                              .then(() => contractorApi.get(Number(id)))
                              .then(setData)
                              .catch(console.error);
                          }}>
                    Verify
                  </Button>
                ) : null,
              ])}
              empty="No documents uploaded."
            />
          </Card>
        </TabsContent>

        <TabsContent value="statutory">
          <Card>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 text-sm">
              <Info label="GSTIN" value={c.gstin} />
              <Info label="PAN" value={c.pan} />
              <Info label="PF number" value={c.pfNumber} />
              <Info label="ESI number" value={c.esiNumber} />
              <Info label="Bank" value={c.bankName} />
              <Info label="Account" value={c.bankAccountNumber} />
              <Info label="IFSC" value={c.bankIfsc} />
              <Info label="UPI" value={c.upiId} />
              <Info label="Agreement" value={c.agreementNumber} />
              <Info label="Agreement period" value={c.agreementStartDate ? `${c.agreementStartDate} → ${c.agreementEndDate ?? "—"}` : undefined} />
              <Info label="Insurance" value={c.insuranceNumber ? `${c.insuranceNumber} (exp ${c.insuranceExpiryDate ?? "—"})` : undefined} />
              <Info label="Licence" value={c.licenseNumber ? `${c.licenseNumber} (exp ${c.licenseExpiryDate ?? "—"})` : undefined} />
              <Info label="Retention" value={c.retentionPercentage != null ? `${c.retentionPercentage}%` : undefined} />
              <Info label="TDS" value={c.tdsPercentage != null ? `${c.tdsPercentage}%` : undefined} />
              <Info label="Credit days" value={c.creditDays?.toString()} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mt-4">{children}</div>;
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr className="text-left">{head.map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="p-8 text-center text-muted-foreground">{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {r.map((cell, j) => <td key={j} className="p-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, star }: { label: string; value?: number; star?: boolean }) {
  return (
    <div className="text-center px-3">
      <div className="text-lg font-black text-slate-900 inline-flex items-center gap-1">
        {star && value != null && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
        {value != null ? Number(value).toFixed(1) : "—"}
      </div>
      <div className="text-[10px] font-semibold uppercase text-slate-400">{label}</div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className="text-lg font-black text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className="text-slate-800 mt-0.5">{value || "—"}</div>
    </div>
  );
}

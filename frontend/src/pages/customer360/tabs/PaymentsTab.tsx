import { useEffect, useState } from "react";
import { Wallet, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";
import { useAuth } from "@/hooks/useAuth";
import type { CustomerFinancialSummary } from "@/types/customer360";

function fmt(v?: number) {
  return v !== undefined && v !== null ? `₹${v.toLocaleString("en-IN")}` : "—";
}

export default function PaymentsTab({ customerId }: { customerId: string }) {
  const { hasAuthority } = useAuth();
  const canView = hasAuthority("CUSTOMER_FINANCIAL_READ");

  const [summary, setSummary] = useState<CustomerFinancialSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (!canView) { setSummaryLoading(false); return; }
    customer360Api.getFinancialSummary(customerId).then(setSummary).finally(() => setSummaryLoading(false));
  }, [customerId, canView]);

  const invoicesTab = usePagedTab<any>((page, size) => customer360Api.getInvoices(customerId, page, size), [customerId, canView]);
  const paymentsTab = usePagedTab<any>((page, size) => customer360Api.getPayments(customerId, page, size), [customerId, canView]);

  if (!canView) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState icon={ShieldAlert} title="Financial information restricted" description="Your role does not have access to invoices and payment data for customers." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Invoiced", value: summary?.totalInvoiced },
          { label: "Total Paid", value: summary?.totalPaid },
          { label: "Advance Paid", value: summary?.advancePaid },
          { label: "Outstanding", value: summary?.outstandingBalance },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              {summaryLoading ? <Skeleton className="h-6 w-20 mt-1" /> : <div className="text-lg font-bold">{fmt(s.value)}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Invoices</CardTitle></CardHeader>
        <CardContent>
          {invoicesTab.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : invoicesTab.items.length === 0 ? (
            <EmptyState icon={Wallet} title="No invoices yet" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Due Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesTab.items.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.date ? new Date(inv.date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{fmt(inv.totalAmount)}</TableCell>
                      <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationFooter page={invoicesTab.page} totalPages={invoicesTab.totalPages} onPageChange={invoicesTab.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Payment History</CardTitle></CardHeader>
        <CardContent>
          {paymentsTab.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : paymentsTab.items.length === 0 ? (
            <EmptyState icon={Wallet} title="No payments recorded yet" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Payment #</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsTab.items.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.paymentNumber}</TableCell>
                      <TableCell>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{fmt(p.amount)}</TableCell>
                      <TableCell>{p.paymentMethod || "—"}</TableCell>
                      <TableCell>{p.referenceNumber || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationFooter page={paymentsTab.page} totalPages={paymentsTab.totalPages} onPageChange={paymentsTab.setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

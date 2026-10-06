import type { Invoice, InvoiceItem } from "@/types/finance";
import type { CompanyProfile } from "@/lib/companyProfile";
import { buildInvoicePdf, loadInvoicePdfAssets } from "@/lib/quotationPdf";

type InvoiceDoc = { invoice: Invoice; items: InvoiceItem[]; project?: any };

/**
 * Opens the invoice as a PDF in a new tab — the same design as the quotation PDF (letterhead, cards,
 * item table, summary, bank details and UPI QR) — and starts the print dialog. The tab is opened
 * straight away, while the click still counts as a user action, so pop-up blockers let it through;
 * the PDF loads into it once it's built.
 */
export async function openInvoicePdf(load: () => Promise<InvoiceDoc>): Promise<void> {
  const w = window.open("", "_blank");
  if (w) {
    w.document.title = "Preparing invoice…";
    w.document.body.style.cssText = "font-family:system-ui,sans-serif;color:#5d6b78;display:grid;place-items:center;height:100vh;margin:0";
    w.document.body.textContent = "Preparing the invoice…";
  }
  try {
    const { invoice, items, project } = await load();
    const assets = await loadInvoicePdfAssets(invoice);
    const doc = buildInvoicePdf(invoice, items, project, assets);
    doc.setProperties({ title: invoice.invoiceNumber || "Invoice" });
    doc.autoPrint();
    const url = URL.createObjectURL(doc.output("blob"));
    if (w && !w.closed) {
      w.location.href = url;
    } else {
      // Pop-ups blocked: download it instead.
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoiceNumber || "invoice"}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    w?.close();
    throw e;
  }
}

/** Prints an invoice whose data is already loaded. `company` is kept for older callers; the PDF reads it itself. */
export function printInvoice(invoice: Invoice, items: InvoiceItem[], project?: any, _company?: CompanyProfile) {
  return openInvoicePdf(async () => ({ invoice, items, project }));
}

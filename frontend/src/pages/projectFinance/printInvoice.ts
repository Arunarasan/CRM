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
    const assets = await loadInvoicePdfAssets(invoice, items);
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

/**
 * Sends the invoice PDF together with its message over WhatsApp.
 * - Phones/tablets that can share files: opens the share sheet with the PDF and the message, so one tap
 *   to WhatsApp sends both.
 * - Desktop (WhatsApp links can't carry attachments): downloads the PDF, copies the message to the
 *   clipboard and opens the customer's chat with the message pre-filled — attach the downloaded PDF.
 * Returns a short note describing what happened, for a toast.
 */
export async function shareInvoiceWhatsApp(
  load: () => Promise<InvoiceDoc>,
  message: string,
  phoneDigits: string,
): Promise<string> {
  const { invoice, items, project } = await load();
  const assets = await loadInvoicePdfAssets(invoice, items);
  const doc = buildInvoicePdf(invoice, items, project, assets);
  const name = `${invoice.invoiceNumber || "invoice"}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], name, { type: "application/pdf" });

  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: message, title: invoice.invoiceNumber });
      return "Shared";
    } catch (e: any) {
      if (e?.name === "AbortError") return "Cancelled";
      // fall through to the desktop path
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  let copied = false;
  try { await navigator.clipboard.writeText(message); copied = true; } catch { /* clipboard blocked */ }
  window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`, "_blank");
  return `PDF downloaded${copied ? ", message copied" : ""} — attach the PDF in WhatsApp`;
}

import type { Invoice, InvoiceItem } from "@/types/finance";

/**
 * Opens a print-ready window with a formatted tax invoice and triggers the browser print dialog.
 * Self-contained (inline styles) so it prints cleanly without the app's chrome.
 */
export function printInvoice(invoice: Invoice, items: InvoiceItem[], project?: any) {
  const inr = (n?: number | null) =>
    "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const d = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

  const customerName = (invoice as any).customer?.name || "—";
  const projectName = project?.projectName || (invoice as any).project?.projectName || "";
  const projectCode = project?.projectCode || "";

  const rows = (items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(it.description)}${it.hsnCode ? `<div class="muted">HSN ${esc(it.hsnCode)}</div>` : ""}</td>
      <td class="num">${esc(it.quantity)}${it.unit ? " " + esc(it.unit) : ""}</td>
      <td class="num">${inr(it.unitPrice)}</td>
      <td class="num">${it.gstRate ?? 0}%</td>
      <td class="num">${inr((it as any).totalPrice ?? Number(it.quantity) * Number(it.unitPrice))}</td>
    </tr>`).join("");

  const gstRow = invoice.gstType === "IGST"
    ? `<tr><td>IGST</td><td class="num">${inr((invoice as any).igstAmount ?? invoice.gstAmount)}</td></tr>`
    : `<tr><td>CGST</td><td class="num">${inr((invoice as any).cgstAmount)}</td></tr>
       <tr><td>SGST</td><td class="num">${inr((invoice as any).sgstAmount)}</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; margin: 32px; font-size: 13px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
    .brand { font-size: 22px; font-weight: 800; color: #2563eb; }
    .title { text-align: right; }
    .title h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .paid { background: #dcfce7; color: #15803d; } .unpaid { background: #fee2e2; color: #b91c1c; }
    .partial { background: #fef3c7; color: #b45309; }
    .meta { display: flex; justify-content: space-between; margin: 20px 0; gap: 24px; }
    .meta h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #475569; }
    .num { text-align: right; }
    .muted { color: #94a3b8; font-size: 11px; }
    .totals { width: 300px; margin-left: auto; margin-top: 16px; }
    .totals td { border: none; padding: 4px 10px; }
    .totals .grand td { border-top: 2px solid #1e293b; font-weight: 800; font-size: 15px; }
    .totals .due td { color: #b91c1c; font-weight: 700; }
    .notes { margin-top: 24px; font-size: 12px; color: #475569; white-space: pre-line; }
    @media print { body { margin: 0; padding: 16px; } .noprint { display: none; } }
  </style></head><body>
    <div class="head">
      <div><div class="brand">ARUDRA</div><div class="muted">Commercial Services</div></div>
      <div class="title">
        <h1>TAX INVOICE</h1>
        <div>${esc(invoice.invoiceNumber)}</div>
        <div class="pill ${invoice.status === "PAID" ? "paid" : invoice.status === "PARTIAL" ? "partial" : "unpaid"}">
          ${invoice.status === "PAID" ? "PAID" : invoice.status === "PARTIAL" ? "PARTIALLY PAID" : "UNPAID"}
        </div>
      </div>
    </div>

    <div class="meta">
      <div>
        <h3>Bill To</h3>
        <div><strong>${esc(customerName)}</strong></div>
        ${projectName ? `<div class="muted">Project: ${esc(projectName)}${projectCode ? ` (${esc(projectCode)})` : ""}</div>` : ""}
      </div>
      <div style="text-align:right">
        <h3>Invoice Details</h3>
        <div>Type: ${esc(invoice.invoiceType)}</div>
        <div>Date: ${d(invoice.date)}</div>
        <div>Due: ${d(invoice.dueDate)}</div>
      </div>
    </div>

    <table>
      <thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">GST</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">No line items</td></tr>`}</tbody>
    </table>

    <table class="totals">
      <tr><td>Sub-total</td><td class="num">${inr(invoice.subTotal)}</td></tr>
      ${Number((invoice as any).discountAmount) ? `<tr><td>Discount</td><td class="num">- ${inr((invoice as any).discountAmount)}</td></tr>` : ""}
      ${gstRow}
      ${Number((invoice as any).roundOff) ? `<tr><td>Round off</td><td class="num">${inr((invoice as any).roundOff)}</td></tr>` : ""}
      <tr class="grand"><td>Total</td><td class="num">${inr(invoice.totalAmount)}</td></tr>
      <tr><td>Paid</td><td class="num">${inr(invoice.amountPaid)}</td></tr>
      <tr class="due"><td>Balance Due</td><td class="num">${inr(invoice.balanceDue)}</td></tr>
    </table>

    ${invoice.notes ? `<div class="notes"><strong>Notes:</strong>\n${esc(invoice.notes)}</div>` : ""}
    ${(invoice as any).terms ? `<div class="notes"><strong>Terms:</strong>\n${esc((invoice as any).terms)}</div>` : ""}

    <script>window.onload = function(){ window.print(); };</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) { alert("Please allow pop-ups to print the invoice."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

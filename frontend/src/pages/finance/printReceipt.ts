import type { Invoice, InvoiceItem } from "@/types/finance";
import type { CompanyProfile } from "@/lib/companyProfile";

/**
 * Opens a print-ready window with a compact 80mm POS-style receipt and triggers the
 * browser print dialog. Suited to a thermal printer (falls back fine to A4 paper).
 * Self-contained (inline styles) so it prints without the app's chrome.
 */
export function printReceipt(invoice: Invoice, items: InvoiceItem[], company?: CompanyProfile) {
  const co = company ?? { name: "ARUDRA", tagline: "Commercial Services" };
  const inr = (n?: number | null) =>
    "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const d = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

  const cust = (invoice as any).customer || {};
  const paid = Number(invoice.amountPaid || 0);
  const due = Number(invoice.balanceDue || 0);

  const rows = (items || []).map((it) => {
    const amt = (it as any).totalPrice ?? Number(it.quantity) * Number(it.unitPrice);
    return `
    <tr>
      <td class="nm" colspan="2">${esc(it.description)}</td>
    </tr>
    <tr class="ln">
      <td class="qd">${esc(it.quantity)}${it.unit ? " " + esc(it.unit) : ""} × ${inr(it.unitPrice)}${it.gstRate ? ` <span class="mut">(${it.gstRate}% GST)</span>` : ""}</td>
      <td class="num">${inr(amt)}</td>
    </tr>`;
  }).join("");

  const gstBlock = invoice.gstType === "IGST"
    ? `<tr><td>IGST</td><td class="num">${inr((invoice as any).igstAmount ?? invoice.gstAmount)}</td></tr>`
    : `<tr><td>CGST</td><td class="num">${inr(invoice.cgstAmount)}</td></tr>
       <tr><td>SGST</td><td class="num">${inr(invoice.sgstAmount)}</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: 80mm auto; margin: 0; }
    body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 8px 10px; width: 80mm; font-size: 12px; }
    .center { text-align: center; }
    .shop { font-size: 18px; font-weight: 800; letter-spacing: 1px; }
    .sub { font-size: 11px; color: #444; }
    .hr { border-top: 1px dashed #999; margin: 8px 0; }
    .meta { font-size: 11px; }
    .meta div { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .nm { font-weight: 600; padding-top: 4px; }
    .ln .qd { color: #333; }
    .num { text-align: right; white-space: nowrap; }
    .mut { color: #777; }
    .tot td { padding: 2px 0; }
    .grand td { border-top: 1px solid #000; font-size: 15px; font-weight: 800; padding-top: 5px; }
    .pay td { font-weight: 600; }
    .foot { margin-top: 10px; text-align: center; font-size: 11px; color: #444; }
    @media print { body { padding: 4px 6px; } }
  </style></head><body>
    <div class="center">
      <div class="shop">${esc(co.name)}</div>
      ${co.tagline ? `<div class="sub">${esc(co.tagline)}</div>` : ""}
      ${co.address ? `<div class="sub">${esc(co.address)}</div>` : ""}
      ${co.phone ? `<div class="sub">Ph: ${esc(co.phone)}</div>` : ""}
      ${co.gstin ? `<div class="sub">GSTIN: ${esc(co.gstin)}</div>` : ""}
      <div class="sub" style="margin-top:4px;font-weight:700;color:#111;">TAX INVOICE</div>
    </div>
    <div class="hr"></div>
    <div class="meta">
      <div><span>Bill No</span><span>${esc(invoice.invoiceNumber)}</span></div>
      <div><span>Date</span><span>${d(invoice.date)}</span></div>
      ${cust.name ? `<div><span>Customer</span><span>${esc(cust.name)}</span></div>` : ""}
      ${cust.phone ? `<div><span>Phone</span><span>${esc(cust.phone)}</span></div>` : ""}
    </div>
    <div class="hr"></div>
    <table>${rows || `<tr><td class="mut">No items</td></tr>`}</table>
    <div class="hr"></div>
    <table class="tot">
      <tr><td>Sub-total</td><td class="num">${inr(invoice.subTotal)}</td></tr>
      ${Number(invoice.discountAmount) ? `<tr><td>Discount</td><td class="num">- ${inr(invoice.discountAmount)}</td></tr>` : ""}
      ${gstBlock}
      ${Number(invoice.roundOff) ? `<tr><td>Round off</td><td class="num">${inr(invoice.roundOff)}</td></tr>` : ""}
      <tr class="grand"><td>TOTAL</td><td class="num">${inr(invoice.totalAmount)}</td></tr>
      ${paid ? `<tr class="pay"><td>Paid</td><td class="num">${inr(paid)}</td></tr>` : ""}
      ${due > 0 ? `<tr class="pay"><td>Balance Due</td><td class="num">${inr(due)}</td></tr>` : ""}
    </table>
    <div class="foot">Thank you for your business!</div>
    <script>window.onload = function(){ window.print(); setTimeout(function(){ try { window.close(); } catch(e){} }, 300); };</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) { alert("Please allow pop-ups to print the receipt."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import type { Bundle } from "@/api/bundleApi";
import type { CompanyProfile } from "@/lib/companyProfile";
import { formatSpec, parseSpec } from "./workSpec";

export type LabelSize = "50x25" | "100x150" | "a4";

export const LABEL_SIZES: { v: LabelSize; label: string; hint: string }[] = [
  { v: "50x25", label: "50 × 25 mm", hint: "small thermal label · QR + code" },
  { v: "100x150", label: "4 × 6 in", hint: "large thermal label · QR, barcode, items" },
  { v: "a4", label: "A4 sheet", hint: "8 labels per page · any printer" },
];

const SIZE_KEY = "bundle.labelSize";

export function getLabelSize(): LabelSize {
  try {
    const v = localStorage.getItem(SIZE_KEY);
    if (v === "50x25" || v === "100x150" || v === "a4") return v;
  } catch { /* storage blocked — use the default */ }
  return "50x25";
}

export function setLabelSize(v: LabelSize) {
  try { localStorage.setItem(SIZE_KEY, v); } catch { /* ignore */ }
}

/** What the sticker QR encodes: a deep link that opens the bundle in the CRM from any phone camera. */
export function bundleScanUrl(code: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}bundles/code/${encodeURIComponent(code)}`;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const d = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "");

function qrSvg(value: string) {
  return renderToStaticMarkup(createElement(QRCodeSVG, { value, level: "M", marginSize: 0, style: { width: "100%", height: "100%" } }));
}

function barcodeSvg(value: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, { format: "CODE128", height: 40, width: 1.6, displayValue: false, margin: 0 });
  } catch {
    return "";
  }
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.width = "100%";
  svg.style.height = "100%";
  return svg.outerHTML;
}

/** Money status for the pickup counter: "BAL ₹1,200" while owed, "PAID" once settled, "" without a bill. */
function payTag(b: Bundle) {
  if (!b.invoiceId || b.balanceDue == null) return "";
  const due = Number(b.balanceDue);
  return due > 0 ? `BAL ₹${due.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "PAID";
}

function itemLines(b: Bundle, max: number) {
  const items = b.items ?? [];
  const rows = items.slice(0, max).map((it) => {
    const spec = formatSpec(parseSpec(it.workSpec));
    return `<li><b>${esc(it.description)}</b> × ${esc(Number(it.quantity))}${it.unit ? " " + esc(it.unit) : ""}${spec ? `<br><span>${esc(spec)}</span>` : ""}</li>`;
  });
  if (items.length > max) rows.push(`<li><span>+ ${items.length - max} more…</span></li>`);
  return rows.join("");
}

function smallLabel(b: Bundle) {
  return `<div class="lbl s">
    <div class="qr">${qrSvg(bundleScanUrl(b.code))}</div>
    <div class="txt">
      <div class="code">${esc(b.code)}</div>
      <div class="ln">${b.handoverMode === "INSTALL" ? `<b>INSTALL</b> ` : ""}${payTag(b) && Number(b.balanceDue) > 0 ? `<b class="bal">BAL</b> ` : ""}${esc(b.customerName || "Walk-in")}</div>
      <div class="ln mut">${b.bundleTotal > 1 ? `${b.bundleNo}/${b.bundleTotal} · ` : ""}${b.itemCount} item${b.itemCount === 1 ? "" : "s"}${b.dueDate ? ` · ${d(b.dueDate)}` : ""}</div>
    </div>
  </div>`;
}

function largeLabel(b: Bundle, co: CompanyProfile | undefined, cls: string, maxItems: number) {
  return `<div class="lbl ${cls}">
    <div class="top"><span class="shop">${esc(co?.name || "")}</span><span class="wt">${esc(b.workType)}</span></div>
    ${payTag(b) ? `<div class="pay ${Number(b.balanceDue) > 0 ? "due" : "ok"}">${esc(payTag(b))}</div>` : ""}
    <div class="mid">
      <div class="qr">${qrSvg(bundleScanUrl(b.code))}</div>
      <div class="txt">
        <div class="code">${esc(b.code)}</div>
        ${b.bundleTotal > 1 ? `<div class="bn">Order ${b.bundleNo} of ${b.bundleTotal}</div>` : ""}
        <div class="cust">${esc(b.customerName || "Walk-in")}</div>
        ${b.customerPhone ? `<div class="mut">${esc(b.customerPhone)}</div>` : ""}
        <div class="mut">${b.invoiceNumber ? `Bill ${esc(b.invoiceNumber)}` : ""}${b.dueDate ? ` · Due ${d(b.dueDate)}` : ""}</div>
        <div class="mut">${b.handoverMode === "INSTALL" ? "<b>INSTALL</b>" : b.handoverMode === "DELIVERY" ? "Delivery" : "Pickup"}</div>
      </div>
    </div>
    <div class="bc">${barcodeSvg(b.code)}</div>
    <ul class="items">${itemLines(b, maxItems)}</ul>
  </div>`;
}

/**
 * Opens a print-ready window with one sticker per bundle and triggers the print dialog.
 * Returns false when the pop-up was blocked (caller decides whether to tell the user).
 */
export function printBundleStickers(bundles: Bundle[], size: LabelSize, company?: CompanyProfile): boolean {
  if (!bundles.length) return true;
  let page = "";
  let body = "";
  if (size === "50x25") {
    page = "@page { size: 50mm 25mm; margin: 0; }";
    body = bundles.map(smallLabel).join("");
  } else if (size === "100x150") {
    page = "@page { size: 100mm 150mm; margin: 0; }";
    body = bundles.map((b) => largeLabel(b, company, "l", 8)).join("");
  } else {
    page = "@page { size: A4; margin: 8mm; }";
    body = `<div class="sheet">${bundles.map((b) => largeLabel(b, company, "a", 3)).join("")}</div>`;
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Order stickers</title>
  <style>
    ${page}
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #000; }
    .mut { color: #333; }
    .lbl { overflow: hidden; page-break-after: always; break-after: page; }
    .lbl:last-child { page-break-after: auto; break-after: auto; }
    .qr svg { display: block; }
    .bal { border: 1px solid #000; padding: 0 .6mm; font-weight: 800; }
    .pay { font-weight: 900; text-align: center; border: 1.5px solid #000; border-radius: 1.5mm; }
    .pay.due { background: #000; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .l .pay { font-size: 15pt; padding: 1mm; }
    .a .pay { font-size: 11pt; padding: .5mm; }
    /* 50 x 25 mm */
    .s { width: 50mm; height: 25mm; padding: 1.5mm; display: flex; gap: 1.5mm; align-items: center; }
    .s .qr { width: 21mm; height: 21mm; flex: none; }
    .s .txt { min-width: 0; flex: 1; line-height: 1.15; }
    .s .code { font-size: 11.5pt; font-weight: 800; letter-spacing: .2px; white-space: nowrap; }
    .s .ln { font-size: 7pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: .6mm; }
    /* 4 x 6 in */
    .l { width: 100mm; height: 150mm; padding: 5mm; display: flex; flex-direction: column; gap: 3mm; }
    .l .top, .a .top { display: flex; justify-content: space-between; font-size: 9pt; font-weight: 700; border-bottom: 1px solid #000; padding-bottom: 1.5mm; }
    .l .mid, .a .mid { display: flex; gap: 4mm; }
    .l .qr { width: 38mm; height: 38mm; flex: none; }
    .l .code { font-size: 22pt; font-weight: 900; line-height: 1; }
    .l .bn { font-size: 11pt; font-weight: 700; margin-top: 1mm; }
    .l .cust { font-size: 12pt; font-weight: 700; margin-top: 2mm; }
    .l .txt div, .a .txt div { margin-top: .8mm; }
    .l .bc { height: 14mm; }
    .l .items, .a .items { margin: 0; padding-left: 4mm; font-size: 9pt; line-height: 1.3; }
    .l .items span, .a .items span { font-size: 8pt; color: #333; }
    /* A4 sheet: 2 x 4 grid */
    .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
    .a { height: 66mm; border: 1px dashed #999; border-radius: 2mm; padding: 3mm; display: flex; flex-direction: column; gap: 1.5mm; page-break-after: auto; break-inside: avoid; }
    .a .qr { width: 26mm; height: 26mm; flex: none; }
    .a .code { font-size: 16pt; font-weight: 900; line-height: 1; }
    .a .bn { font-size: 9pt; font-weight: 700; }
    .a .cust { font-size: 10pt; font-weight: 700; }
    .a .txt { font-size: 8pt; }
    .a .bc { height: 9mm; }
  </style></head><body>${body}
  <script>window.onload = function(){ window.print(); setTimeout(function(){ try { window.close(); } catch(e){} }, 300); };</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

/** A4 job card for the tailor: specs, quantities and notes — no prices. */
export function printJobCard(b: Bundle, company?: CompanyProfile): boolean {
  const rows = (b.items ?? []).map((it, i) => {
    const spec = parseSpec(it.workSpec);
    const cells = [
      spec.type, spec.width && `W ${spec.width} in`, spec.height && `H ${spec.height} in`,
      spec.panels && `${spec.panels} ${!spec.type || ["Curtain", "Roman Blind", "Blind"].includes(spec.type) ? "panels" : "pcs"}`,
      spec.pleat && spec.pleat !== "None" && spec.pleat, spec.lining && spec.lining !== "None" && `${spec.lining} lining`,
    ].filter(Boolean).join(" · ");
    return `<tr>
      <td class="n">${i + 1}</td>
      <td><b>${esc(it.description)}</b>${cells ? `<div class="spec">${esc(cells)}</div>` : ""}
        ${spec.notes ? `<div class="note">${esc(spec.notes)}</div>` : ""}${it.notes ? `<div class="note">${esc(it.notes)}</div>` : ""}</td>
      <td class="q">${esc(Number(it.quantity))} ${esc(it.unit ?? "")}</td>
      <td class="chk"></td>
    </tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Job card ${esc(b.code)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #000; font-size: 11pt; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 4mm; }
    .shop { font-size: 13pt; font-weight: 800; }
    .title { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; margin-top: 1mm; }
    .code { font-size: 26pt; font-weight: 900; line-height: 1; }
    .qr { width: 26mm; height: 26mm; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm 6mm; margin: 5mm 0; font-size: 10pt; }
    .meta span { display: block; font-size: 8pt; color: #555; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 8.5pt; text-transform: uppercase; color: #555; border-bottom: 1px solid #000; padding: 2mm 1mm; }
    td { border-bottom: 1px solid #ccc; padding: 3mm 1mm; vertical-align: top; }
    .n { width: 8mm; } .q { width: 25mm; white-space: nowrap; } .chk { width: 18mm; border-left: 1px dashed #bbb; }
    .spec { margin-top: 1mm; } .note { margin-top: 1mm; font-style: italic; color: #333; }
    .notes { margin-top: 5mm; border: 1px solid #000; padding: 3mm; min-height: 20mm; }
    .sign { display: flex; justify-content: space-between; margin-top: 14mm; font-size: 9pt; }
    .sign div { border-top: 1px solid #000; width: 55mm; padding-top: 1mm; text-align: center; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="shop">${esc(company?.name || "")}</div>
        <div class="title">${esc(b.workType)} job card</div>
        <div class="code" style="margin-top:3mm">${esc(b.code)}</div>
        ${b.bundleTotal > 1 ? `<div>Bundle ${b.bundleNo} of ${b.bundleTotal}</div>` : ""}
      </div>
      <div class="qr">${qrSvg(bundleScanUrl(b.code))}</div>
    </div>
    <div class="meta">
      <div><span>Customer</span>${esc(b.customerName || "Walk-in")}</div>
      <div><span>Bill</span>${esc(b.invoiceNumber || "—")}</div>
      <div><span>Ready by</span>${b.dueDate ? new Date(b.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
      <div><span>Tailor</span>${esc(b.assigneeName || "—")}</div>
      <div><span>Priority</span>${esc(b.priority)}</div>
      <div><span>Handover</span>${b.handoverMode === "INSTALL" ? "Install" : b.handoverMode === "DELIVERY" ? "Delivery" : "Pickup"}</div>
    </div>
    <table><thead><tr><th>#</th><th>Item &amp; work</th><th>Qty</th><th>Done</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="notes"><b>Notes:</b> ${esc(b.notes || "")}</div>
    <div class="sign"><div>Tailor</div><div>QC checked by</div></div>
    <script>window.onload = function(){ window.print(); setTimeout(function(){ try { window.close(); } catch(e){} }, 300); };</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

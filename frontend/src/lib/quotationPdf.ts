import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildCategoryBlocks, lineDiscountAmount, quoteCharges, type Quotation, type QuotationItem,
} from "@/types/quotation";
import api from "@/lib/api";
import { resolveFileUrl } from "@/lib/uploadFile";

// jsPDF's built-in fonts don't carry the ₹ glyph, so use "Rs." in the PDF to avoid tofu boxes.
const money = (v?: number) =>
  v === undefined || v === null ? "-" : `Rs. ${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const n = (v?: number | null) => Number(v ?? 0) || 0;

export interface PdfSelection {
  /** Item ids to include; undefined = every item. */
  itemIds?: Set<number>;
  /** Include quotation-level labour / additional charges that aren't tied to an item. */
  includeExtras?: boolean;
  /** Line photos as data URLs (from loadPdfImages); photos missing here are left out. */
  images?: Record<string, string>;
}

export interface SelectionTotals {
  items: QuotationItem[];
  isPartial: boolean;
  materialTotal: number;
  labourTotal: number;
  additionalCharges: number;
  /** Quotation-level labour + charges not attached to any item (whole-quote extras). */
  extras: number;
  discount: number;
  gst: number;
  grandTotal: number;
}

/**
 * Totals for a subset of a quotation's items. Selecting everything (with extras) returns the
 * quotation's own figures exactly. For a subset, quotation-level discount and GST are applied at the
 * same effective rate as on the full quotation (they're whole-quote figures, so they scale with it).
 */
export function selectionTotals(quotation: Quotation, sel: PdfSelection = {}): SelectionTotals {
  const all = quotation.items || [];
  // Lines the customer dropped (REJECTED) are outside the quotation totals on the server too.
  const priced = all.filter((i) => i.status !== "REJECTED");
  const items = sel.itemIds ? all.filter((i) => i.id != null && sel.itemIds!.has(i.id)) : priced;
  const includeExtras = sel.includeExtras ?? true;

  const allItemsTotal = priced.reduce((s, i) => s + n(i.totalAmount), 0);
  const fullGrand = n(quotation.grandTotal);
  const fullGst = n(quotation.gst);
  const fullDiscount = n(quotation.discount);
  const fullSubtotal = fullGrand - fullGst + fullDiscount; // items + quote-level labour/charges
  const extras = Math.max(0, fullSubtotal - allItemsTotal);

  const isPartial = items.length !== priced.length || items.some((i) => i.status === "REJECTED")
    || (!includeExtras && extras > 0);
  if (!isPartial) {
    return {
      items, isPartial, extras,
      materialTotal: n(quotation.materialTotal), labourTotal: n(quotation.labourTotal),
      additionalCharges: n(quotation.additionalChargesTotal),
      discount: fullDiscount, gst: fullGst, grandTotal: fullGrand,
    };
  }

  const discountRate = fullSubtotal > 0 ? fullDiscount / fullSubtotal : 0;
  const afterFull = fullSubtotal - fullDiscount;
  const gstRate = afterFull > 0 ? fullGst / afterFull : 0;

  const subtotal = items.reduce((s, i) => s + n(i.totalAmount), 0) + (includeExtras ? extras : 0);
  const discount = subtotal * discountRate;
  const gst = (subtotal - discount) * gstRate;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    items, isPartial, extras,
    materialTotal: r2(items.reduce((s, i) => s + n(i.materialCost), 0)),
    labourTotal: r2(items.reduce((s, i) => s + n(i.labourCost), 0)),
    additionalCharges: r2(items.reduce((s, i) => s + n(i.additionalCharges), 0) + (includeExtras ? extras : 0)),
    discount: r2(discount), gst: r2(gst), grandTotal: r2(subtotal - discount + gst),
  };
}

/** Downloads the PDF (optionally only the selected items). */
export function downloadQuotationPdf(quotation: Quotation, sel: PdfSelection = {}) {
  buildQuotationPdf(quotation, sel).save(`${quotation.quotationNumber || "quotation"}.pdf`);
}

/** Blob URL of the PDF for an in-page preview. The caller revokes it (URL.revokeObjectURL). */
export function quotationPdfUrl(quotation: Quotation, sel: PdfSelection = {}): string {
  const blob = buildQuotationPdf(quotation, sel).output("blob");
  return URL.createObjectURL(blob);
}

/**
 * Loads the line photos as data URLs for the PDF (jsPDF can't fetch). Photos that can't be read
 * (blocked by the image host, missing) are simply left out. Shrunk to thumbnails to keep the PDF small.
 */
export async function loadPdfImages(quotation: Quotation): Promise<Record<string, string>> {
  const urls = [...new Set((quotation.items || []).map((i) => i.imageUrl).filter((u): u is string => !!u))];
  const out: Record<string, string> = {};
  await Promise.all(urls.map(async (url) => {
    try {
      // Our own stored photos come through the API (the storage bucket sends no CORS headers, so
      // a canvas can't read them directly); other links are tried as-is.
      let src = resolveFileUrl(url);
      let revoke: string | null = null;
      try {
        const res = await api.get(`/uploads/image`, { params: { url: src }, responseType: "blob" });
        src = revoke = URL.createObjectURL(res.data);
      } catch { /* not one of ours — try the link directly */ }
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = src;
      }).finally(() => { if (revoke) setTimeout(() => URL.revokeObjectURL(revoke!), 0); });
      const size = 160;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Centre-crop to a square, like the thumbnails on screen.
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      out[url] = canvas.toDataURL("image/jpeg", 0.8);
    } catch { /* leave this photo out */ }
  }));
  return out;
}

/**
 * Builds the quotation PDF, grouped Category → Product: a bar per category, then a table of its
 * products (photo, name with colour / location / description, qty, rate, discount, amount) and the
 * category total; then the summary — products total, discount, labour / shipping, GST, grand total —
 * and the terms.
 */
export function buildQuotationPdf(quotation: Quotation, sel: PdfSelection = {}): jsPDF {
  const totals = selectionTotals(quotation, sel);
  const blocks = buildCategoryBlocks(totals.items);
  const images = sel.images || {};
  const hasPhotos = totals.items.some((i) => i.imageUrl && images[i.imageUrl]);
  const hasDiscounts = totals.items.some((i) => lineDiscountAmount(i) > 0);
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const bottom = pageH - 16;
  const rx = pageW - marginX;
  let y = 18;

  const ensure = (needed: number) => {
    if (y + needed > bottom) { doc.addPage(); y = 18; }
  };

  // --- Header ---
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(15, 23, 42);
  doc.text("QUOTATION", marginX, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 116, 139);
  doc.text(
    `${quotation.quotationNumber || ""}${quotation.revisionNumber ? ` · v${quotation.revisionNumber}` : ""}`,
    marginX, y + 5,
  );
  const client = quotation.customer?.name || quotation.lead?.name;
  let ry = y;
  if (client) { doc.setFont("helvetica", "bold").setTextColor(15, 23, 42).text(client, rx, ry, { align: "right" }); ry += 4.5; }
  doc.setFont("helvetica", "normal").setTextColor(100, 116, 139);
  if (quotation.quotationDate) { doc.text(`Date: ${quotation.quotationDate}`, rx, ry, { align: "right" }); ry += 4.5; }
  if (quotation.expiryDate) { doc.text(`Valid until: ${quotation.expiryDate}`, rx, ry, { align: "right" }); }
  doc.setTextColor(0, 0, 0);
  y += 10;
  doc.setDrawColor(30, 41, 59).setLineWidth(0.5);
  doc.line(marginX, y, rx, y);
  y += 6;
  if (totals.isPartial) {
    doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(100, 116, 139);
    const scopeCount = (quotation.items || []).filter((i) => i.status !== "REJECTED").length;
    doc.text(`Selected scope: ${totals.items.length} of ${scopeCount} items`, marginX, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  // --- Categories ---
  const PHOTO = 14; // mm
  for (const block of blocks) {
    ensure(24);
    doc.setFillColor(30, 41, 59);
    doc.rect(marginX, y, pageW - 2 * marginX, 7, "F");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
    doc.text(block.category.toUpperCase(), marginX + 2, y + 4.8);
    doc.text(money(block.total), rx - 2, y + 4.8, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 8;

    const head = ["#", ...(hasPhotos ? [""] : []), "Product", "Qty", "Rate", ...(hasDiscounts ? ["Discount"] : []), "Amount"];
    const photoCol = hasPhotos ? 1 : -1;
    const body = block.items.map((it, idx) => {
      const where = it.location || it.roomName;
      const sub = [it.color ? `Colour: ${it.color}` : "", where || ""].filter(Boolean).join(" · ");
      const product = [it.itemName || "", sub, it.description || ""].filter(Boolean).join("\n");
      const disc = lineDiscountAmount(it);
      return [
        String(idx + 1),
        ...(hasPhotos ? [""] : []),
        product,
        `${it.quantity ?? ""} ${it.unit ?? ""}`.trim(),
        money(it.rate),
        ...(hasDiscounts ? [disc > 0 ? `- ${money(disc)}` : ""] : []),
        money(it.totalAmount),
      ];
    });
    const colCount = head.length;
    const right = (i: number) => ({ halign: "right" as const, cellWidth: i });
    const columnStyles: Record<number, object> = { 0: { cellWidth: 7, textColor: [148, 163, 184] } };
    if (hasPhotos) columnStyles[photoCol] = { cellWidth: PHOTO + 2, minCellHeight: PHOTO + 2 };
    columnStyles[colCount - 1] = right(26);
    columnStyles[colCount - 2] = right(hasDiscounts ? 22 : 24);
    if (hasDiscounts) columnStyles[colCount - 3] = right(24);
    columnStyles[hasDiscounts ? colCount - 4 : colCount - 3] = right(18);

    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      foot: [[
        { content: `${block.category} total`, colSpan: colCount - 1, styles: { halign: "left", fontStyle: "bold" } },
        { content: money(block.total), styles: { halign: "right", fontStyle: "bold" } },
      ]],
      styles: { fontSize: 8, cellPadding: 1.4, lineColor: [226, 232, 240], lineWidth: 0.1, valign: "top" },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold" },
      footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] },
      columnStyles,
      margin: { left: marginX, right: marginX },
      theme: "grid",
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== photoCol) return;
        const it = block.items[data.row.index];
        const src = it?.imageUrl ? images[it.imageUrl] : undefined;
        if (src) doc.addImage(src, "JPEG", data.cell.x + 1, data.cell.y + 1, PHOTO, PHOTO);
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // --- Summary (right aligned) ---
  const charges = quoteCharges(quotation);
  ensure(30 + (blocks.length > 1 ? blocks.length * 5 : 0) + charges.length * 5);
  const gLabelX = pageW - marginX - 75;
  const line = (label: string, val: string, opts: { bold?: boolean; muted?: boolean } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(opts.bold ? 11 : opts.muted ? 8.5 : 9);
    doc.setTextColor(opts.muted ? 100 : 15, opts.muted ? 116 : 23, opts.muted ? 139 : 42);
    doc.text(label, gLabelX, y);
    doc.text(val, rx, y, { align: "right" });
    y += opts.bold ? 7 : 5;
  };
  if (blocks.length > 1) blocks.forEach((b) => line(b.category, money(b.total), { muted: true }));
  const itemsTotal = totals.items.reduce((s, i) => s + n(i.totalAmount), 0);
  line("Products total", money(itemsTotal));
  if (totals.discount > 0) line("Discount", `- ${money(totals.discount)}`);
  if (sel.includeExtras ?? true) {
    charges.forEach((c) => line(c.note ? `${c.label} (${c.note})` : c.label, `+ ${money(c.amount)}`));
  }
  if (totals.gst > 0) line("GST", `+ ${money(totals.gst)}`);
  doc.setDrawColor(30, 41, 59).setLineWidth(0.4);
  doc.line(gLabelX, y - 1, rx, y - 1);
  y += 3;
  line("Grand Total", money(totals.grandTotal), { bold: true });
  doc.setTextColor(0, 0, 0);

  // --- Terms ---
  if (quotation.termsAndConditions) {
    ensure(20);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(51, 65, 85);
    doc.text("Terms & Conditions", marginX, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFont("helvetica", "normal").setFontSize(8);
    const lines = doc.splitTextToSize(quotation.termsAndConditions, pageW - 2 * marginX);
    for (const l of lines) {
      ensure(5);
      doc.text(l, marginX, y);
      y += 4;
    }
  }

  return doc;
}

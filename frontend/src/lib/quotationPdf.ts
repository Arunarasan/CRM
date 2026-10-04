import { createElement } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildCategoryBlocks, lineDiscountAmount, quoteCharges, type Quotation, type QuotationItem,
} from "@/types/quotation";
import api from "@/lib/api";
import { resolveFileUrl } from "@/lib/uploadFile";
import { fetchBankDetails, fetchCompanyProfile, type BankDetails } from "@/lib/companyProfile";

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
  const header = loadHeader().then((h) => { if (h) out[HEADER_KEY] = h; });
  const fonts = Promise.all(FONT_FILES.map(async (f) => {
    const b64 = await loadFont(f.file);
    if (b64) out[FONT_KEY + f.file] = b64;
  }));
  const bank = loadBank(quotation).then((b) => Object.assign(out, b));
  await Promise.all([header, fonts, bank, ...urls.map(async (url) => {
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
  })]);
  return out;
}

/** The letterhead banner (frontend/public/quote-header.jpg), carried in the images map under this key. */
const HEADER_KEY = "__quote_header__";
const HEADER_URL = `${import.meta.env.BASE_URL}quote-header.jpg`;
/** Banner width : height (1536 × 434). */
const HEADER_RATIO = 434 / 1536;

async function loadHeader(): Promise<string | null> {
  try {
    const res = await fetch(HEADER_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Fonts embedded in the PDF (frontend/public/fonts, subset to Latin + ₹): jsPDF's built-in fonts
 * have no ₹ glyph. If they can't be loaded the PDF falls back to Helvetica and "Rs.".
 */
const FONT_KEY = "__font__";
const FONT_FILES = [
  { file: "pdf-sans.ttf", name: "JBSans", style: "normal" },
  { file: "pdf-sans-semibold.ttf", name: "JBSansSemi", style: "normal" },
  { file: "pdf-sans-bold.ttf", name: "JBSans", style: "bold" },
  { file: "pdf-serif-bold.ttf", name: "JBSerif", style: "bold" },
] as const;

async function loadFont(file: string): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null;
  }
}

/** Bank details (JSON) and the UPI "scan to pay" QR (PNG) for the payment box. */
const BANK_KEY = "__bank__";
const QR_KEY = "__upi_qr__";

async function loadBank(quotation: Quotation): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const [bank, company] = await Promise.all([fetchBankDetails(), fetchCompanyProfile()]);
    if (!bank.accountNumber && !bank.upiId) return out;
    out[BANK_KEY] = JSON.stringify(bank);
    if (bank.upiId) {
      const due = n(quotation.grandTotal);
      const link = `upi://pay?pa=${encodeURIComponent(bank.upiId)}&pn=${encodeURIComponent(bank.accountName || company.name)}`
        + (due > 0 ? `&am=${due.toFixed(2)}` : "") + `&cu=INR&tn=${encodeURIComponent(quotation.quotationNumber || "Quotation")}`;
      const qr = await qrPng(link);
      if (qr) out[QR_KEY] = qr;
    }
  } catch { /* no payment box */ }
  return out;
}

/** The QR as a PNG data URL (rendered with qrcode.react, which the print view already uses). */
async function qrPng(value: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [server, qr]: [any, any] = await Promise.all([import("react-dom/server"), import("qrcode.react")]);
    const render = server.renderToStaticMarkup ?? server.default?.renderToStaticMarkup;
    const QRCodeSVG = qr.QRCodeSVG ?? qr.default?.QRCodeSVG;
    let svg: string = render(createElement(QRCodeSVG, { value, size: 240, level: "M", marginSize: 1 }));
    // As a standalone image the SVG needs its namespace (React's markup leaves it out).
    if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const c = document.createElement("canvas");
      c.width = 240; c.height = 240;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 240, 240);
      ctx.drawImage(img, 0, 0, 240, 240);
      return c.toDataURL("image/png");
    } finally { URL.revokeObjectURL(url); }
  } catch {
    return null;
  }
}

/**
 * Builds the quotation PDF in the same design as the printed quotation: the letterhead banner, then
 * QUOTATION + number with Date / Customer / Site cards; per category a tinted header, its own column
 * titles, the products (photo, name + CUSTOM / INVENTORY tag, description, qty, unit, rate, discount,
 * amount) and a tinted Category Total; then terms and bank details (with the UPI QR) beside the
 * summary, which ends in the Final Price bar.
 */
export function buildQuotationPdf(quotation: Quotation, sel: PdfSelection = {}): jsPDF {
  const totals = selectionTotals(quotation, sel);
  const blocks = buildCategoryBlocks(totals.items);
  const assets = sel.images || {};
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 10;
  const W = pageW - 2 * M;
  const rx = pageW - M;
  const bottom = pageH - 14;
  let y = 14;

  // ---- Fonts: embedded (with ₹) when loaded, else Helvetica with "Rs." ----
  let embedded = FONT_FILES.every((f) => assets[FONT_KEY + f.file]);
  if (embedded) {
    try {
      FONT_FILES.forEach((f) => {
        doc.addFileToVFS(f.file, assets[FONT_KEY + f.file]);
        doc.addFont(f.file, f.name, f.style);
      });
    } catch { embedded = false; }
  }
  type Face = "sans" | "semi" | "bold" | "serif";
  const font = (face: Face, size: number) => {
    if (!embedded) {
      doc.setFont(face === "serif" ? "times" : "helvetica", face === "sans" ? "normal" : "bold");
    } else if (face === "sans") doc.setFont("JBSans", "normal");
    else if (face === "semi") doc.setFont("JBSansSemi", "normal");
    else if (face === "bold") doc.setFont("JBSans", "bold");
    else doc.setFont("JBSerif", "bold");
    doc.setFontSize(size);
  };
  const R = embedded ? "₹" : "Rs. ";
  const fmt = (v?: number | null) => Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const money = (v?: number | null) => `${R}${fmt(v)}`;

  type RGB = [number, number, number];
  const INK: RGB = [11, 31, 58];
  const MUTED: RGB = [93, 107, 120];
  const LINE: RGB = [227, 232, 238];
  const TONES: { bg: RGB; bar: RGB }[] = [
    { bg: [233, 246, 239], bar: [63, 155, 110] },
    { bg: [252, 235, 238], bar: [208, 96, 122] },
    { bg: [251, 243, 226], bar: [201, 154, 62] },
    { bg: [234, 241, 251], bar: [91, 139, 208] },
  ];
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  /** Rectangle with only some corners rounded (jsPDF's roundedRect rounds all four). */
  const shape = (x: number, top: number, w: number, h: number, r: number,
    corners: { tl?: boolean; tr?: boolean; br?: boolean; bl?: boolean }, style: "F" | "S" | "FD") => {
    const k = 0.5523 * r;
    const tl = corners.tl ? r : 0, tr = corners.tr ? r : 0, br = corners.br ? r : 0, bl = corners.bl ? r : 0;
    const segs: number[][] = [[w - tl - tr, 0]];
    if (tr) segs.push([tr * 0.5523, 0, tr, tr - tr * 0.5523, tr, tr]);
    segs.push([0, h - tr - br]);
    if (br) segs.push([0, k, -(r - k), r, -r, r]);
    segs.push([-(w - br - bl), 0]);
    if (bl) segs.push([-k, 0, -r, -(r - k), -r, -r]);
    segs.push([0, -(h - bl - tl)]);
    if (tl) segs.push([0, -k, r - k, -r, r, -r]);
    doc.lines(segs, x + tl, top, [1, 1], style, true);
  };

  const newPage = () => { doc.addPage(); y = 14; };
  const ensure = (needed: number) => { if (y + needed > bottom) newPage(); };

  // ---- Letterhead ----
  const header = assets[HEADER_KEY];
  if (header) {
    const h = pageW * HEADER_RATIO;
    try { doc.addImage(header, "JPEG", 0, 0, pageW, h); y = h + 5; } catch { /* plain header */ }
  }

  // ---- QUOTATION + number · Date / Customer / Site cards ----
  const lead: any = quotation.lead || {};
  const cust: any = quotation.customer || {};
  const meas: any = quotation.measurement || {};
  const client = cust.name || lead.name || "—";
  const area = lead.area || cust.area || lead.city || cust.city || cust.customerCode || "";
  const site = quotation.project?.projectName || meas.siteAddress || lead.siteAddress || cust.siteAddress
    || lead.address || cust.address || lead.city || cust.city || "—";
  const qDate = quotation.quotationDate;
  const xDate = quotation.expiryDate || addDays(qDate, 14);
  const validDays = qDate && xDate ? Math.round((new Date(xDate).getTime() - new Date(qDate).getTime()) / 86400000) : null;

  font("serif", 23); color(INK);
  doc.text("QUOTATION", M + 1, y + 9);
  font("semi", 11);
  doc.text(`${quotation.quotationNumber || ""}${quotation.revisionNumber ? ` · v${quotation.revisionNumber}` : ""}`, M + 1, y + 15.5);

  const cardX = M + 64, gap = 2.5, cardH = 17;
  const cardW = (rx - cardX - 2 * gap) / 3;
  const cards: { label: string; value: string; sub?: string; wrap?: boolean }[] = [
    { label: "Date", value: fmtDay(qDate), sub: validDays != null && validDays >= 0 ? `Valid for ${validDays} day${validDays === 1 ? "" : "s"}` : xDate ? `Valid till ${fmtDay(xDate)}` : undefined },
    { label: "Customer", value: client, sub: area || undefined },
    { label: "Site / Project", value: site, wrap: true },
  ];
  cards.forEach((c, i) => {
    const x = cardX + i * (cardW + gap);
    doc.setDrawColor(...LINE).setLineWidth(0.25).setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 1.8, 1.8, "FD");
    font("sans", 7.5); color(MUTED);
    doc.text(c.label, x + 4, y + 5);
    if (c.wrap) {
      font("sans", 8.8); color(INK);
      doc.text((doc.splitTextToSize(c.value, cardW - 7) as string[]).slice(0, 2), x + 4, y + 10);
    } else {
      font("semi", 10); color(INK);
      doc.text((doc.splitTextToSize(c.value, cardW - 7) as string[])[0] || "", x + 4, y + 10.3);
      if (c.sub) { font("sans", 7.5); color(MUTED); doc.text((doc.splitTextToSize(c.sub, cardW - 7) as string[])[0], x + 4, y + 14.4); }
    }
  });
  y += cardH + 6;

  if (totals.isPartial) {
    font("sans", 8); color(MUTED);
    const scopeCount = (quotation.items || []).filter((i) => i.status !== "REJECTED").length;
    doc.text(`Selected scope: ${totals.items.length} of ${scopeCount} items`, M, y);
    y += 5;
  }

  // ---- Categories ----
  const COLS = { no: 8, photo: 12, qty: 14, unit: 14, rate: 20, disc: 16, amt: 25 };
  const descW = W - (COLS.no + COLS.photo + COLS.qty + COLS.unit + COLS.rate + COLS.disc + COLS.amt);
  let rowNo = 0;

  blocks.forEach((block, bi) => {
    const tone = TONES[bi % TONES.length];
    const count = `${block.items.length} item${block.items.length === 1 ? "" : "s"}`;

    // Each product's description lines, measured up front so the row is tall enough for them.
    font("sans", 6.8);
    const subs = block.items.map((it) => {
      const sub = [it.description?.split(/\r?\n/)[0], it.color, it.location || it.roomName].filter(Boolean).join("  ·  ");
      return sub ? (doc.splitTextToSize(sub, descW - 4) as string[]).slice(0, 2) : [];
    });

    ensure(8 + 7 + 12 + 10);
    // Header (top corners rounded; its lower edge sits under the column titles)
    doc.setFillColor(...tone.bg).setDrawColor(...tone.bar).setLineWidth(0.3);
    shape(M, y, W, 10, 1.8, { tl: true, tr: true }, "FD");
    font("serif", 11); color(INK);
    const name = block.category.toUpperCase();
    doc.text(name, M + 5, y + 5.6);
    const nameW = doc.getTextWidth(name);
    font("sans", 7.5); color(MUTED);
    doc.text(count, M + 5 + nameW + 3, y + 5.6);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["#", { content: "Description", colSpan: 2, styles: { halign: "left" } }, "Qty", "Unit",
        `Rate (${R.trim()})`, "Disc. (%)", { content: `Amount (${R.trim()})`, styles: { halign: "right" } }]],
      body: block.items.map((it) => {
        rowNo += 1;
        return [String(rowNo), "", "", fmt(it.quantity), unitLabel(it.unit), fmt(it.rate), discText(it), fmt(it.totalAmount)];
      }),
      theme: "grid",
      margin: { left: M, right: M },
      tableWidth: W,
      styles: {
        font: embedded ? "JBSans" : "helvetica", fontStyle: "normal", fontSize: 8, textColor: INK,
        lineColor: LINE, lineWidth: 0.15, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
        halign: "center", valign: "middle",
      },
      headStyles: {
        font: embedded ? "JBSansSemi" : "helvetica", fontStyle: embedded ? "normal" : "bold",
        fillColor: [251, 252, 253], textColor: INK, fontSize: 7.8, cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      },
      columnStyles: {
        0: { cellWidth: COLS.no, textColor: MUTED },
        1: { cellWidth: COLS.photo },
        2: { cellWidth: descW, halign: "left" },
        3: { cellWidth: COLS.qty },
        4: { cellWidth: COLS.unit },
        5: { cellWidth: COLS.rate },
        6: { cellWidth: COLS.disc },
        7: { cellWidth: COLS.amt, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (d) => {
        if (d.section !== "body") return;
        const lines = subs[d.row.index]?.length ?? 0;
        d.cell.styles.minCellHeight = Math.max(11, 7.4 + lines * 3);
      },
      didDrawCell: (d) => {
        if (d.section !== "body") return;
        const it = block.items[d.row.index];
        if (!it) return;
        const { x, y: cy, width: cw, height: ch } = d.cell;
        if (d.column.index === 1) {
          const size = 8.5;
          const ix = x + (cw - size) / 2, iy = cy + (ch - size) / 2;
          const src = it.imageUrl ? assets[it.imageUrl] : undefined;
          if (src) {
            try { doc.addImage(src, "JPEG", ix, iy, size, size); return; } catch { /* placeholder */ }
          }
          doc.setFillColor(241, 239, 233);
          doc.roundedRect(ix, iy, size, size, 0.8, 0.8, "F");
        } else if (d.column.index === 2) {
          const lines = subs[d.row.index] || [];
          const blockH = 4 + lines.length * 3;
          let ty = cy + (ch - blockH) / 2 + 3;
          font("semi", 8.5); color(INK);
          const name = (doc.splitTextToSize(it.itemName || "", cw - 22) as string[])[0] || "";
          doc.text(name, x + 2, ty);
          // CUSTOM / INVENTORY tag
          const inv = it.productId != null;
          const tag = inv ? "INVENTORY" : "CUSTOM";
          const tx = x + 2 + doc.getTextWidth(name) + 2.5;
          font("semi", 5.6);
          const tw = doc.getTextWidth(tag) + 2.6;
          if (tx + tw < x + cw - 1) {
            doc.setFillColor(...((inv ? [227, 244, 232] : [230, 239, 252]) as RGB));
            doc.roundedRect(tx, ty - 2.75, tw, 3.5, 0.6, 0.6, "F");
            color((inv ? [37, 128, 74] : [47, 99, 181]) as RGB);
            doc.text(tag, tx + 1.3, ty - 0.2);
          }
          font("sans", 6.8); color(MUTED);
          lines.forEach((l) => { ty += 3; doc.text(l, x + 2, ty); });
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY;

    // Category total (bottom corners rounded)
    if (y + 9 > bottom) newPage();
    doc.setFillColor(...tone.bg).setDrawColor(...tone.bar).setLineWidth(0.3);
    shape(M, y, W, 9, 1.8, { bl: true, br: true }, "FD");
    font("semi", 9.5); color(INK);
    doc.text("Category Total", M + 5, y + 5.9);
    const lw = doc.getTextWidth("Category Total");
    font("sans", 7.8); color(MUTED);
    doc.text(`(${count})`, M + 5 + lw + 2, y + 5.9);
    doc.setDrawColor(...tone.bar).setLineWidth(0.2);
    doc.line(rx - 38, y + 2, rx - 38, y + 7);
    font("bold", 11.5); color(INK);
    doc.text(money(block.total), rx - 4, y + 6.1, { align: "right" });
    y += 9 + 5;
  });

  // ---- Summary (right) beside terms + bank details (left) ----
  const charges = (sel.includeExtras ?? true) ? quoteCharges(quotation) : [];
  const isLabour = (l: string) => /labou?r/i.test(l);
  const isShipping = (l: string) => /ship|transport|delivery/i.test(l);
  const gross = totals.items.reduce((s, i) => s + lineGrossOf(i), 0);
  const lineDisc = totals.items.reduce((s, i) => s + lineDiscountAmount(i), 0);
  const net = totals.items.reduce((s, i) => s + n(i.totalAmount), 0);
  const gstPct = ((quotation as any).taxes || []).filter((t: any) => !t.isInclusive).reduce((s: number, t: any) => s + n(t.percentage), 0);
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: "Products Total", value: money(gross) },
    ...(lineDisc > 0 ? [{ label: "Line Discount", value: `- ${money(lineDisc)}` }] : []),
    { label: "Products Net Total", value: money(net), strong: true },
    { label: "Labour", value: money(charges.filter((c) => isLabour(c.label)).reduce((s, c) => s + c.amount, 0)) },
    { label: "Shipping", value: money(charges.filter((c) => isShipping(c.label)).reduce((s, c) => s + c.amount, 0)) },
    ...charges.filter((c) => !isLabour(c.label) && !isShipping(c.label))
      .map((c) => ({ label: c.note ? `${c.label} · ${c.note}` : c.label, value: money(c.amount) })),
    ...(totals.discount > 0 ? [{ label: "Discount", value: `- ${money(totals.discount)}` }] : []),
    { label: `GST${gstPct > 0 || totals.gst === 0 ? ` (${fmt(gstPct)}%)` : ""}`, value: money(totals.gst) },
  ];
  const sumW = 74, sumX = rx - sumW, rowH = 5.4;
  const sumH = rows.length * rowH + 4 + 11;

  const leftW = sumX - M - 5;
  const terms = (quotation.termsAndConditions || "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  font("sans", 7.6);
  const termLines = terms.flatMap((t, i) => (doc.splitTextToSize(`${i + 1}. ${t}`, leftW - 10) as string[]));
  const termsH = terms.length ? 11 + termLines.length * 3.6 + 3 : 0;
  let bank: BankDetails | null = null;
  try { bank = assets[BANK_KEY] ? JSON.parse(assets[BANK_KEY]) : null; } catch { bank = null; }
  const qr = assets[QR_KEY];
  const bankRows = bank ? ([
    ["Account Name", bank.accountName], ["Bank", bank.bankName], ["A/C No.", bank.accountNumber],
    ["IFSC", bank.ifsc], ["Branch", bank.branch], ["UPI ID", bank.upiId],
  ].filter((r) => r[1]) as [string, string][]) : [];
  const bankH = bankRows.length ? Math.max(13 + bankRows.length * 4.6, qr ? 33 : 0) : 0;
  const leftH = termsH + (termsH && bankH ? 4 : 0) + bankH;

  ensure(Math.min(Math.max(sumH, leftH), bottom - 14));
  const top = y;

  // Summary
  doc.setFillColor(246, 248, 251).setDrawColor(...LINE).setLineWidth(0.25);
  doc.roundedRect(sumX, y, sumW, sumH, 2, 2, "FD");
  let sy = y + 3;
  rows.forEach((r) => {
    if (r.strong) { doc.setFillColor(251, 243, 226); doc.rect(sumX + 0.2, sy, sumW - 0.4, rowH, "F"); }
    font(r.strong ? "semi" : "sans", r.strong ? 8.6 : 8.2); color(r.strong ? INK : [60, 72, 84]);
    doc.text(r.label, sumX + 4, sy + 3.8);
    font(r.strong ? "bold" : "semi", 8.6); color(INK);
    doc.text(r.value, rx - 4, sy + 3.8, { align: "right" });
    sy += rowH;
  });
  sy += 1;
  doc.setFillColor(13, 52, 51);
  doc.roundedRect(sumX, sy, sumW, 11, 2, 2, "F");
  font("semi", 10); doc.setTextColor(255, 255, 255);
  doc.text("Final Price", sumX + 5, sy + 7.2);
  font("bold", 13);
  doc.text(money(totals.grandTotal), rx - 4, sy + 7.6, { align: "right" });

  // Terms
  let ly = top;
  if (termsH) {
    doc.setFillColor(255, 255, 255).setDrawColor(...LINE).setLineWidth(0.25);
    doc.roundedRect(M, ly, leftW, termsH, 2, 2, "FD");
    font("semi", 9.5); color(INK);
    doc.text("Terms & Conditions", M + 5, ly + 7);
    font("sans", 7.6); color([60, 72, 84]);
    termLines.forEach((l, i) => doc.text(l, M + 5, ly + 12 + i * 3.6));
    ly += termsH + 4;
  }

  // Bank details + UPI QR
  if (bankH) {
    doc.setFillColor(253, 248, 236).setDrawColor(240, 226, 196).setLineWidth(0.25);
    doc.roundedRect(M, ly, leftW, bankH, 2, 2, "FD");
    font("semi", 9.5); color(INK);
    doc.text("Bank Details", M + 5, ly + 7);
    const valueW = leftW - 30 - (qr ? 32 : 6);
    bankRows.forEach(([k, v], i) => {
      const cy = ly + 13.5 + i * 4.6;
      font("sans", 7.4); color(MUTED);
      doc.text(k, M + 5, cy);
      font("semi", 8); color(INK);
      doc.text((doc.splitTextToSize(v, valueW) as string[])[0], M + 30, cy);
    });
    if (qr) {
      const qx = M + leftW - 29;
      doc.setFillColor(255, 255, 255).setDrawColor(...LINE);
      doc.roundedRect(qx, ly + 3, 25, 28, 1.5, 1.5, "FD");
      try { doc.addImage(qr, "PNG", qx + 2.5, ly + 4.5, 20, 20); } catch { /* no QR */ }
      font("sans", 5.8); color(MUTED);
      doc.text("Scan to pay via UPI", qx + 12.5, ly + 28.3, { align: "center" });
    }
    ly += bankH;
  }
  y = Math.max(top + sumH, ly) + 6;

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(201, 154, 62).setLineWidth(0.3);
    doc.line(M, pageH - 9, rx, pageH - 9);
    font("sans", 7); color(MUTED);
    doc.text(`${quotation.quotationNumber || ""} · Thank you for your business`, M, pageH - 5);
    doc.text(`Page ${i} of ${pages}`, rx, pageH - 5, { align: "right" });
  }
  return doc;
}

function fmtDay(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function addDays(d: string | null | undefined, days: number) {
  if (!d) return undefined;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return undefined;
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function unitLabel(u?: string) {
  if (!u) return "—";
  const l = u.toLowerCase();
  if (l === "sqft" || l === "sft") return "Sqft";
  return u.charAt(0).toUpperCase() + u.slice(1);
}

function discText(it: QuotationItem) {
  if (n(it.discountPercentage) > 0) return `${Number(it.discountPercentage).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
  if (n(it.discountAmount) > 0) return Number(it.discountAmount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return "0%";
}

/** Rate × qty, before the line's own discount. */
const lineGrossOf = (it: QuotationItem) => n(it.rate) * n(it.quantity);

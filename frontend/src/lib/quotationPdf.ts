import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildQuotationTree, type Quotation } from "@/types/quotation";

// jsPDF's built-in fonts don't carry the ₹ glyph, so use "Rs." in the PDF to avoid tofu boxes.
const money = (v?: number) =>
  v === undefined || v === null ? "-" : `Rs. ${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Builds and downloads a floor-grouped PDF of the quotation:
 * FLOOR heading → per Room table (Item, Specification, Qty, Material, Labour, Total) → Room Total →
 * Floor Total, then Floor Summary + Grand Summary + Terms. Uses the same buildQuotationTree grouping
 * as the on-screen tree so the two always match.
 */
export function downloadQuotationPdf(quotation: Quotation) {
  const tree = buildQuotationTree(quotation.items || []);
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const bottom = pageH - 16;
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
  const rx = pageW - marginX;
  let ry = y;
  if (client) { doc.setFont("helvetica", "bold").setTextColor(15, 23, 42).text(client, rx, ry, { align: "right" }); ry += 4.5; }
  doc.setFont("helvetica", "normal").setTextColor(100, 116, 139);
  if (quotation.quotationDate) { doc.text(`Date: ${quotation.quotationDate}`, rx, ry, { align: "right" }); ry += 4.5; }
  if (quotation.expiryDate) { doc.text(`Valid until: ${quotation.expiryDate}`, rx, ry, { align: "right" }); }
  doc.setTextColor(0, 0, 0);
  y += 10;

  // --- Floors ---
  for (const floor of tree.floors) {
    ensure(18);
    // Floor bar
    doc.setFillColor(30, 41, 59);
    doc.rect(marginX, y, pageW - 2 * marginX, 7, "F");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
    doc.text(floor.floor.toUpperCase(), marginX + 2, y + 4.8);
    doc.text(money(floor.total), rx - 2, y + 4.8, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 10;

    for (const room of floor.rooms) {
      ensure(16);
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(51, 65, 85);
      doc.text(room.room, marginX, y);
      doc.setTextColor(0, 0, 0);
      y += 2;

      const body = room.categories.flatMap((cat) =>
        cat.items.map((it) => [
          it.itemName || "",
          it.specification || it.brand || "",
          `${it.quantity ?? ""} ${it.unit ?? ""}`.trim(),
          money(it.materialCost),
          money(it.labourCost),
          money(it.totalAmount),
        ]),
      );

      autoTable(doc, {
        startY: y,
        head: [["Item", "Specification", "Qty", "Material", "Labour", "Total"]],
        body,
        foot: [[
          { content: `${room.room} Total`, colSpan: 5, styles: { halign: "left", fontStyle: "bold" } },
          { content: money(room.total), styles: { halign: "right", fontStyle: "bold" } },
        ]],
        styles: { fontSize: 8, cellPadding: 1.4, lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold" },
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] },
        columnStyles: {
          2: { halign: "right", cellWidth: 20 },
          3: { halign: "right", cellWidth: 24 },
          4: { halign: "right", cellWidth: 24 },
          5: { halign: "right", cellWidth: 26 },
        },
        margin: { left: marginX, right: marginX },
        theme: "grid",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 5;
    }

    ensure(10);
    doc.setDrawColor(30, 41, 59).setLineWidth(0.4);
    doc.line(marginX, y, rx, y);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    doc.text(`${floor.floor} Total`, marginX, y);
    doc.text(money(floor.total), rx, y, { align: "right" });
    y += 8;
  }

  // --- Floor Summary ---
  ensure(14 + tree.floors.length * 6);
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(51, 65, 85);
  doc.text("Floor Summary", marginX, y);
  doc.setTextColor(0, 0, 0);
  y += 2;
  autoTable(doc, {
    startY: y,
    body: tree.floors.map((f) => [f.floor, money(f.total)]),
    styles: { fontSize: 8.5, cellPadding: 1.4 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: marginX, right: marginX },
    theme: "plain",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // --- Grand Summary (right aligned) ---
  ensure(40);
  const gLabelX = pageW - marginX - 60;
  const line = (label: string, val: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 11 : 9);
    doc.text(label, gLabelX, y);
    doc.text(val, rx, y, { align: "right" });
    y += bold ? 7 : 5;
  };
  line("Material Total", money(quotation.materialTotal));
  line("Labour Total", money(quotation.labourTotal));
  line("Additional Charges", money(quotation.additionalChargesTotal));
  line("Discount", `- ${money(quotation.discount)}`);
  line("GST", `+ ${money(quotation.gst)}`);
  doc.setDrawColor(30, 41, 59).setLineWidth(0.4);
  doc.line(gLabelX, y - 1, rx, y - 1);
  y += 3;
  line("Grand Total", money(quotation.grandTotal), true);

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

  doc.save(`${quotation.quotationNumber || "quotation"}.pdf`);
}

import { COMPANY_FALLBACK, fetchCompanyProfile } from "@/lib/companyProfile";
import type { WorkBoard } from "@/types/projectWork";

export interface JobCardInfo {
  projectCode?: string; projectName?: string; customerName?: string; phone?: string;
  address?: string; startDate?: string; endDate?: string; manager?: string;
}

/**
 * Prints the project's job card, fitting whatever paper is chosen in the print dialog (A4, A5 or a 58/80 mm thermal roll): every product to build, grouped by category, with
 * colour / quantity / room, the description notes and the steps to tick off on the shop floor.
 * Self-contained HTML in a pop-up so it prints without the app's chrome.
 */
export async function printJobCard(board: WorkBoard, info?: JobCardInfo) {
  // Open synchronously (pop-up blockers), fill after the company profile arrives.
  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) { alert("Please allow pop-ups to print the job card."); return; }
  const co = await fetchCompanyProfile().catch(() => COMPANY_FALLBACK);
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const sections = board.categories.map((cat) => {
    const rows = cat.lines.map((l, i) => {
      const meta = [l.color, l.quantity != null ? `${Number(l.quantity)} ${l.unit || ""}`.trim() : "", l.location].filter(Boolean).join(" · ");
      const desc = (l.descriptions || []).map((d) => `<li>${esc(d)}</li>`).join("");
      const steps = l.steps.map((s) => `<span class="st"><i class="bx"></i>${esc(s.label.replace(" to site", ""))}</span>`).join("");
      return `<tr>
        <td class="no">${i + 1}</td>
        <td><div class="nm">${esc(l.itemName)}</div>${meta ? `<div class="mut">${esc(meta)}</div>` : ""}
          ${desc ? `<ul class="ds">${desc}</ul>` : ""}</td>
        <td class="sp">${steps}</td>
      </tr>`;
    }).join("");
    return `<h2>${esc(cat.category)}</h2>
      <table><thead><tr><th>#</th><th>Product / details</th><th>Work steps</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("");

  const dt = (s?: string) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
  const facts: [string, string | undefined][] = [
    ["Customer", info?.customerName], ["Phone", info?.phone], ["Site address", info?.address],
    ["Project", [info?.projectCode, info?.projectName].filter(Boolean).join(" · ") || undefined],
    ["Start", dt(info?.startDate)], ["Due", dt(info?.endDate)], ["Project manager", info?.manager],
  ];
  const infoBlock = facts.filter(([, v]) => v).map(([k, v]) =>
    `<div class="f${k === "Site address" ? " wide" : ""}"><b>${esc(k)}</b>${esc(v)}</div>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Job card</title>
  <style>
    @page { margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a211e; font-size: 12px; margin: 0; }
    .hd { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0a573b; padding-bottom: 8px; }
    .hd h1 { margin: 0; font-size: 20px; color: #0a573b; }
    .mut { color: #6b7169; font-size: 11px; margin-top: 2px; }
    .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 14px; margin-top: 10px; padding: 8px 10px; background: #faf8f3; border: 1px solid #e5e1d6; border-radius: 4px; }
    .f b { display: block; font-size: 10px; text-transform: uppercase; color: #6b7169; font-weight: 600; }
    .f.wide { grid-column: span 3; }
    h2 { font-size: 13px; margin: 16px 0 6px; background: #f3eee2; padding: 5px 8px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10.5px; text-transform: uppercase; color: #6b7169; border-bottom: 1px solid #ccc; padding: 4px 6px; }
    td { border-bottom: 1px solid #e5e1d6; padding: 6px; vertical-align: top; }
    tr { page-break-inside: avoid; }
    .no { width: 24px; }
    .nm { font-weight: 700; font-size: 13px; }
    .ds { margin: 4px 0 0; padding-left: 16px; } .ds li { margin-bottom: 2px; }
    .sp { width: 170px; } .st { display: block; margin-bottom: 4px; }
    .bx { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #333; margin-right: 6px; vertical-align: -1px; }
    /* A5 and narrower */
    @media (max-width: 150mm) {
      body { font-size: 11px; } .hd h1 { font-size: 17px; }
      .info { grid-template-columns: repeat(2, 1fr); } .f.wide { grid-column: span 2; }
      .sp { width: 110px; }
    }
    /* Thermal rolls (58 / 80 mm): everything stacks in one column */
    @media (max-width: 90mm) {
      body { font-size: 10.5px; } .hd { display: block; } .hd h1 { font-size: 15px; }
      .info { grid-template-columns: 1fr; } .f.wide { grid-column: auto; }
      table, thead, tbody, tr, td { display: block; width: 100% !important; }
      thead { display: none; }
      td { border: 0; padding: 2px 0; } tr { border-bottom: 1px dashed #666; padding: 5px 0; }
      .no { display: inline; font-weight: 700; } .no::after { content: "."; }
      .sp { display: flex; flex-wrap: wrap; gap: 2px 10px; } .st { margin: 0; }
      h2 { margin: 10px 0 4px; background: none; border-bottom: 1px solid #000; border-radius: 0; padding: 2px 0; }
      .sign { display: block; } .sign div { margin-top: 18px; }
    }
    .sign { display: flex; gap: 24px; margin-top: 28px; } .sign div { flex: 1; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #6b7169; }
  </style></head><body>
    <div class="hd">
      <div><h1>Job Card</h1><div class="mut">${esc(co.name)} · Project #${esc(board.projectId)}</div></div>
      <div class="mut" style="text-align:right">Printed ${esc(today)}<br/>${esc(board.productCount)} products</div>
    </div>
    ${infoBlock ? `<div class="info">${infoBlock}</div>` : ""}
    ${sections || '<p class="mut">No products on this project yet.</p>'}
    <div class="sign"><div>Prepared by</div><div>Supervisor</div><div>Completed on</div></div>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

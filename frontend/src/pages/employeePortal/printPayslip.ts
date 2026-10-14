import type { Payslip } from '@/types/employeePortal';
import { fetchCompanyProfile } from '@/lib/companyProfile';

export type PayslipRow = [string, number];

/** Who the payslip is for. Everything but the name is optional and shown only when present. */
export interface PayslipEmployee {
  employeeName?: string;
  employeeCode?: string;
  designation?: string | null;
  department?: string | null;
  dateOfJoining?: string | null;
  bankAccount?: string | null;
  uan?: string | null;
  pfNumber?: string | null;
  esiNumber?: string | null;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const below1000 = (n: number) => (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '') : below100(n));

/** Rupee amount in words, Indian grouping (Lakh / Crore): 125000.5 → "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only". */
export function amountInWords(amount: number): string {
  const total = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(total / 100);
  const paise = total % 100;
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(below1000(crore) + ' Crore');
  if (lakh) parts.push(below100(lakh) + ' Lakh');
  if (thousand) parts.push(below100(thousand) + ' Thousand');
  if (rest) parts.push(below1000(rest));
  let words = rupees ? 'Rupees ' + parts.join(' ') : '';
  if (paise) words += (rupees ? ' and ' : 'Rupees ') + below100(paise) + ' Paise';
  return words.trim() + ' Only';
}

/**
 * The payslip's earnings and deductions as named rows — the one list both the portal screen and the
 * PDF render, so they always match and add up to Gross / Total. Zero rows are dropped; admin-added and
 * auto lines (e.g. "Leads collected — 12 × ₹50") follow the computed ones.
 */
export function payslipRows(slip: Payslip): { earnings: PayslipRow[]; deductions: PayslipRow[] } {
  const monthlyHours = slip.standardHours != null; // MONTHLY generated from hours
  const items = slip.lineItems ?? [];
  const n = (v?: number | null) => Number(v || 0);
  const nonZero = (rows: PayslipRow[]) => rows.filter(([, v]) => n(v) !== 0);
  // `bonus` is project + manual bonus; older payslips may only have the combined figure.
  const splitBonus = n(slip.projectBonus) + n(slip.manualBonus);
  const otherDed = Math.max(0, n(slip.otherDeductions) - n(slip.manualDeduction));

  const earnings = nonZero([
    ['Basic', n(slip.basic)], ['HRA', n(slip.hra)], ['Allowances', n(slip.allowances)],
    [monthlyHours ? 'Salary for hours worked' : slip.payType === 'HOURLY' ? 'Regular earnings' : 'Salary', n(slip.regularEarnings)],
    ['Overtime pay', n(slip.overtimeAmount)],
    ...(splitBonus > 0
      ? [['Project bonus', n(slip.projectBonus)], ['Manual bonus', n(slip.manualBonus)]] as PayslipRow[]
      : [['Bonus', n(slip.bonus)]] as PayslipRow[]),
    ['Incentive', n(slip.incentive)], ['Other earnings', n(slip.otherEarnings)],
    ...items.filter((i) => i.category === 'EARNING').map((i) => [i.label, i.amount] as PayslipRow),
  ]);
  const deductions = nonZero([
    ['PF', n(slip.pfAmount)], ['ESI', n(slip.esiAmount)], ['Professional tax', n(slip.professionalTax)],
    ['Leave (LOP)', n(slip.leaveDeduction)], ['Manual deduction', n(slip.manualDeduction)], ['Other deductions', otherDed],
    ['Advance recovery', n(slip.advanceRecovery)], ['Loan recovery', n(slip.loanRecovery)],
    ...items.filter((i) => i.category === 'DEDUCTION').map((i) => [i.label, i.amount] as PayslipRow),
  ]);
  return { earnings, deductions };
}

/**
 * The one A4 payslip document, used by the employee portal PDF and the HR preview/print so they can't
 * drift apart. Company name/address/phone come from Website › Settings.
 */
export async function buildPayslipHtml(slip: Payslip, opts?: PayslipEmployee): Promise<string> {
  const company = await fetchCompanyProfile();
  const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const inr = (n?: number | null) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

  const monthlyHours = slip.standardHours != null;
  const hourly = slip.payType === 'HOURLY' || monthlyHours;
  const { earnings, deductions } = payslipRows(slip);

  const rowsHtml = (rows: PayslipRow[]) =>
    rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${inr(v)}</td></tr>`).join('') || '<tr><td class="mut">—</td><td></td></tr>';

  const meta = hourly
    ? `<div><span>Attendance days</span><span>${slip.attendanceDays ?? '—'}</span></div>
       <div><span>Worked hrs</span><span>${slip.workedHours ?? '—'}</span></div>
       <div><span>Overtime hrs</span><span>${slip.overtimeHours ?? '—'}</span></div>
       ${monthlyHours
         ? `<div><span>Monthly salary</span><span>${inr(slip.monthlySalary)} ÷ ${slip.standardHours} hrs</span></div>`
         : `<div><span>Hourly rate</span><span>${slip.hourlyRate != null ? inr(slip.hourlyRate) : '—'}</span></div>`}
       <div><span>OT rate</span><span>${slip.overtimeRate != null ? inr(slip.overtimeRate) : '—'}</span></div>`
    : `<div><span>Working days</span><span>${slip.workingDays ?? '—'}</span></div>
       <div><span>Paid days</span><span>${slip.paidDays ?? '—'}</span></div>
       <div><span>LOP days</span><span>${slip.lopDays ?? '—'}</span></div>`;

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const acct = opts?.bankAccount ? 'XXXX' + String(opts.bankAccount).replace(/\s/g, '').slice(-4) : '';
  const details = ([
    ['Designation', opts?.designation], ['Department', opts?.department], ['Date of joining', fmtDate(opts?.dateOfJoining)],
    ['Bank a/c', acct], ['UAN', opts?.uan], ['PF no.', opts?.pfNumber], ['ESI no.', opts?.esiNumber],
  ] as [string, string | null | undefined][]).filter(([, v]) => v);
  const detailsHtml = details.length
    ? `<div class="meta emp">${details.map(([k, v]) => `<div><span>${k}</span><span>${esc(v)}</span></div>`).join('')}</div>`
    : '';

  const contact = [company.address, company.phone].filter(Boolean).map(esc).join(' · ');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(slip.payslipNumber || '')}</title>
  <style>
    *{box-sizing:border-box}
    @page{size:A4;margin:14mm}
    body{font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#111;margin:0;font-size:13px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #0f5132;padding-bottom:10px;margin-bottom:14px}
    .co{font-size:22px;font-weight:800;color:#0f5132}
    .sub{color:#555;font-size:12px}
    .addr{color:#666;font-size:11px;margin-top:2px;max-width:340px}
    .rt{text-align:right;font-size:12px}
    .rt .no{font-family:monospace;color:#666;font-size:11px}
    .rt .nm{font-weight:700;font-size:14px}
    .meta{display:flex;gap:18px;flex-wrap:wrap;background:#f6f7f6;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:14px}
    .meta div{display:flex;flex-direction:column}
    .meta span:first-child{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.4px}
    .meta span:last-child{font-weight:700}
    .words{margin-top:8px;font-size:12px;color:#333}
    .sign{display:flex;justify-content:space-between;margin-top:48px;font-size:11px;color:#555}
    .sign div{border-top:1px solid #999;padding-top:4px;min-width:150px;text-align:center}
    .cols{display:flex;gap:24px}
    .col{flex:1}
    h3{font-size:13px;color:#0f5132;border-bottom:1px solid #ddd;padding-bottom:4px;margin:0 0 6px}
    table{width:100%;border-collapse:collapse}
    td{padding:3px 0;vertical-align:top}
    .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    .mut{color:#999}
    .tot td{border-top:2px solid #333;font-weight:800;padding-top:6px}
    .net{margin-top:16px;display:flex;justify-content:space-between;align-items:center;background:#0f5132;color:#fff;border-radius:10px;padding:12px 18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .net .lbl{font-weight:700}
    .net .amt{font-size:22px;font-weight:800}
    .note{margin-top:10px;font-size:12px;color:#333;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;white-space:pre-wrap}
    .prev{margin-bottom:10px;padding:6px 12px;border:1px dashed #b45309;border-radius:8px;background:#fffbeb;color:#92400e;font-size:12px;font-weight:600}
    .foot{margin-top:10px;color:#888;font-size:11px}
  </style></head><body>
    <div class="head">
      <div>
        <div class="co">${esc(company.name)}</div>
        ${contact ? `<div class="addr">${contact}</div>` : ''}
        <div class="sub">Payslip — ${MONTHS[slip.month]} ${slip.year}</div>
      </div>
      <div class="rt">
        ${slip.payslipNumber ? `<div class="no">${esc(slip.payslipNumber)}</div>` : ''}
        ${opts?.employeeName ? `<div class="nm">${esc(opts.employeeName)}</div>` : ''}
        ${opts?.employeeCode ? `<div class="sub">${esc(opts.employeeCode)}</div>` : ''}
      </div>
    </div>
    ${slip.status === 'PREVIEW' ? '<div class="prev">PREVIEW — not final. Figures may change until HR generates and approves this month’s payroll.</div>' : ''}
    ${detailsHtml}
    <div class="meta">${meta}</div>
    <div class="cols">
      <div class="col">
        <h3>Earnings</h3>
        <table>${rowsHtml(earnings)}<tr class="tot"><td>Gross</td><td class="num">${inr(slip.grossEarnings)}</td></tr></table>
      </div>
      <div class="col">
        <h3>Deductions</h3>
        <table>${rowsHtml(deductions)}<tr class="tot"><td>Total</td><td class="num">${inr(slip.totalDeductions)}</td></tr></table>
      </div>
    </div>
    <div class="net"><span class="lbl">Net Pay</span><span class="amt">${inr(slip.netSalary)}</span></div>
    <div class="words"><b>Net pay in words:</b> ${esc(amountInWords(slip.netSalary))}</div>
    ${slip.remarks ? `<div class="note"><b>Note:</b> ${esc(slip.remarks)}</div>` : ''}
    <div class="foot">Status: ${slip.status === 'PREVIEW' ? 'Preview (not final)' : esc(slip.status)}${slip.paymentDate ? ` · Paid on ${esc(slip.paymentDate)}` : ''} · This is a computer-generated payslip.</div>
    <div class="sign"><div>Employee signature</div><div>Authorised signatory</div></div>
  </body></html>`;
  return html;
}

/**
 * Renders the shared A4 payslip into a hidden frame and opens the print dialog, so an employee (or HR)
 * can save it as a PDF (Print → Save as PDF on desktop and Android, Share → Print on iPhone). No pop-up
 * window, so pop-up blockers can't stop it.
 */
export async function printPayslip(slip: Payslip, opts?: PayslipEmployee) {
  const html = await buildPayslipHtml(slip, opts);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const w = frame.contentWindow!;
  // The browser keeps the frame until printing finishes; remove it afterwards.
  w.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0));
  setTimeout(() => { w.focus(); w.print(); }, 250);
}

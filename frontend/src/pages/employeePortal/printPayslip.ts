import type { Payslip } from '@/types/employeePortal';

/**
 * Opens a clean, print-ready payslip window and triggers the browser print dialog, so an employee can
 * save their payslip as a PDF from the portal (Print → Save as PDF works on desktop and mobile).
 * Self-contained inline styles so it prints without the app's chrome. Includes the auto-computed
 * breakdown plus any admin-added named line items (incentives / allowances / deductions).
 */
export function printPayslip(slip: Payslip, opts?: { employeeName?: string; employeeCode?: string; company?: string }) {
  const company = opts?.company || 'JB Decor';
  const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const inr = (n?: number | null) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

  const hourly = slip.payType === 'HOURLY';
  const items = slip.lineItems ?? [];

  const earnings: [string, number][] = [
    ...(hourly
      ? [['Regular earnings', slip.regularEarnings ?? 0], ['Overtime pay', slip.overtimeAmount],
         ['Project bonus', slip.projectBonus ?? 0], ['Manual bonus', slip.manualBonus ?? 0], ['Incentive', slip.incentive]] as [string, number][]
      : [['Basic', slip.basic], ['HRA', slip.hra], ['Overtime', slip.overtimeAmount], ['Bonus', slip.bonus], ['Incentive', slip.incentive]] as [string, number][]),
    ...items.filter((i) => i.category === 'EARNING').map((i) => [i.label, i.amount] as [string, number]),
  ];
  const deductions: [string, number][] = [
    ['PF', slip.pfAmount], ['ESI', slip.esiAmount], ['Professional tax', slip.professionalTax],
    ['Leave (LOP)', slip.leaveDeduction], ['Advance recovery', slip.advanceRecovery], ['Loan recovery', slip.loanRecovery],
    ...items.filter((i) => i.category === 'DEDUCTION').map((i) => [i.label, i.amount] as [string, number]),
  ];

  const rowsHtml = (rows: [string, number][]) =>
    rows.filter(([, v]) => Number(v) !== 0)
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${inr(v)}</td></tr>`).join('') || '<tr><td class="mut">—</td><td></td></tr>';

  const meta = hourly
    ? `<div><span>Attendance days</span><span>${slip.attendanceDays ?? '—'}</span></div>
       <div><span>Worked hrs</span><span>${slip.workedHours ?? '—'}</span></div>
       <div><span>Hourly rate</span><span>${slip.hourlyRate != null ? inr(slip.hourlyRate) : '—'}</span></div>`
    : `<div><span>Working days</span><span>${slip.workingDays ?? '—'}</span></div>
       <div><span>Paid days</span><span>${slip.paidDays ?? '—'}</span></div>
       <div><span>LOP days</span><span>${slip.lopDays ?? '—'}</span></div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(slip.payslipNumber || '')}</title>
  <style>
    *{box-sizing:border-box}
    @page{size:A4;margin:14mm}
    body{font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#111;margin:0;font-size:13px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f5132;padding-bottom:10px;margin-bottom:14px}
    .co{font-size:22px;font-weight:800;color:#0f5132}
    .sub{color:#555;font-size:12px}
    .rt{text-align:right;font-size:12px}
    .rt .no{font-family:monospace;color:#666;font-size:11px}
    .rt .nm{font-weight:700;font-size:14px}
    .meta{display:flex;gap:18px;flex-wrap:wrap;background:#f6f7f6;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:14px}
    .meta div{display:flex;flex-direction:column}
    .meta span:first-child{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.4px}
    .meta span:last-child{font-weight:700}
    .cols{display:flex;gap:24px}
    .col{flex:1}
    h3{font-size:13px;color:#0f5132;border-bottom:1px solid #ddd;padding-bottom:4px;margin:0 0 6px}
    table{width:100%;border-collapse:collapse}
    td{padding:3px 0;vertical-align:top}
    .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    .mut{color:#999}
    .tot td{border-top:2px solid #333;font-weight:800;padding-top:6px}
    .net{margin-top:16px;display:flex;justify-content:space-between;align-items:center;background:#0f5132;color:#fff;border-radius:10px;padding:12px 18px}
    .net .lbl{font-weight:700}
    .net .amt{font-size:22px;font-weight:800}
    .foot{margin-top:10px;color:#888;font-size:11px}
  </style></head><body>
    <div class="head">
      <div>
        <div class="co">${esc(company)}</div>
        <div class="sub">Payslip — ${MONTHS[slip.month]} ${slip.year}</div>
      </div>
      <div class="rt">
        ${slip.payslipNumber ? `<div class="no">${esc(slip.payslipNumber)}</div>` : ''}
        ${opts?.employeeName ? `<div class="nm">${esc(opts.employeeName)}</div>` : ''}
        ${opts?.employeeCode ? `<div class="sub">${esc(opts.employeeCode)}</div>` : ''}
      </div>
    </div>
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
    <div class="foot">Status: ${esc(slip.status)}${slip.paymentDate ? ` · Paid on ${esc(slip.paymentDate)}` : ''} · This is a computer-generated payslip.</div>
    <script>window.onload=function(){window.print();setTimeout(function(){try{window.close()}catch(e){}},400)}</script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) { alert('Please allow pop-ups to download the payslip.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

import { Phone, Navigation, Wrench, Package, IndianRupee } from 'lucide-react';
import type { InstallOrderInfo, TaskDetail } from '@/types/employeeTask';
import ChecklistPanel from './ChecklistPanel';
import { stepLabel } from './OrderTaskView';

const digits = (s?: string | null) => (s || '').replace(/[^\d+]/g, '');
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
/** Seeded by the server on installation tasks (EmployeeTaskService.INSTALL_STEPS_CHECKLIST). */
const INSTALL_STEPS = 'Installation steps';

/**
 * Installation task body: who and where (call / navigate), the orders going out with their step, the
 * balance to collect on site, and the installer's steps. "Mark installed + collect" sits in the bottom bar.
 */
export default function InstallTaskView({ task, info, locked, onChanged }: {
  task: TaskDetail;
  info: InstallOrderInfo;
  locked: boolean;
  onChanged: () => void;
}) {
  const due = Number(info.balanceDue ?? 0);
  const phone = info.customerPhone;
  const navHref = info.mapLink && info.mapLink.startsWith('http') ? info.mapLink
    : info.customerAddress ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(info.customerAddress) : null;
  const steps = task.checklist.filter((c) => c.name === INSTALL_STEPS);
  const btn = 'flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE2DE] py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]';

  return (
    <div className="flex flex-col gap-3">
      {/* Who and where */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E7F2EC] text-[#0A573B]">
            <Wrench className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold text-[#1A211E]">Install at customer</p>
            <p className="truncate text-[14px] text-[#33392F]">
              {info.customerName || task.customer || 'Customer'}{info.invoiceNumber ? ` · Bill ${info.invoiceNumber}` : ''}
            </p>
            {info.customerAddress && <p className="mt-0.5 text-[12.5px] text-[#6B726E]">{info.customerAddress}</p>}
          </div>
        </div>
        {(phone || navHref) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {phone ? <a href={'tel:' + digits(phone)} className={btn}><Phone className="h-4 w-4" /> Call</a>
              : <span className={`${btn} opacity-40`}><Phone className="h-4 w-4" /> Call</span>}
            {navHref ? <a href={navHref} target="_blank" rel="noopener noreferrer" className={btn}><Navigation className="h-4 w-4" /> Navigate</a>
              : <span className={`${btn} opacity-40`}><Navigation className="h-4 w-4" /> Navigate</span>}
          </div>
        )}
      </div>

      {/* Orders going out */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="mb-2.5 flex items-center gap-2">
          <Package className="h-4 w-4 text-[#9B6B32]" />
          <h3 className="flex-1 text-[13px] font-bold uppercase tracking-wide text-[#1A211E]">Orders to install</h3>
        </div>
        <ul className="flex flex-col gap-2">
          {info.orders.map((o) => {
            const ready = o.status === 'COMPLETED' || o.status === 'DELIVERED';
            return (
              <li key={o.id} className="flex items-center gap-2 rounded-xl border border-[#EEEDE9] px-3 py-2.5 text-[13px]">
                <span className="font-mono font-bold text-[#1A211E]">{o.code}</span>
                <span className="text-[#7A817C]">{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${ready ? 'bg-[#E6F2EC] text-[#0A573B]' : 'bg-[#FFF3DD] text-[#8A5A12]'}`}>
                  {o.status === 'DELIVERED' ? 'Installed' : stepLabel(o.status)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className={`mt-2.5 rounded-lg px-2.5 py-2 text-[12.5px] ${info.installed || info.ready ? 'bg-[#E6F2EC] text-[#0A573B]' : 'bg-[#FFF6E5] text-[#8A5A12]'}`}>
          {info.installed ? 'Installed — done.'
            : info.ready ? 'Ready — take it from the shop and install it.'
            : 'Still being made — you get a notification when every order is Completed.'}
        </p>
      </div>

      {/* Money to collect on site */}
      {!info.installed && (
        <div className={`flex items-center gap-3 rounded-2xl border p-3.5 ${due > 0 ? 'border-[#F0E3C8] bg-[#FDF8EE]' : 'border-[#D9E7DD] bg-[#F3FAF6]'}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${due > 0 ? 'bg-[#F6ECDD] text-[#9B6B32]' : 'bg-[#E6F2EC] text-[#0A573B]'}`}>
            <IndianRupee className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7A817C]">{due > 0 ? 'Balance to collect' : 'Bill'}</p>
            <p className={`text-[20px] font-bold ${due > 0 ? 'text-[#8A5A12]' : 'text-[#0A573B]'}`}>{due > 0 ? inr(due) : 'Fully paid'}</p>
          </div>
        </div>
      )}

      {/* The installer's on-site steps */}
      {steps.length > 0 && (
        <ChecklistPanel taskId={task.id} checklist={steps} onChanged={onChanged} locked={locked || info.installed} title="Installation steps" />
      )}
    </div>
  );
}

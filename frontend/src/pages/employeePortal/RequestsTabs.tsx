import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Link, useLocation } from 'react-router-dom';
import {
  Boxes, Users, UserPlus, ClipboardList, Plane, PackageCheck, Truck, PhoneCall, Inbox,
} from 'lucide-react';
import { useT } from '@/i18n';

/** Every self-service request screen, in hub order. Shared by the Requests hub list and the tab bar. */
export const REQUEST_ITEMS: {
  to: string;
  labelKey: string;
  hintKey: string;
  icon: typeof Boxes;
  color: string;
}[] = [
  { to: '/employee/goods-receipts', labelKey: 'pw.requests.goodsReceipt', hintKey: 'pw.requests.goodsReceiptHint', icon: PackageCheck, color: 'text-blue-600' },
  { to: '/employee/deliveries', labelKey: 'pw.requests.goodsDelivery', hintKey: 'pw.requests.goodsDeliveryHint', icon: Truck, color: 'text-rose-600' },
  { to: '/employee/call-leads', labelKey: 'pw.requests.callLeads', hintKey: 'pw.requests.callLeadsHint', icon: PhoneCall, color: 'text-sky-600' },
  { to: '/employee/requests/material', labelKey: 'pw.requests.material', hintKey: 'pw.requests.materialHint', icon: Boxes, color: 'text-orange-600' },
  { to: '/employee/requests/manpower', labelKey: 'pw.requests.manpower', hintKey: 'pw.requests.manpowerHint', icon: Users, color: 'text-emerald-600' },
  { to: '/employee/leads', labelKey: 'pw.requests.leads', hintKey: 'pw.requests.leadsHint', icon: UserPlus, color: 'text-emerald-600' },
  { to: '/employee/daily-reports', labelKey: 'pw.requests.dailyReports', hintKey: 'pw.requests.dailyReportsHint', icon: ClipboardList, color: 'text-emerald-600' },
  { to: '/employee/leave', labelKey: 'pw.requests.leave', hintKey: 'pw.requests.leaveHint', icon: Plane, color: 'text-violet-600' },
];

const HUB = '/employee/requests';

/** True on the Requests hub and on every request screen it links to. */
export const isRequestsRoute = (p: string) =>
  p === HUB || p === `${HUB}/` || REQUEST_ITEMS.some((i) => p.startsWith(i.to));

/**
 * Scrollable tab bar (same look as the Tasks tabs) shown on the Requests hub and each request
 * screen, so employees can hop between request types without going back to the hub.
 */
export default function RequestsTabs() {
  const { pathname } = useLocation();
  const { t } = useT();
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  const tabs = [
    { to: HUB, label: t('pw.requests.title'), icon: Inbox, on: pathname === HUB || pathname === `${HUB}/`, count: 0 },
    ...REQUEST_ITEMS.map((i) => ({ to: i.to, label: t(i.labelKey), icon: i.icon, on: pathname.startsWith(i.to), count: counts[i.to] || 0 })),
  ];

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  // Unread employee alerts, bucketed by the request screen their actionUrl points at.
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.get('/notifications?size=100')
        .then((res) => {
          if (cancelled) return;
          const next: Record<string, number> = {};
          for (const n of (res.data.content || []) as { read: boolean; actionUrl?: string }[]) {
            if (n.read || !n.actionUrl) continue;
            const item = REQUEST_ITEMS.find((i) => n.actionUrl!.startsWith(i.to));
            if (item) next[item.to] = (next[item.to] || 0) + 1;
          }
          setCounts(next);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pathname]);

  return (
    <div className="sticky top-0 z-10 bg-[#F7F7F5]/95 px-3 pb-1 pt-2 backdrop-blur" role="tablist">
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-[0_2px_10px_rgba(0,35,22,0.06)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ to, label, icon: Icon, on, count }) => (
          <Link
            key={to}
            to={to}
            replace
            role="tab"
            aria-selected={on}
            ref={on ? activeRef : undefined}
            className={`flex min-w-[76px] shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-colors ${
              on ? 'bg-[#0A573B] text-white shadow-[0_2px_8px_rgba(10,87,59,0.3)]' : 'text-[#5B625E] active:bg-[#F2F4F2]'
            }`}
          >
            <span className="relative">
              <Icon className="h-[18px] w-[18px]" />
              {count > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap text-[12px] font-semibold leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

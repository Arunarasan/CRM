import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useT } from '@/i18n';
import { REQUEST_ITEMS } from './RequestsTabs';

/**
 * Requests hub — the "Requests" bottom-nav tab. A launchpad for every self-service request an
 * employee can raise; the tab bar above it (RequestsTabs) is rendered by MobileLayout.
 */
const ITEMS = REQUEST_ITEMS.map((i) => ({ ...i, soon: false }));

export default function Requests() {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <h1 className="text-lg font-bold leading-tight">{t('pw.requests.title')}</h1>
        <p className="text-xs text-muted-foreground">{t('pw.requests.subtitle')}</p>
      </div>

      <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {ITEMS.map(({ to, labelKey, hintKey, icon: Icon, color, soon }) => (
          <button
            key={to}
            disabled={soon}
            onClick={() => !soon && navigate(to)}
            className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${soon ? 'opacity-60' : 'active:bg-accent/40'}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-accent/50 ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold">{t(labelKey)}</span>
                {soon && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {t('pw.requests.soon')}
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{t(hintKey)}</span>
            </span>
            {!soon && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        ))}
      </div>
    </div>
  );
}

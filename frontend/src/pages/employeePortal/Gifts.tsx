import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Sparkles } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import type { Celebration, MyCelebrations } from '@/types/employeePortal';
import { useT, dateLocale } from '@/i18n';
import { EmptyState, inr } from './_shared';

/** First letter capital, the rest as written (so "Salary for 10/2026" stays as is). */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const CONFETTI = ['#D7AA4A', '#F4E5C2', '#2F8F65', '#FFFFFF', '#C48A16', '#8FD0AE'];

/** The celebration shown when a gift is opened: confetti, the gift, the amount and any HR message. */
function Celebrate({ gift, name, onClose }: { gift: Celebration; name: string; onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#012B1D] to-[#06452F] px-6" role="dialog" aria-modal="true">
      <style>{`
        @keyframes gift-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9 } }
        @keyframes gift-pop { 0% { transform: scale(.3) rotate(-12deg); opacity: 0 } 60% { transform: scale(1.15) rotate(4deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
        @keyframes gift-rise { 0% { transform: translateY(14px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .gift-confetti { display: none } .gift-anim { animation: none !important; opacity: 1 !important } }
      `}</style>
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className="gift-confetti pointer-events-none absolute top-0 block h-2.5 w-1.5 rounded-[1px]"
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI[i % CONFETTI.length],
            animation: `gift-fall ${2.6 + (i % 5) * 0.45}s linear ${(i % 9) * 0.13}s infinite`,
          }}
        />
      ))}
      <div className="relative z-10 w-full max-w-sm text-center text-white">
        <div className="gift-anim mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#D7AA4A] text-[#012B1D] shadow-lg" style={{ animation: 'gift-pop .7s ease-out both' }}>
          <Gift className="h-12 w-12" />
        </div>
        <h2 className="gift-anim mt-6 text-2xl font-bold" style={{ animation: 'gift-rise .6s ease-out .35s both' }}>{t('pw.gifts.congrats', { name })}</h2>
        <p className="gift-anim mt-2 text-sm text-white/75" style={{ animation: 'gift-rise .6s ease-out .5s both' }}>{t('pw.gifts.youGot')}</p>
        <p className="gift-anim mt-1 text-5xl font-extrabold text-[#F4E5C2]" style={{ animation: 'gift-rise .6s ease-out .65s both' }}>{inr(gift.amount)}</p>
        <p className="gift-anim mt-2 text-base font-medium" style={{ animation: 'gift-rise .6s ease-out .8s both' }}>{cap(gift.title)}</p>
        {gift.note && (
          <p className="gift-anim mx-auto mt-4 max-w-xs rounded-xl bg-white/10 px-4 py-3 text-sm italic text-white/90" style={{ animation: 'gift-rise .6s ease-out .95s both' }}>
            “{gift.note}”
          </p>
        )}
        <button onClick={onClose} className="mt-8 w-full rounded-xl bg-[#D7AA4A] py-3 text-sm font-bold text-[#012B1D] active:scale-[0.98]">
          {t('pw.gifts.awesome')}
        </button>
      </div>
    </div>
  );
}

export default function Gifts() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [data, setData] = useState<MyCelebrations | null>(null);
  const [name, setName] = useState('');
  const [playing, setPlaying] = useState<Celebration | null>(null);

  const load = useCallback(() => {
    employeePortalApi.celebrations().then(setData).catch(() => setData({ items: [], unopened: 0, monthTotal: 0 }));
  }, []);
  useEffect(() => {
    load();
    employeePortalApi.me().then((p) => setName(p.firstName ?? '')).catch(() => {});
  }, [load]);

  const open = (g: Celebration) => {
    if (g.opened) { navigate('/employee/salary'); return; }
    setPlaying(g);
    employeePortalApi.openCelebration(g.id).then(() => { load(); window.dispatchEvent(new Event('gifts-changed')); }).catch(() => {});
  };
  const date = (d: string) => new Date(d).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col pb-4">
      <div className="px-4 pb-1 pt-4">
        <h1 className="text-lg font-semibold">{t('pw.gifts.title')}</h1>
      </div>

      {data && data.monthTotal > 0 && (
        <div className="mx-3 mt-2 rounded-2xl bg-gradient-to-br from-[#012B1D] to-[#0A573B] p-4 text-white shadow-sm">
          <p className="text-xs text-white/70">{t('pw.gifts.thisMonth')}</p>
          <p className="mt-0.5 flex items-center gap-2 text-3xl font-extrabold text-[#F4E5C2]"><Sparkles className="h-6 w-6 text-[#D7AA4A]" />{inr(data.monthTotal)}</p>
        </div>
      )}

      {data && data.unopened > 1 && (
        <div className="mx-3 mt-3 flex items-center justify-between rounded-xl border border-[#D7AA4A]/50 bg-[#FBF3DF] px-3 py-2 text-xs font-medium text-[#7A5410]">
          <span>{t('pw.gifts.newCount', { n: data.unopened })}</span>
          <button onClick={() => employeePortalApi.openAllCelebrations().then(() => { load(); window.dispatchEvent(new Event('gifts-changed')); })} className="rounded-lg bg-[#C48A16] px-2.5 py-1 font-semibold text-white active:scale-95">{t('pw.gifts.openAll')}</button>
        </div>
      )}

      <div className="mx-3 mt-3 flex flex-col gap-2">
        {data && data.items.length === 0 && <EmptyState message={t('pw.gifts.empty')} />}
        {data?.items.map((g) => g.opened ? (
          <button key={g.id} onClick={() => open(g)} className="flex items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm active:bg-accent">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FBF3DF] text-[#C48A16]"><Gift className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{cap(g.title)}</span>
              <span className="block truncate text-xs text-muted-foreground">{g.note ? `${g.note} · ` : ''}{date(g.rewardDate)}</span>
            </span>
            <span className="shrink-0 text-sm font-bold text-emerald-700">{inr(g.amount)}</span>
          </button>
        ) : (
          <button key={g.id} onClick={() => open(g)} className="flex items-center gap-3 rounded-2xl border-2 border-[#D7AA4A] bg-gradient-to-r from-[#FBF3DF] to-white p-3 text-left shadow-sm active:scale-[0.99]">
            <span className="flex h-11 w-11 shrink-0 animate-bounce items-center justify-center rounded-full bg-[#D7AA4A] text-[#012B1D] motion-reduce:animate-none"><Gift className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#7A5410]">{t('pw.gifts.tapOpen')}</span>
              <span className="block text-xs text-muted-foreground">{date(g.rewardDate)}</span>
            </span>
            <span className="shrink-0 rounded-full bg-[#C48A16] px-2 py-0.5 text-[10px] font-bold uppercase text-white">{t('pw.gifts.new')}</span>
          </button>
        ))}
      </div>

      {playing && <Celebrate gift={playing} name={name || ''} onClose={() => setPlaying(null)} />}
    </div>
  );
}

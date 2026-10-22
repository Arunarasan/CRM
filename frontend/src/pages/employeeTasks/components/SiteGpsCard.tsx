import { useState } from 'react';
import { Crosshair, Loader2, MapPin, Navigation } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { getBestPosition, locationErrorMessage, reverseGeocode } from '@/lib/geo';
import { MapThumb, parseCoords } from './RequirementTaskView';
import { useT } from '@/i18n';

/**
 * The site's GPS pin on the Site Visit, Measure & Quote part: a map thumbnail, Navigate, and "Set GPS" which
 * saves the employee's live position as the lead's map pin (the same call the Collect Requirement page uses).
 * `taskId` is a task on the lead the employee holds; without one the buttons ask them to take a task first.
 */
export default function SiteGpsCard({ lead, taskId, onSaved }: { lead: any; taskId?: number | null; onSaved: () => void }) {
  const { t } = useT();
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState('');
  const coords = parseCoords(lead?.googleMapLocation);
  const addr = [lead?.address, lead?.city].filter((x) => x && String(x).trim()).join(', ');
  const navHref = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    : addr ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) : null;

  const setGps = async () => {
    if (!taskId) { setErr(t('pw.rt.takeFirst')); return; }
    setErr('');
    setLocating(true);
    try {
      const fix = await getBestPosition({ targetAccuracyM: 25, maxWaitMs: 15000 });
      if (!fix) { setErr(await locationErrorMessage()); return; }
      const a = await reverseGeocode(fix.lat, fix.lng);
      await employeeTaskApi.saveSiteLocation(taskId, { latitude: fix.lat, longitude: fix.lng, ...a });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message || t('pw.rt.saveLocFailed'));
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#ECEAE5] bg-white p-2 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
      <div className="flex gap-2 rounded-xl bg-[#EEF5F0] p-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D9EBDF] text-[#0A573B]">
              <MapPin className="h-4 w-4 fill-current text-[#0A573B]" />
            </span>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-[#0A573B]">{t('pw.rt.siteLocation')}</p>
              {addr ? <p className="truncate text-[13.5px] font-semibold text-[#1A211E]">{addr}</p>
                : <p className="text-[12.5px] text-[#7A817C]">{coords ? t('pw.rt.pinned') : t('pw.rt.noAddress')}</p>}
            </div>
          </div>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {navHref && (
              <a href={navHref} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#0A573B] px-3 py-2.5 text-[13px] font-semibold text-white active:scale-[0.98]">
                <Navigation className="h-4 w-4" /> {t('pw.rt.navigate')}
              </a>
            )}
            <button type="button" onClick={setGps} disabled={locating}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#0A573B]/30 bg-white px-3 py-2 text-[12.5px] font-semibold text-[#0A573B] active:scale-[0.98] disabled:opacity-60">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              {locating ? t('pw.rt.gettingGps') : coords ? t('pw.rt.rePin') : t('pw.rt.setGps')}
            </button>
          </div>
        </div>
        <div className="w-[38%] shrink-0 overflow-hidden rounded-xl ring-1 ring-[#D9E4DC]">
          {coords ? (
            <a href={navHref ?? undefined} target="_blank" rel="noopener noreferrer" className="block h-full min-h-[110px]">
              <MapThumb lat={coords.lat} lng={coords.lng} />
            </a>
          ) : (
            <div className="flex h-full min-h-[110px] flex-col items-center justify-center gap-1 bg-[#F4F6F3] px-2 text-center text-[10.5px] text-[#8A918C]">
              <MapPin className="h-5 w-5 text-[#B9C0BB]" /> {t('pw.rt.noPin')}
            </div>
          )}
        </div>
      </div>
      {err && <p className="mt-1.5 rounded-lg bg-[#FBE7E4] px-2.5 py-2 text-[12px] text-[#B94B45]">{err}</p>}
    </div>
  );
}

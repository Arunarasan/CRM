import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ClipboardList, FileText, History, Image as ImageIcon, LayoutGrid, MessageCircle, Mic,
  Navigation, Pencil, Phone,
} from 'lucide-react';
import api from '@/lib/api';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import AudioPlayer from '@/components/AudioPlayer';
import { leadApi } from '../leads/leadApi';
import type { TaskCard, TaskDetail as TaskDetailType } from '@/types/employeeTask';
import TaskDetail, { LeadDetailsCard } from './TaskDetail';
import { EmployeeQuoteBody, SitePhotosCard } from './EmployeeQuote';
import LeadPhotosCard from './components/LeadPhotosCard';
import RequirementFormSheet from './components/RequirementFormSheet';
import { toast } from '@/components/ui/toast';
import { statusMeta, REQUIREMENT_CODES, inLeadWorkspace } from './taskUtils';
import { useT, dateLocale, currentLang } from '@/i18n';

/**
 * One screen per lead for the field employee, laid out like the office's lead page: a pinned header
 * (customer, call / WhatsApp / navigate, Requirement → Measure & Quote → Project) over tabs.
 * The lead's tasks are still separate workflow tasks underneath — Collect Requirement, then Site Visit,
 * Measure & Quote — so every rule about when a task shows, holds or closes is unchanged. The Work tab
 * shows both on ONE page: the requirement (editable any time while a task is held) above the quote sheet.
 */

type WsTab = 'overview' | 'work' | 'documents' | 'activity';
const TABS: { key: WsTab; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', icon: LayoutGrid },
  { key: 'work', icon: ClipboardList },
  { key: 'documents', icon: ImageIcon },
  { key: 'activity', icon: History },
];


const lifecycleOf = (t: TaskCard) =>
  t.lifecycle ?? (t.status === 'COMPLETED' ? 'DONE' : t.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE');
const isReq = (t: TaskCard) => REQUIREMENT_CODES.includes((t.taskTypeCode ?? '').toUpperCase());
const gone = (s?: string) => s === 'CANCELLED' || s === 'REJECTED';

/** The task to show for one stage: the one asked for, else my live one, else an open pool one, else my latest. */
function pickTask(list: TaskCard[], wanted: number | null): TaskCard | null {
  if (!list.length) return null;
  const asked = wanted != null ? list.find((t) => t.id === wanted) : undefined;
  if (asked) return asked;
  const rank = (t: TaskCard) => {
    const mine = t.myAssignmentStatus && !gone(t.myAssignmentStatus);
    const life = lifecycleOf(t);
    if (mine && life === 'ACTIVE') return 0;
    if (!mine && life === 'ACTIVE') return 1;
    if (life === 'SUBMITTED') return 2;
    if (life === 'DONE') return 3;
    return 4;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || b.id - a.id)[0];
}

const has = (v: unknown) => v != null && String(v).trim() !== '';
const digits = (s?: string | null) => (s || '').replace(/[^\d+]/g, '');

function navigateHref(lead: any): string | null {
  const g = lead?.googleMapLocation as string | undefined;
  const m = g?.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (m) return `https://www.google.com/maps/dir/?api=1&destination=${m[1]},${m[2]}`;
  if (g && g.startsWith('http')) return g;
  const addr = [lead?.address, lead?.city, lead?.state, lead?.pincode].filter(has).join(', ');
  return addr ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) : null;
}

export default function EmployeeLeadWorkspace() {
  const { t } = useT();
  const navigate = useNavigate();
  const { leadId: rawId } = useParams<{ leadId: string }>();
  const leadId = Number(rawId);
  const [params, setParams] = useSearchParams();
  const wantedTask = params.get('task') ? Number(params.get('task')) : null;

  const [lead, setLead] = useState<any>(null);
  const [leadFailed, setLeadFailed] = useState(false);
  const [tasks, setTasks] = useState<TaskCard[] | null>(null);
  const [info, setInfo] = useState<TaskDetailType | null>(null);
  const [photosKey, setPhotosKey] = useState(0);
  const [taking, setTaking] = useState(false);
  const [editReq, setEditReq] = useState(false);
  const tookRef = useRef<number | null>(null);

  const loadLead = useCallback(() => {
    api.get(`/leads/${leadId}`).then((r) => setLead(r.data)).catch(() => setLeadFailed(true));
  }, [leadId]);

  // This lead's tasks — mine (any state) plus the ones still open to pick.
  const loadTasks = useCallback(() => {
    Promise.allSettled([employeeTaskApi.myTasks(), employeeTaskApi.pool()]).then(([m, p]) => {
      const mine = m.status === 'fulfilled' ? m.value : [];
      const pool = p.status === 'fulfilled' ? p.value : [];
      const seen = new Set<number>();
      setTasks([...mine, ...pool].filter((x) => {
        if (x.leadId !== leadId || seen.has(x.id)) return false;
        seen.add(x.id);
        return inLeadWorkspace(x);
      }));
    });
  }, [leadId]);

  useEffect(() => { loadLead(); loadTasks(); }, [loadLead, loadTasks]);

  const reqTask = useMemo(() => pickTask((tasks ?? []).filter(isReq), wantedTask), [tasks, wantedTask]);
  const quoteTask = useMemo(() => pickTask((tasks ?? []).filter((x) => !isReq(x)), wantedTask), [tasks, wantedTask]);

  // The captured lead (contacts, media, property…) comes with any of its task details.
  const infoTaskId = reqTask?.id ?? quoteTask?.id ?? null;
  useEffect(() => {
    if (infoTaskId == null) return;
    employeeTaskApi.detail(infoTaskId).then(setInfo).catch(() => {});
  }, [infoTaskId, photosKey]);

  const converted = !!lead?.isConverted;
  const reqDone = !!reqTask && ['DONE', 'SUBMITTED'].includes(lifecycleOf(reqTask));
  const quoteDone = converted || (!!quoteTask && ['DONE', 'SUBMITTED'].includes(lifecycleOf(quoteTask)));
  const steps = [
    { key: 'requirement' as const, label: t('pw.lw.tab.requirement'), done: reqDone || !!quoteTask || converted },
    { key: 'quote' as const, label: t('pw.lw.tab.quote'), done: quoteDone },
    { key: 'project' as const, label: t('pw.lw.step.project'), done: converted },
  ];
  const current = steps.find((s) => !s.done)?.key ?? 'project';

  // Older ?tab=requirement / ?tab=quote links open the combined Work tab.
  const rawParam = params.get('tab');
  const rawTab = (rawParam === 'requirement' || rawParam === 'quote' ? 'work' : rawParam) as WsTab | null;
  const tab: WsTab = rawTab && TABS.some((x) => x.key === rawTab) ? rawTab
    : reqTask || quoteTask ? 'work' : 'overview';
  const setTab = (k: WsTab) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', k); return n; }, { replace: true });

  // Opening the Work tab takes a still-open quote task, as tapping the task always did.
  useEffect(() => {
    if (tab !== 'work' || !quoteTask || tookRef.current === quoteTask.id) return;
    const open = (quoteTask.status as string) === 'AVAILABLE' && (!quoteTask.myAssignmentStatus || gone(quoteTask.myAssignmentStatus));
    if (!open) return;
    tookRef.current = quoteTask.id;
    setTaking(true);
    employeeTaskApi.pick(quoteTask.id).catch(() => { /* not clocked in / taken — the sheet still opens */ })
      .finally(() => { setTaking(false); loadTasks(); });
  }, [tab, quoteTask, loadTasks]);

  if (!leadId) return <p className="p-6 text-center text-sm text-muted-foreground">{t('pw.lw.notFound')}</p>;
  if (leadFailed && !info?.lead) return <p className="p-6 text-center text-sm text-muted-foreground">{t('pw.lw.notFound')}</p>;
  if (!lead && !info?.lead) return <p className="p-6 text-center text-sm text-muted-foreground">{t('pw.lw.loading')}</p>;

  const who: any = { ...(info?.lead ?? {}), ...(lead ?? {}) };
  const name = has(who.contactPerson) ? String(who.contactPerson) : (who.name || t('pw.ld.customer'));
  const phone = who.mobileNumber || who.alternateMobile || who.whatsappNumber;
  const wa = who.whatsappNumber || phone;
  const nav = navigateHref(who);
  const place = [who.address, who.city].filter(has).join(', ');
  const chips = String(who.requirementProduct || who.requirementCategory || '').split(',').map((x) => x.trim()).filter(Boolean);
  const stageTask = current === 'requirement' ? reqTask : quoteTask;
  const status = converted ? { label: t('pw.lw.converted'), cls: 'bg-[#E6F2EC] text-[#0A573B]' }
    : stageTask ? statusMeta(stageTask.status) : null;
  const holder = [reqTask, quoteTask].find((x) => x && x.myAssignmentStatus && !gone(x.myAssignmentStatus) && lifecycleOf(x) === 'ACTIVE');
  const roundBtn = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E4E2DC] bg-white text-[#0A573B] active:bg-[#F1F3F1]';
  const narrow = 'mx-auto w-full max-w-3xl';

  return (
    <div className="flex flex-col bg-[#FAF8F3]">
      {/* Pinned header: who · reach them · where the lead stands · tabs */}
      <div className="sticky top-0 z-10 border-b border-[#EEE7DA] bg-[#FAF8F3]/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1600px] px-3 pt-2.5 md:px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/employee/tasks?tab=LEADS'))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full active:bg-black/5" aria-label={t('pw.back')}>
              <ArrowLeft className="h-5 w-5 text-[#22271F]" />
            </button>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A573B] text-[15px] font-bold text-white">
              {String(name).trim().charAt(0).toUpperCase() || '?'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <h1 className="truncate text-[16px] font-bold text-[#1A211E]">{name}</h1>
                {status && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.cls}`}>{status.label}</span>}
              </div>
              <p className="truncate text-[12px] text-[#7A817C]">{[who.leadNumber, place].filter(has).join(' · ')}</p>
            </div>
            {phone && <a href={'tel:' + digits(phone)} className={roundBtn} aria-label={t('pw.ld.callName', { name })}><Phone className="h-4 w-4" /></a>}
            {wa && (
              <a href={'https://wa.me/' + digits(wa).replace('+', '')} target="_blank" rel="noopener noreferrer" className={roundBtn} aria-label={t('pw.ld.whatsapp')}>
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            {nav && (
              <a href={nav} target="_blank" rel="noopener noreferrer" className={`${roundBtn} max-[359px]:hidden`} aria-label={t('pw.ld.navigate')}>
                <Navigation className="h-4 w-4" />
              </a>
            )}
          </div>

          {chips.length > 0 && (
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto pl-11 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map((c) => (
                <span key={c} className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-semibold text-[#9B6B32] ring-1 ring-[#E4D8BF]">{c}</span>
              ))}
            </div>
          )}

          {/* Requirement → Measure & Quote → Project */}
          <ol className="mt-2.5 flex items-center gap-1">
            {steps.map((s, i) => {
              const now = s.key === current && !s.done;
              return (
                <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1">
                  <button type="button" disabled={s.key === 'project'} onClick={() => s.key !== 'project' && setTab('work')}
                    className="flex min-w-0 items-center gap-1.5 text-left">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      s.done ? 'bg-[#0A573B] text-white' : now ? 'bg-[#BC8748] text-white' : 'bg-[#E9E6DD] text-[#8A8F86]'}`}>
                      {s.done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={`truncate text-[12px] ${now ? 'font-bold text-[#1A211E]' : s.done ? 'font-medium text-[#0A573B]' : 'text-[#8A8F86]'}`}>{s.label}</span>
                  </button>
                  {i < steps.length - 1 && <span className={`h-px min-w-3 flex-1 ${s.done ? 'bg-[#0A573B]/50' : 'bg-[#E1DDD2]'}`} />}
                </li>
              );
            })}
          </ol>

          <div role="tablist" aria-label={t('pw.lw.sectionsAria')}
            className="-mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ key, icon: Icon }) => {
              const on = key === tab;
              return (
                <button key={key} type="button" role="tab" aria-selected={on} onClick={() => setTab(key)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    on ? 'bg-[#0A573B] text-white shadow-[0_2px_8px_rgba(10,87,59,0.25)]' : 'border border-[#E3E5E1] bg-white text-[#5B625E]'}`}>
                  <Icon className="h-4 w-4" /> {t(`pw.lw.tab.${key}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {tab === 'overview' && (
        <div className={`${narrow} flex flex-col gap-3 p-3 pb-24 md:p-4`}>
          {info?.lead ? <LeadDetailsCard lead={info.lead} /> : <LeadDetailsCard lead={who} />}
        </div>
      )}

      {tab === 'work' && (
        tasks === null || taking ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{taking ? t('pw.lw.taking') : t('pw.lw.loading')}</p>
        ) : (
          <div className="flex flex-col">
            {/* Requirement: the full Collect Requirement task while it is the live step; afterwards a summary
                that can still be edited for as long as a task on the lead is held. */}
            {reqTask && lifecycleOf(reqTask) === 'ACTIVE' && !quoteTask && !converted ? (
              <div className={`${narrow} w-full px-3 md:px-4`}>
                <TaskDetail key={reqTask.id} embeddedTaskId={reqTask.id} onChanged={loadTasks} />
              </div>
            ) : (
              <div className={`${narrow} w-full px-3 pt-3 md:px-4`}>
                <RequirementSummary who={who} canEdit={!!holder} onEdit={() => setEditReq(true)} />
              </div>
            )}
            {quoteTask || converted ? (
              <EmployeeQuoteBody leadId={leadId} onPhotosChanged={() => setPhotosKey((k) => k + 1)} />
            ) : !reqTask ? (
              <div className={`${narrow} w-full p-3 md:p-4`}><Note>{t('pw.lw.reqNone')}</Note></div>
            ) : null}
          </div>
        )
      )}

      {tab === 'documents' && (
        <div className={`${narrow} flex flex-col gap-3 p-3 pb-24 md:p-4`}>
          {holder && (
            <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
              <p className="mb-2 text-sm font-semibold text-[#111817]">{t('pw.lw.addPhotos')}</p>
              <LeadPhotosCard key={`${holder.id}-${photosKey}`} taskId={holder.id} canEdit embedded />
            </div>
          )}
          <SitePhotosCard leadId={leadId} refreshKey={photosKey} />
          <CapturedMedia media={info?.lead?.media ?? []} />
        </div>
      )}

      {tab === 'activity' && (
        <div className={`${narrow} p-3 pb-24 md:p-4`}>
          <ActivityList leadId={leadId} taskIds={[reqTask?.id, quoteTask?.id].filter((x): x is number => x != null)} />
        </div>
      )}
      <RequirementFormSheet taskId={holder?.id ?? 0} leadId={leadId} detailsOnly open={editReq} onOpenChange={setEditReq}
        onSaved={() => setEditReq(false)}
        onDetailsSaved={() => { toast.success(t('pw.td.lead_details_saved')); loadLead(); setPhotosKey((k) => k + 1); }} />
    </div>
  );
}

/** What the customer asked for, in brief, with an Edit button that works while a task on the lead is held. */
function RequirementSummary({ who, canEdit, onEdit }: { who: any; canEdit: boolean; onEdit: () => void }) {
  const { t } = useT();
  const list = (v?: string | null) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const cats = list(who.requirementCategory);
  const prods = list(who.requirementProduct);
  const budget = who.estimatedBudget ? '₹' + Number(who.estimatedBudget).toLocaleString('en-IN') : null;
  const rows = ([
    [t('pw.ld.rooms'), who.roomsRequired],
    [t('pw.ld.requirement'), who.projectDescription || who.customerRequirements],
    [t('pw.td.budget'), budget],
  ] as [string, unknown][]).filter(([, v]) => has(v));
  return (
    <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[#0A573B]" />
        <p className="flex-1 text-sm font-semibold text-[#111817]">{t('pw.lw.tab.requirement')}</p>
        {canEdit && (
          <button type="button" onClick={onEdit}
            className="flex items-center gap-1.5 rounded-full border border-[#0A573B]/30 bg-[#F3F8F5] px-3 py-1.5 text-[12.5px] font-semibold text-[#0A573B] active:scale-95">
            <Pencil className="h-3.5 w-3.5" /> {t('pw.lw.editRequirement')}
          </button>
        )}
      </div>
      {(cats.length > 0 || prods.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...cats, ...prods].map((c) => (
            <span key={c} className="rounded-full bg-[#F7F4EC] px-2.5 py-1 text-[12px] font-semibold text-[#9B6B32] ring-1 ring-[#E4D8BF]">{c}</span>
          ))}
        </div>
      )}
      {rows.map(([label, v]) => (
        <p key={label} className="mt-2 text-[13px] text-[#33392F]">
          <span className="mr-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#7A817C]">{label}</span>{String(v)}
        </p>
      ))}
      {!cats.length && !prods.length && !rows.length && <p className="mt-2 text-[13px] text-[#7A817C]">{t('pw.lw.noRequirementYet')}</p>}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-[#DBE7DF] bg-[#EFF5F0] p-3.5 text-[13px] leading-relaxed text-[#2C5C45]">{children}</p>;
}

/** Photos, voice notes and files captured when the lead was added. */
function CapturedMedia({ media }: { media: { kind: string; fileUrl: string; fileName?: string | null }[] }) {
  const { t } = useT();
  if (!media.length) return null;
  const images = media.filter((m) => m.kind === 'IMAGE');
  const audios = media.filter((m) => m.kind === 'AUDIO');
  const others = media.filter((m) => m.kind !== 'IMAGE' && m.kind !== 'AUDIO');
  return (
    <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
      <p className="mb-2 text-sm font-semibold text-[#111817]">{t('pw.lw.capturedMedia')}</p>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((m, i) => (
            <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noopener noreferrer">
              <img src={resolveFileUrl(m.fileUrl)} alt={m.fileName || ''} loading="lazy" className="h-20 w-20 rounded-lg object-cover ring-1 ring-[#E4DECF]" />
            </a>
          ))}
        </div>
      )}
      {audios.map((m, i) => (
        <div key={i} className="mt-2 flex items-center gap-2 rounded-lg bg-[#FBFAF6] px-2.5 py-2 ring-1 ring-[#EFE9DC]">
          <Mic className="h-4 w-4 shrink-0 text-[#9B6B32]" />
          <AudioPlayer src={resolveFileUrl(m.fileUrl)} className="w-full" />
        </div>
      ))}
      {others.map((m, i) => (
        <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-[#0A573B]">
          <FileText className="h-3.5 w-3.5" /> {m.fileName || 'File'}
        </a>
      ))}
    </div>
  );
}

type Ev = { at: string; title: string; body?: string | null; audio?: string | null; task?: string };

/** Everything that happened on the lead's tasks and site visits, newest first. */
function ActivityList({ leadId, taskIds }: { leadId: number; taskIds: number[] }) {
  const { t } = useT();
  const loc = dateLocale(currentLang());
  const [events, setEvents] = useState<Ev[] | null>(null);
  const key = taskIds.join(',');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [details, visits] = await Promise.all([
        Promise.all(taskIds.map((id) => employeeTaskApi.detail(id).catch(() => null))),
        leadApi.getSiteVisits(leadId).then((r) => (r.data || []) as any[]).catch(() => [] as any[]),
      ]);
      const out: Ev[] = [];
      for (const d of details) {
        if (!d) continue;
        for (const m of d.team) {
          if (m.assignedDate) out.push({ at: m.assignedDate, title: t('pw.lw.ev.assigned', { name: m.employeeName }), task: d.taskName });
          if (m.startedAt) out.push({ at: m.startedAt, title: t('pw.lw.ev.started', { name: m.employeeName }), task: d.taskName });
          if (m.completedAt) out.push({ at: m.completedAt, title: t('pw.lw.ev.completed', { name: m.employeeName }), task: d.taskName });
        }
        for (const p of d.progress) {
          out.push({ at: p.createdAt, title: p.progressPercent != null ? t('pw.lw.ev.progress', { name: p.employeeName ?? '', p: p.progressPercent }) : (p.employeeName ?? ''),
            body: p.remarks, task: d.taskName });
        }
        for (const c of d.comments) {
          out.push({ at: c.createdAt, title: c.authorName ?? '', body: c.content === '🎤 Voice note' ? null : c.content, audio: c.audioUrl, task: d.taskName });
        }
      }
      for (const v of visits) {
        const done = String(v.status || '').toUpperCase() === 'COMPLETED';
        const at = v.actualEndTime || v.scheduledDate || v.createdAt;
        if (at) out.push({ at, title: done ? t('pw.lw.ev.visitDone') : t('pw.lw.ev.visit'), body: v.nextActionNotes || v.purpose });
      }
      out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      if (alive) setEvents(out);
    })();
    return () => { alive = false; };
  }, [leadId, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (events === null) return <p className="p-6 text-center text-sm text-muted-foreground">{t('pw.lw.loading')}</p>;
  if (!events.length) return <Note>{t('pw.lw.noActivity')}</Note>;
  return (
    <ol className="relative flex flex-col gap-3 border-l border-[#E1DDD2] pl-4">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#0A573B] ring-2 ring-[#FAF8F3]" />
          <div className="rounded-xl border border-[#ECEAE5] bg-white px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-[13px] font-semibold text-[#1A211E]">{e.title}</p>
              <span className="shrink-0 text-[11px] text-[#9A9E96]">
                {new Date(e.at).toLocaleString(loc, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
            {e.task && <p className="text-[11px] text-[#8A8F86]">{e.task}</p>}
            {e.body && <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#33392F]">{e.body}</p>}
            {e.audio && <AudioPlayer src={resolveFileUrl(e.audio)} className="mt-1.5 w-full max-w-[260px]" />}
          </div>
        </li>
      ))}
    </ol>
  );
}

import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Camera, AlertTriangle, Package, Play, Pause, CheckCircle2, ThumbsUp,
  Navigation, ChevronDown, UserPlus, ClipboardList, ClipboardCheck, MapPin, Image as ImageIcon,
  Users, MessageSquare, Phone, MessageCircle, Star, Home, Wallet, FileText, UserCircle, Mic, CalendarDays, Building2,
} from 'lucide-react';
import api from '@/lib/api';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import TaskTeamPanel from './components/TaskTeamPanel';
import CancelTaskButton from './components/CancelTaskButton';
import { TaskDetail as TaskDetailType, LeadInfo } from '@/types/employeeTask';
import { resolveFileUrl } from '@/lib/uploadFile';
import AudioCaptureField, { CapturedAudio } from '@/components/AudioCaptureField';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import ChecklistPanel from './components/ChecklistPanel';
import CheckInBar from './components/CheckInBar';
import ProgressSheet from './components/ProgressSheet';
import IssueReportSheet from './components/IssueReportSheet';
import MaterialUsageSheet from './components/MaterialUsageSheet';
import LeadTaskFormSheet from './components/LeadTaskFormSheet';
import RequirementFormSheet from './components/RequirementFormSheet';
import RequirementSummaryCard from './components/RequirementSummaryCard';
import { toast } from '@/components/ui/toast';
import LeadPhotosCard from './components/LeadPhotosCard';
import RequirementTaskView from './components/RequirementTaskView';
import { ItemsToMakeCard, ProjectTaskHero } from './components/ProjectTaskLayout';
import ProjectWorkTaskView, { WorkTab } from '@/components/projectWork/ProjectWorkTaskView';
import CompleteSheet from './components/CompleteSheet';
import CallLeadPanel from '@/components/callRecordings/CallLeadPanel';
import { callRecordingApi, type CallRecording } from '@/api/callRecordingApi';
import CollectPaymentSheet from './components/CollectPaymentSheet';
import MarkInstalledSheet, { InstallOrderCard } from './components/MarkInstalledSheet';
import PaymentBox from './components/PaymentBox';
import ShareQuotationCard from './components/ShareQuotationCard';
import CustomerContactCard from './components/CustomerContactCard';
import TimeTracker from './components/TimeTracker';
import HoldTimer from './components/HoldTimer';
import { formatTime } from '@/pages/leads/constants';
import { humanizeDue, dueToneClass, priorityMeta, statusMeta } from './taskUtils';
import AudioPlayer from "@/components/AudioPlayer";
import OrderTaskView from './components/OrderTaskView';
import InstallTaskView from './components/InstallTaskView';
import OrderStepSheet from './components/OrderStepSheet';
import { stepLabel } from './components/OrderTaskView';
import { useT, useTr, rich, dateLocale, currentLang } from '@/i18n';

/** A quiet disclosure row — keeps history/team/notes tucked away until wanted. Designed to sit
 *  inside a grouped card with `divide-y`, so it carries no border of its own (spec §6). */
function Disclosure({ title, count, meta, icon, children, defaultOpen = false }: {
  title: string; count?: number; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
  /** Always-on hint pill (e.g. "0 photos") — replaces the count pill when given. */
  meta?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        {icon && <span className="text-[#9B6B32]">{icon}</span>}
        <span className="flex-1 text-[14px] font-medium text-[#22271F]">{title}</span>
        {meta ? (
          <span className="rounded-full bg-[#F6F3EC] px-2 py-0.5 text-[11px] text-[#8A8F86]">{meta}</span>
        ) : count != null && count > 0 && (
          <span className="rounded-full bg-[#F3EEE2] px-2 py-0.5 text-[11px] font-medium text-[#8A6A2E]">{count}</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#B4B0A4] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-0.5">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Lead details (read-only) */

const has = (v: unknown) => v != null && String(v).trim() !== '';
const telHref = (s?: string | null) => 'tel:' + (s || '').replace(/[^\d+]/g, '');
const waHref = (s?: string | null) => 'https://wa.me/' + (s || '').replace(/[^\d]/g, '');
const money = (v: unknown) => (has(v) ? '₹' + Number(v).toLocaleString('en-IN') : null);
const mapsSearch = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const fmtDate = (s?: string | null) =>
  has(s) ? new Date(s as string).toLocaleDateString(dateLocale(currentLang()), { day: 'numeric', month: 'short', year: 'numeric' }) : null;

/** A labelled read-only value; renders nothing when empty so the card never shows blank rows. */
function LField({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#A6A99E]">{label}</span>
      <span className="whitespace-pre-wrap break-words text-[13.5px] leading-snug text-[#33392F]">{value}</span>
    </div>
  );
}

/**
 * The original lead as it was captured — shown on lead-workflow tasks so a field employee knows who the
 * customer is and what they asked for before collecting/confirming the requirement. Read-only; the
 * "what they want" block is open by default, the rest tucked into quiet disclosures.
 */
export function LeadDetailsCard({ lead, extrasOnly = false }: { lead: LeadInfo; extrasOnly?: boolean }) {
  const { t } = useT();
  const phone = lead.mobileNumber || lead.alternateMobile || lead.whatsappNumber;
  const wa = lead.whatsappNumber || lead.mobileNumber;
  const budget =
    money(lead.estimatedBudget) ||
    (has(lead.minimumBudget) || has(lead.maximumBudget)
      ? [money(lead.minimumBudget), money(lead.maximumBudget)].filter(Boolean).join(' – ')
      : null);
  const description = lead.projectDescription || lead.customerRequirements;
  const finish = [lead.preferredDesignStyle, lead.preferredMaterial, lead.preferredColorTheme].filter(has).join(' · ');
  const timeline = [
    fmtDate(lead.expectedStartDate) && t('pw.td.startOn', { d: fmtDate(lead.expectedStartDate) ?? '' }),
    fmtDate(lead.preferredCompletionDate) && t('pw.td.targetOn', { d: fmtDate(lead.preferredCompletionDate) ?? '' }),
    lead.estimatedDuration,
  ].filter(Boolean).join(' · ');
  const addr = [lead.address, lead.city, lead.district, lead.state, lead.pincode].filter(has).join(', ');
  const mapHref = has(lead.googleMapLocation)
    ? ((lead.googleMapLocation as string).startsWith('http') ? (lead.googleMapLocation as string) : mapsSearch(lead.googleMapLocation as string))
    : (has(addr) ? mapsSearch(addr) : null);
  const rating = Number(lead.rating) || 0;
  const media = lead.media || [];
  const images = media.filter((m) => m.kind === 'IMAGE');
  const audios = media.filter((m) => m.kind === 'AUDIO');
  const videos = media.filter((m) => m.kind === 'VIDEO');
  const files = media.filter((m) => m.kind === 'FILE');

  return (
    <div className={extrasOnly ? '' : 'overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]'}>
      {!extrasOnly && <div className="h-1 bg-gradient-to-r from-[#BC8748] via-[#BC8748] to-[#0A573B]" />}
      <div className={extrasOnly ? '' : 'p-4'}>
        {/* "..." on the Collect Requirement page shows only the extras (contacts, media, property, notes). */}
        {extrasOnly && (has(lead.alternateMobile) || has(lead.whatsappNumber) || has(lead.email) || has(lead.companyName)) && (
          <div className="flex flex-col gap-0.5 rounded-xl bg-[#FBFAF6] px-3 py-2 text-[12.5px] text-[#5E655D] ring-1 ring-[#EFE9DC]">
            {has(lead.companyName) && <span>{lead.companyName}</span>}
            <span>{[lead.mobileNumber, lead.alternateMobile, lead.whatsappNumber && `WA ${lead.whatsappNumber}`].filter(has).join(' · ')}</span>
            {has(lead.email) && <span className="break-all">{lead.email}</span>}
          </div>
        )}
        {!extrasOnly && (<>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9B6B32]">{t('pw.td.lead_information')}</p>
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FBF6EC] text-[#9B6B32]">
            <UserCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-bold text-[#1A211E]">{lead.name || t('pw.td.lead')}</p>
              {rating > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 text-[#C6971F]">
                  {Array.from({ length: rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[#8A8F86]">
              {[lead.leadNumber, lead.companyName].filter(has).join(' · ') || t('pw.td.details_captured_when_the_lead_was_created')}
            </p>
          </div>
        </div>

        {/* Badges */}
        {(has(lead.leadTemperature) || has(lead.priority) || has(lead.leadType) || has(lead.leadSource)) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {has(lead.leadTemperature) && <Pill tone="warm">{lead.leadTemperature}</Pill>}
            {has(lead.priority) && <Pill>{t('pw.td.priority', { p: String(lead.priority) })}</Pill>}
            {has(lead.leadType) && <Pill>{lead.leadType}</Pill>}
            {has(lead.leadSource) && <Pill>{t('pw.td.via', { src: String(lead.leadSource) })}</Pill>}
          </div>
        )}

        {/* Who got the lead and who handles it */}
        {(has(lead.leadOwnerName) || has(lead.capturedByName) || has(lead.salesExecutiveName) || has(lead.referredByEmployeeName)) && (
          <div className="mt-2.5 flex flex-col gap-0.5 rounded-xl bg-[#FBFAF6] px-3 py-2 text-[12.5px] text-[#5E655D] ring-1 ring-[#EFE9DC]">
            {has(lead.leadOwnerName || lead.capturedByName) && (
              <span><span className="font-semibold text-[#33392F]">{t('pw.td.lead_by')}</span> {lead.leadOwnerName || lead.capturedByName}
                {fmtDate(lead.capturedAt) ? ` · ${fmtDate(lead.capturedAt)}` : ''}</span>
            )}
            {has(lead.referredByEmployeeName) && (
              <span><span className="font-semibold text-[#33392F]">{t('pw.td.referred_by')}</span> {lead.referredByEmployeeName}</span>
            )}
            {has(lead.salesExecutiveName) && lead.salesExecutiveName !== (lead.leadOwnerName || lead.capturedByName) && (
              <span><span className="font-semibold text-[#33392F]">{t('pw.td.sales')}</span> {lead.salesExecutiveName}</span>
            )}
          </div>
        )}

        {/* Quick contact */}
        {(has(phone) || has(wa) || has(lead.email)) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {has(phone) && (
              <a href={telHref(phone)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D7DED8] bg-white py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.99]">
                <Phone className="h-4 w-4" /> {t('pw.td.call')}
              </a>
            )}
            {has(wa) && (
              <a href={waHref(wa)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D7DED8] bg-white py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.99]">
                <MessageCircle className="h-4 w-4" /> {t('pw.td.whatsapp')}
              </a>
            )}
          </div>
        )}
        {(has(phone) || has(lead.email)) && (
          <div className="mt-2 flex flex-col gap-0.5 text-[12.5px] text-[#5E655D]">
            {has(phone) && <span>{[lead.mobileNumber, lead.alternateMobile, lead.whatsappNumber && `WA ${lead.whatsappNumber}`].filter(has).join(' · ')}</span>}
            {has(lead.email) && <span className="break-all">{lead.email}</span>}
          </div>
        )}

        {/* Site location — always visible: where to go, a one-tap navigate link, and the agreed
            visit date. Essential for Site Visit & Measurement tasks (and handy on any lead task). */}
        {(has(addr) || has(lead.landmark) || mapHref || fmtDate(lead.siteVisitDate)) && (
          <div className="mt-3 rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-3.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]">
              <MapPin className="h-3.5 w-3.5" /> {t('pw.td.site_location')}
            </p>
            {has(addr) && <p className="text-[13.5px] leading-snug text-[#33392F]">{addr}</p>}
            {has(lead.landmark) && <p className="mt-0.5 text-[12.5px] text-[#5E655D]">{t('pw.td.landmarkIs', { x: String(lead.landmark) })}</p>}
            {fmtDate(lead.siteVisitDate) && (
              <p className="mt-1 text-[12.5px] font-medium text-[#2C7050]">{t('pw.td.scheduledVisit', { d: fmtDate(lead.siteVisitDate) ?? '' })}</p>
            )}
            {mapHref && (
              <a href={mapHref} target="_blank" rel="noopener noreferrer"
                className="mt-2.5 flex items-center justify-center gap-2 rounded-xl bg-[#0A573B] py-2.5 text-[14px] font-semibold text-white active:scale-[0.99]">
                <Navigation className="h-4 w-4" /> {t('pw.td.navigate_to_site')}
              </a>
            )}
          </div>
        )}

        {/* What the customer wants — the centrepiece for a Collect Requirement task */}
        {(has(lead.requirementCategory) || has(lead.requirementProduct) || has(description) ||
          has(lead.roomsRequired) || (lead.scope && lead.scope.length > 0) || has(finish) ||
          has(lead.specialRequests) || budget) && (
          <div className="mt-3.5 rounded-xl bg-[#F0F5F1] p-3.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#2C7050]">{t('pw.td.what_the_customer_wants')}</p>
            <div className="flex flex-col gap-2.5">
              <LField label={t('pw.td.categories')} value={lead.requirementCategory} />
              {has(lead.requirementProduct) && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#A6A99E]">{t('pw.td.products_asked')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(lead.requirementProduct as string).split(',').map((p) => p.trim()).filter(Boolean).map((p) => (
                      <span key={p} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#9B6B32] ring-1 ring-[#E4D8BF]">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              <LField label={t('pw.td.requirement')} value={description} />
              <LField label={t('pw.td.rooms')} value={lead.roomsRequired} />
              {lead.scope && lead.scope.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#A6A99E]">{t('pw.td.scope_of_work')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.scope.map((s) => (
                      <span key={s} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#2C7050] ring-1 ring-[#CFE3D6]">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <LField label={t('pw.td.preferences')} value={finish || undefined} />
              <LField label={t('pw.td.special_requests')} value={lead.specialRequests} />
              <LField label={t('pw.td.budget')} value={budget || undefined} />
              <LField label={t('pw.td.timeline')} value={timeline || undefined} />
            </div>
          </div>
        )}

        </>)}

        {/* Photos & voice notes captured with the lead */}
        {media.length > 0 && (
          <div className="mt-3.5 rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]">
              <Camera className="h-3.5 w-3.5" /> {t('pw.td.photos_voice_notes')}
            </p>
            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((m, i) => (
                  <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={resolveFileUrl(m.fileUrl)} alt={m.fileName || t('pw.td.lead_photo')} className="h-20 w-20 rounded-lg object-cover ring-1 ring-[#E4DECF]" />
                  </a>
                ))}
              </div>
            )}
            {videos.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {videos.map((m, i) => (
                  <video key={i} src={resolveFileUrl(m.fileUrl)} controls className="w-full rounded-lg" />
                ))}
              </div>
            )}
            {audios.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {audios.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 ring-1 ring-[#E4DECF]">
                    <Mic className="h-4 w-4 shrink-0 text-[#9B6B32]" />
                    <AudioPlayer src={resolveFileUrl(m.fileUrl)} className="w-full" />
                  </div>
                ))}
              </div>
            )}
            {files.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {files.map((m, i) => (
                  <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[13px] font-medium text-[#0A573B]">
                    <FileText className="h-3.5 w-3.5" /> {m.fileName || t('pw.td.attachment')}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* The rest — quiet disclosures so the screen stays calm (address & map now shown above) */}
        <div className="mt-3 divide-y divide-[#F1ECE2] overflow-hidden rounded-xl border border-[#EFE9DC]">
          {(has(lead.propertyType) || has(lead.propertyName) || has(lead.siteAddress) ||
            has(lead.currentConstructionStage) || has(lead.floorCount) || has(lead.areaSqft) || has(lead.expectedWorkArea)) && (
            <Disclosure title={t('pw.td.property')} icon={<Home className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-2.5">
                <LField label={t('pw.td.type')} value={lead.propertyType} />
                <LField label={t('pw.td.name')} value={lead.propertyName} />
                <LField label={t('pw.td.construction_stage')} value={lead.currentConstructionStage} />
                <LField label={t('pw.td.floors')} value={has(lead.floorCount) ? String(lead.floorCount) : undefined} />
                <LField label={t('pw.td.total_area')} value={has(lead.areaSqft) ? t('pw.td.sqft', { n: String(lead.areaSqft) }) : undefined} />
                <LField label={t('pw.td.work_area')} value={has(lead.expectedWorkArea) ? t('pw.td.sqft', { n: String(lead.expectedWorkArea) }) : undefined} />
              </div>
              <div className="mt-2.5"><LField label={t('pw.td.site_address')} value={lead.siteAddress} /></div>
            </Disclosure>
          )}

          {(budget || has(lead.paymentPreference) || has(lead.expectedProjectValue) || timeline) && (
            <Disclosure title={t('pw.td.budget_timeline')} icon={<Wallet className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-2.5">
                <LField label={t('pw.td.estimated')} value={money(lead.estimatedBudget) || undefined} />
                <LField label={t('pw.td.range')} value={has(lead.minimumBudget) || has(lead.maximumBudget) ? [money(lead.minimumBudget), money(lead.maximumBudget)].filter(Boolean).join(' – ') : undefined} />
                <LField label={t('pw.td.expected_value')} value={money(lead.expectedProjectValue) || undefined} />
                <LField label={t('pw.td.payment')} value={lead.paymentPreference} />
              </div>
              <div className="mt-2.5"><LField label={t('pw.td.timeline')} value={timeline || undefined} /></div>
            </Disclosure>
          )}

          {(has(lead.referralType) || has(lead.referrerName) || has(lead.referralNotes) || has(lead.remarks) ||
            has(lead.followUpNotes) || fmtDate(lead.nextFollowUpDate)) && (
            <Disclosure title={t('pw.td.source_notes')} icon={<FileText className="h-4 w-4" />}>
              <div className="flex flex-col gap-2.5">
                <LField label={t('pw.td.referral')} value={[lead.referralType, lead.referrerName, lead.referrerContact].filter(has).join(' · ') || undefined} />
                <LField label={t('pw.td.referral_notes')} value={lead.referralNotes} />
                <LField label={t('pw.td.next_follow_up')} value={[fmtDate(lead.nextFollowUpDate), formatTime(lead.nextFollowUpTime)].filter(Boolean).join(', ') || undefined} />
                <LField label={t('pw.td.follow_up_notes')} value={lead.followUpNotes} />
                <LField label={t('pw.td.remarks')} value={lead.remarks} />
              </div>
            </Disclosure>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'warm' }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
      tone === 'warm' ? 'bg-[#FBEFE0] text-[#9B6B32]' : 'bg-[#F1ECE2] text-[#6B7169]'}`}>
      {children}
    </span>
  );
}

/** `embeddedTaskId`: rendered inside the lead workspace's Requirement tab — no page header of its own. */
export default function TaskDetail({ embeddedTaskId, onChanged }: { embeddedTaskId?: number; onChanged?: () => void } = {}) {
  const { t } = useT();
  const tr = useTr();
  const loc = dateLocale(currentLang());
  const { id } = useParams<{ id: string }>();
  const embedded = embeddedTaskId != null;
  const taskId = embeddedTaskId ?? Number(id);
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetailType | null>(null);
  const [note, setNote] = useState('');
  const [voice, setVoice] = useState<CapturedAudio[]>([]);
  const [sheet, setSheet] = useState<'progress' | 'issue' | 'material' | 'complete' | 'payment' | 'installed' | 'orderstep' | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formFocus, setFormFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState('');
  const [workTab, setWorkTab] = useState<WorkTab>('work');
  const [call, setCall] = useState<CallRecording | null>(null);

  const load = useCallback(() => {
    employeeTaskApi.detail(taskId).then(setTask).catch(() => {});
    onChanged?.();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Call follow-up tasks carry the recording + the lead form instead of field-work tools.
  const isCallTask = task?.category === 'CALL';
  useEffect(() => {
    if (isCallTask) callRecordingApi.forTask(taskId).then(setCall).catch(() => {});
  }, [isCallTask, taskId]);

  // Lead tasks (Collect Requirement, Site Visit, Measure & Quote) are worked in the one lead workspace —
  // its Requirement or Quote tab. The workspace takes a still-open quote task when the Quote tab opens.
  const quoteLink = !!task?.moduleLink
    && (task.moduleLink.startsWith('/employee/quote/new') || task.moduleLink.startsWith('/employee/boq-quote/new'));
  const workspaceTab = !task?.leadId || isCallTask ? null
    : quoteLink || task.formType === 'REQUIREMENT' ? 'work' : null;
  useEffect(() => {
    if (!embedded && task && workspaceTab) {
      navigate(`/employee/lead/${task.leadId}?tab=${workspaceTab}&task=${task.id}`, { replace: true });
    }
  }, [task?.id, workspaceTab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return <div className="p-6 text-center text-sm text-muted-foreground">{t('pw.td.loading')}</div>;
  if (!embedded && workspaceTab) return <div className="p-6 text-center text-sm text-muted-foreground">{t('pw.td.loading')}</div>;

  // A released/declined assignment (e.g. the data-entry hold ran out) no longer makes the task "mine" —
  // the employee can pick it up again.
  const mine = task.myAssignmentStatus === 'CANCELLED' || task.myAssignmentStatus === 'REJECTED'
    ? undefined : task.myAssignmentStatus;
  // Once the work is submitted/approved the task is read-only for the employee: no more progress,
  // photos, notes, issues, material or checklist edits. A manager "reject → rework" reopens it.
  const locked = mine === 'COMPLETED' || ['WAITING_APPROVAL', 'COMPLETED', 'CANCELLED'].includes(task.status);
  const status = statusMeta(task.status);
  const prio = priorityMeta(task.priority);
  const due = humanizeDue(task.dueDate, task.status);

  const doAction = async (action: 'accept' | 'start' | 'pause' | 'complete' | 'approve') => {
    setBusy(true);
    try {
      await runOrQueue({ method: 'post', url: `/employee-tasks/${taskId}/${action}`, description: t('pw.cs.title') });
      load();
    } finally {
      setBusy(false);
    }
  };

  const setProgress = async (pct: number) => {
    setBusy(true);
    try { await employeeTaskApi.addProgress(taskId, { progressPercent: pct }); load(); }
    finally { setBusy(false); }
  };

  // A remark can be text, a voice note, or both. Voice notes post immediately when recorded/uploaded.
  const addNote = async (audioUrl?: string) => {
    if (!note.trim() && !audioUrl) return;
    await api.post(`/tasks/${taskId}/comments`, {
      content: note.trim() || (audioUrl ? '🎤 Voice note' : ''),
      audioUrl: audioUrl || undefined,
    });
    setNote('');
    setVoice([]);
    load();
  };

  // AudioCaptureField appends the uploaded clip to its list — post it as a voice remark, then reset.
  const onVoiceRemark = (next: CapturedAudio[]) => {
    const clip = next[next.length - 1];
    if (clip) addNote(clip.url);
    else setVoice([]);
  };

  const extendHold = async () => {
    await employeeTaskApi.extendHold(taskId);
    load();
  };

  const primaryAction = (() => {
    if (mine === 'ASSIGNED') return { label: t('pw.td.accept_task'), icon: ThumbsUp, action: 'accept' as const };
    // Shared project tasks have no Start / Pause / Resume — the employee just completes the task.
    if (task.projectExecution || task.projectInstallation) return null;
    if (mine === 'ACCEPTED') return { label: t('pw.td.start_work'), icon: Play, action: 'start' as const };
    if (mine === 'IN_PROGRESS') return { label: t('pw.td.pause'), icon: Pause, action: 'pause' as const };
    if (mine === 'PAUSED') return { label: t('pw.td.resume'), icon: Play, action: 'start' as const };
    return null;
  })();

  // Lead-workflow tasks capture structured data on completion (writes onto the lead page).
  const isLeadForm = !!task.formType;
  // The one shared project execution task: progress + checklist + activity log + team messages only.
  const isProjectExec = !!task.projectExecution;
  // Category → Product tracked project tasks (Execution / Installation): board + daily log + team chat.
  const isProjectTask = isProjectExec || !!task.projectInstallation;
  const workTracking = isProjectTask && !!task.workTracking;
  // The task whose approval closes the project collects the customer's payment and submits for approval.
  const closing = !!task.closingTask;
  // What the customer still owes — shown in the Complete dialog of the task that collects payment.
  const dueRaw = task.projectInfo?.pendingToCollect ?? task.projectInfo?.balanceDue;
  const dueToCollect = dueRaw != null && String(dueRaw).trim() !== '' ? Number(dueRaw) : null;
  const canRecordPayment = !locked && !!mine && (workTracking ? closing : isProjectExec);
  const canSubmitForm = isLeadForm && !locked
    && ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED'].includes(mine ?? '');
  // Module-driven tasks (Measurement/BOQ) are done in a dedicated module and close automatically —
  // never completed by hand here.
  const moduleDriven = !!task.moduleDriven;

  // An AVAILABLE task the employee hasn't taken yet — they can pick it up straight from here.
  // Pool tasks carry a backend-only 'AVAILABLE' status not in the TaskStatus union — compare as string.
  // An order's task status follows the order (it can read "In progress" with nobody on it yet), so for
  // orders "can take" means nobody holds it.
  const nobodyOnIt = !task.team.some((m) => !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(m.status as string));
  const canPick = !mine && !locked && !moduleDriven
    && ((task.status as string) === 'AVAILABLE' || ((!!task.order || !!task.installOrder) && nobodyOnIt));
  const pickUp = async () => {
    setBusy(true);
    setActionErr('');
    try {
      await employeeTaskApi.pick(taskId);
      load();
    } catch (e: any) {
      setActionErr(e?.response?.data?.message || t('pw.td.pickFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Collect Requirement on a lead gets the card layout (who / where / what / budget / remarks).
  const reqView = isLeadForm && task.formType === 'REQUIREMENT' && !isCallTask && !!task.lead;
  const openForm = (section: string | null) => { setFormFocus(section); setFormOpen(true); };
  // Orders lane: a stitching / making order's task, or an installation task — each gets its own layout.
  const orderView = !!task.order;
  const installView = !!task.installOrder && !isProjectTask;
  const orderTask = orderView || installView;
  const orderNext = task.order?.nextStatus && task.order.nextStatus !== 'DELIVERED' ? task.order.nextStatus : null;
  const advanceOrderNow = async () => {
    setBusy(true); setActionErr('');
    try { await employeeTaskApi.advanceOrder(taskId); load(); }
    catch (e: any) { setActionErr(e?.response?.data?.message || t('pw.td.could_not_update_the_order')); }
    finally { setBusy(false); }
  };

  const place = [task.floor, task.room, task.itemName].filter(Boolean).join(' · ');
  const photoCount = task.progress.reduce((n, p) => n + p.media.filter((m) => m.mediaType === 'PHOTO').length, 0);
  const showQuickProgress = !isLeadForm && !moduleDriven && !locked && mine === 'IN_PROGRESS';
  const solid = 'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-50';

  return (
    <div className={`flex flex-col pb-36 ${embedded ? '' : 'bg-[#FAF8F3]'}`}>
      {/* Sticky focused header — the lead workspace has its own. */}
      {!embedded && <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-[#EEE7DA] bg-[#FAF8F3]/90 px-2 py-2.5 backdrop-blur">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-black/5" aria-label={t('pw.td.back')}>
          <ArrowLeft className="h-5 w-5 text-[#22271F]" />
        </button>
        <h1 className={`min-w-0 flex-1 truncate text-[#22271F] ${reqView ? 'text-[18px] font-bold' : 'text-[15px] font-semibold'}`}>{task.taskName}</h1>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${reqView ? 'font-bold uppercase tracking-wide' : 'font-medium'} ${status.cls}`}>{status.label}</span>
      </div>}

      <div className={`flex flex-col gap-3.5 ${embedded ? 'py-1' : 'p-4'}`}>
        {task.closedByOffice && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-[#D9E7DD] bg-[#EEF6F0] px-3.5 py-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0A573B]" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#0A573B]">
                {t('pw.td.doneByOffice', { who: task.closedByOffice.by || t('pw.td.the_office') })}
                {task.closedByOffice.at ? t('pw.td.onDate', { d: new Date(task.closedByOffice.at).toLocaleDateString(loc, { day: 'numeric', month: 'short' }) }) : ''}
              </p>
              <p className="mt-0.5 text-[12px] text-[#4F6B5A]">{t('pw.td.nothing_more_to_do_here_check_your_leads_tab')}</p>
            </div>
          </div>
        )}
        {reqView && task.lead && (
          <RequirementTaskView task={task} lead={task.lead} canEdit={canSubmitForm} takeFirst={canPick} onEdit={openForm} onReload={load}
            more={<LeadDetailsCard lead={task.lead} extrasOnly />} />
        )}

        {/* Summary — what to do, where, when. The centrepiece: a soft card with a slim gold accent. */}
        {isProjectTask && <ProjectTaskHero task={task} />}
        {!reqView && !isProjectTask && !orderTask && <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
          <div className="h-1 bg-gradient-to-r from-[#0A573B] via-[#0A573B] to-[#BC8748]" />
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF6EC] px-2.5 py-1">
                <span className={`h-2 w-2 rounded-full ${prio.dot}`} />
                <span className="text-[11px] font-medium text-[#6B7169]">{t('pw.td.priority', { p: prio.label })}</span>
              </span>
              <span className={`ml-auto text-[12px] font-semibold ${dueToneClass(due.tone)}`}>{due.text}</span>
            </div>
            <h2 className="mt-2.5 text-[19px] font-bold leading-snug text-[#1A211E]">{task.taskName}</h2>
            {(task.project?.name || task.customer) && (
              <p className="mt-1 text-[14px] text-[#5E655D]">{[task.project?.name, task.customer].filter(Boolean).join(' · ')}</p>
            )}
            {(place || task.location) && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-[#8A8F86]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B79A5C]" />
                <span>{[place, task.location].filter(Boolean).join(' · ')}</span>
              </p>
            )}
            {task.mapUrl && (
              <a
                href={task.mapUrl}
                target="_blank" rel="noopener noreferrer"
                className="mt-3.5 flex items-center justify-center gap-2 rounded-xl border border-[#D7DED8] bg-white py-2.5 text-[14px] font-semibold text-[#0A573B] active:scale-[0.99]"
              >
                <Navigation className="h-4 w-4" /> {t('pw.td.navigate_to_site')}
              </a>
            )}
          </div>
        </div>}

        {/* The original lead picture — who the customer is and what they asked for at capture. Shown for
            any task tied to a lead so the field employee has full context before collecting/confirming. */}
        {reqView || isProjectTask || orderTask ? null : task.lead ? <LeadDetailsCard lead={task.lead} />
          : task.contact && !isCallTask && (
            <CustomerContactCard contact={task.contact}
              requirement={task.category === 'ENQUIRY' || task.category === 'INSTALLATION' ? task.description : null} />
          )}

        {/* Installing a stitched order from a counter sale: its status + what to collect. */}
        {task.installOrder && !installView && <InstallOrderCard info={task.installOrder} />}

        {/* Orders lane — the order itself (what to make, its step) or the installation job. */}
        {orderView && task.order && <OrderTaskView task={task} order={task.order} canWork={!!mine && !locked} onChanged={load}
          onMarkCompleted={orderNext === 'COMPLETED' ? () => setSheet('orderstep') : undefined} />}
        {installView && task.installOrder && <InstallTaskView task={task} info={task.installOrder} locked={locked || !mine} onChanged={load} />}

        {/* Orders: a visible Team card — the holder adds as many helpers as needed, others can ask to join. */}
        {orderTask && (
          <div className="rounded-2xl border border-[#EDE6D8] bg-white p-4 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
            <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#1A211E]">
              <Users className="h-4 w-4" /> {t('pw.td.assigned_team')}
              <span className="ml-auto text-[12px] font-medium text-[#7A817C]">{task.team.length}</span>
            </div>
            <ul className="mb-3 flex flex-col gap-2">
              {task.team.map((m) => (
                <li key={m.employeeId} className="flex items-center justify-between text-[13px] text-[#33392F]">
                  <span>{m.employeeName}{m.role ? ` · ${m.role}` : ''}</span>
                  <span className="text-[11px] text-[#9A9E96]">{tr(`pw.status.${m.status}`, m.status.replace('_', ' '))}</span>
                </li>
              ))}
            </ul>
            {!locked && (
              <TaskTeamPanel taskId={taskId} canRequestJoin={!!task.canRequestJoin} joinRequested={!!task.joinRequested}
                canManage={!!task.canManageTeam} requests={task.joinRequests ?? []} onChanged={load} />
            )}
          </div>
        )}

        {/* Shared project task — customer payments right under the project details, then the numbered items to
            make and the work-items checklist (tracked projects have their own work board below). */}
        {isProjectTask && task.projectInfo && (
          <PaymentBox info={task.projectInfo} compact
            canRecord={canRecordPayment} onRecord={() => setSheet('payment')} />
        )}
        {isProjectTask && task.projectInfo?.hasQuotation && !locked && <ShareQuotationCard taskId={taskId} />}
        {isProjectTask && task.projectInfo && <ItemsToMakeCard info={task.projectInfo} />}
        {isProjectTask && task.projectInfo && !workTracking && (
          <ChecklistPanel taskId={taskId} checklist={task.checklist} onChanged={load} locked={locked} compact
            title={isProjectExec ? t('pw.td.work_items') : t('pw.td.work_to_complete')} />
        )}

        {/* The project page's Execution tab: Execution / Installation / Daily log / Team chat / History. On a
            project not yet tracked by product it shows the set-up prompt, and the checklist + remarks stay. */}
        {isProjectTask && (
          <ProjectWorkTaskView task={task} editable={!locked && !!mine} locked={locked} onReload={load}
            tab={workTab} onTab={setWorkTab} />
        )}

        {/* Data-entry hold countdown — turns into an "extend time" alert in the last 2 minutes. */}
        {task.holdExpiresAt && <HoldTimer expiresAt={task.holdExpiresAt} onExtend={extendHold} />}

        {moduleDriven && !locked && (
          <div className="rounded-xl border border-[#DBE7DF] bg-[#EFF5F0] p-3.5 text-[13px] leading-relaxed text-[#2C5C45]">
            {rich(t('pw.td.moduleNote'))}
          </div>
        )}

        {task.status === 'WAITING_APPROVAL' && (
          <div className="rounded-xl border border-[#E3DAF1] bg-[#F2EDFA] p-3.5 text-[13px] leading-relaxed text-[#5C4494]">
            {t('pw.td.waitingApproval')}
          </div>
        )}
        {locked && task.status !== 'WAITING_APPROVAL' && (
          <div className="rounded-xl border border-[#DBE7DF] bg-[#EFF5F0] p-3.5 text-[13px] leading-relaxed text-[#2C5C45]">
            {t('pw.td.lockedNote', { state: task.status === 'CANCELLED' ? t('pw.td.stateCancelled') : t('pw.td.stateCompleted') })}
          </div>
        )}

        {isCallTask && (
          <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white p-4 shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E4F1F7] text-[#1F6F8B]">
                <Phone className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[#22271F]">{t('pw.td.call_collect_requirement')}</p>
                <p className="text-[12px] text-[#7A7F76]">{t('pw.td.callIntro')}</p>
              </div>
            </div>
            {call ? (
              <CallLeadPanel call={call} onChanged={(c) => { setCall(c); load(); }}
                onCreateLead={locked ? undefined : () => setFormOpen(true)} createLabel={t('pw.td.fill_requirement_create_lead')} />
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('pw.td.loading_the_call')}</p>
            )}
          </div>
        )}

        {/* Lead-workflow "collect info" tasks are form-first: take the task, then fill the form that
            writes straight onto the lead — no field-work tools (check-in / checklist / progress). */}
        {isLeadForm && !isCallTask && !reqView && (
          <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
            <div className="p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFF5F0] text-[#0A573B]">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-[#1A211E]">
                    {task.formType === 'REQUIREMENT' ? t('pw.td.collect_requirement_from_customer') : t('pw.td.customer_information')}
                  </p>
                  <p className="text-[12px] text-[#8A8F86]">
                    {task.formType === 'REQUIREMENT'
                      ? t('pw.td.reqIntro')
                      : t('pw.td.saves_straight_onto_the_lead_for_the_office')}
                  </p>
                </div>
              </div>
              {locked ? (
                <p className="mt-3.5 flex items-center gap-1.5 text-[13px] font-medium text-[#2C7050]">
                  <CheckCircle2 className="h-4 w-4" /> {task.status === 'WAITING_APPROVAL' ? t('pw.td.submittedAwaiting') : t('pw.td.submittedDone')}
                </p>
              ) : canPick ? (
                <button onClick={pickUp} disabled={busy} className={`${solid} mt-3.5 bg-[#0A573B] text-white`}>
                  <ThumbsUp className="h-4 w-4" /> {t('pw.td.take_this_task')}
                </button>
              ) : canSubmitForm ? (
                <button onClick={() => openForm(null)} disabled={busy} className={`${solid} mt-3.5 bg-[#0A573B] text-white`}>
                  <ClipboardList className="h-4 w-4" /> {t('pw.td.fill_submit_form')}
                </button>
              ) : primaryAction ? (
                <button onClick={() => doAction(primaryAction.action)} disabled={busy} className={`${solid} mt-3.5 bg-[#0A573B] text-white`}>
                  <primaryAction.icon className="h-4 w-4" /> {primaryAction.label}
                </button>
              ) : null}
              {actionErr && <p className="mt-2 rounded-lg bg-[#FBE7E4] p-2.5 text-[12px] text-[#B94B45]">{actionErr}</p>}
            </div>
          </div>
        )}

        {/* Once a Collect Requirement task is submitted, show a read-only summary of what was captured. */}
        {isLeadForm && task.formType === 'REQUIREMENT' && locked && (
          <RequirementSummaryCard taskId={taskId} />
        )}

        {/* Collaborative tasks: let an eligible employee who isn't already on the team join in. */}
        {!mine && !locked && (task.assignmentType === 'MULTIPLE_EMPLOYEES' || task.assignmentType === 'TEAM') && task.team.length > 0 && (
          <button
            onClick={async () => { setBusy(true); try { await employeeTaskApi.join(taskId); load(); } finally { setBusy(false); } }}
            disabled={busy}
            className={`${solid} bg-[#0A573B] text-white`}
          >
            <UserPlus className="h-4 w-4" /> {t('pw.td.join_this_task')}
          </button>
        )}

        {/* Any task: ask an admin to cancel it (customer cancelled / other issue) - lead Lost or project cancelled on approval. */}
        {!locked && (mine || task.cancelRequest) && (
          <CancelTaskButton taskId={taskId} canRequest={!!mine} pending={task.cancelRequest}
            targetType={task.projectId ? 'PROJECT' : task.leadId ? 'LEAD' : 'TASK'} onChanged={load} />
        )}

        {/* Helpers: ask to join a task someone holds; the owner / PM approves requests or adds a colleague. */}
        {!isLeadForm && !isCallTask && !orderTask && !locked && (
          <TaskTeamPanel taskId={taskId} joinRequested={!!task.joinRequested} canManage={false}
            canRequestJoin={!!task.canRequestJoin && !(task.assignmentType === 'MULTIPLE_EMPLOYEES' || task.assignmentType === 'TEAM')}
            requests={[]} onChanged={load} />
        )}

        {/* Field-execution tools — only for real field/site tasks, not lead "collect info" forms. */}
        {!isLeadForm && !isCallTask && (<>
        {mine && !orderTask && !isProjectTask && !['STITCHING', 'INSTALLATION'].includes(task.category as string) && <TimeTracker taskId={taskId} disabled={locked} />}

        {/* Site check-in is for single field visits — not the long-running shared project task. */}
        {!isProjectTask && !orderTask && <CheckInBar taskId={taskId} checkins={task.checkins} onChanged={load} locked={locked} />}

        {!workTracking && !orderTask && !(isProjectTask && task.projectInfo) && (
          <ChecklistPanel taskId={taskId} checklist={task.checklist} onChanged={load} locked={locked}
            title={isProjectExec ? 'Work Items' : 'Work to Complete'} />
        )}

        {/* One-tap progress while the work is live (tracked project tasks compute their own %). */}
        {showQuickProgress && !workTracking && !orderTask && (
          <div className="rounded-2xl border border-[#EDE6D8] bg-white p-4 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A211E]">{t('pw.td.progress')}</h3>
              <span className="text-[15px] font-bold text-[#0A573B]">{task.progressPercent ?? 0}%</span>
            </div>
            <div className="mb-3.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EFEBE0]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0A573B] to-[#0F6E56]" style={{ width: `${task.progressPercent ?? 0}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => setProgress(p)} disabled={busy}
                  className={`rounded-xl border py-2.5 text-[13px] font-semibold transition active:scale-95 disabled:opacity-50 ${
                    (task.progressPercent ?? 0) >= p
                      ? 'border-[#0A573B] bg-[#EFF5F0] text-[#0A573B]'
                      : 'border-[#DDE2DE] bg-white text-[#0A573B]'}`}>
                  {p}%
                </button>
              ))}
            </div>
            <button onClick={() => setSheet('progress')}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 text-[12px] font-medium text-[#9B6B32]">
              <Camera className="h-3.5 w-3.5" /> {t('pw.td.add_photo_or_note')}
            </button>
          </div>
        )}

        {/* History / team / issues — folded into one quiet grouped card so the screen stays calm. */}
        <div className={isProjectTask
          ? 'flex flex-col gap-2.5 [&>div]:overflow-hidden [&>div]:rounded-2xl [&>div]:border [&>div]:border-[#EDE6D8] [&>div]:bg-white [&>div]:shadow-[0_2px_10px_rgba(80,55,20,0.05)]'
          : 'divide-y divide-[#F1ECE2] overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_2px_10px_rgba(80,55,20,0.05)]'}>
          <Disclosure title={isProjectTask ? t('pw.td.progressPhotosCaps') : t('pw.td.progress_photos')} count={task.progress.length}
            meta={isProjectTask ? t('pw.td.photos', { n: photoCount }) : undefined} icon={<ImageIcon className="h-4 w-4" />}>
            {task.progress.length === 0 && <p className="text-[13px] text-[#9A9E96]">{t('pw.td.no_updates_yet')}</p>}
            <ul className="flex flex-col gap-2.5">
              {task.progress.map((p) => (
                <li key={p.id} className="border-b border-[#F1ECE2] pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[#33392F]">{p.employeeName}</span>
                    <span className="text-[#9A9E96]">{new Date(p.createdAt).toLocaleString(loc)}</span>
                  </div>
                  {p.progressPercent != null && <p className="text-[12px] font-medium text-[#0A573B]">{t('pw.td.pctComplete', { p: p.progressPercent })}</p>}
                  {p.remarks && <p className="text-[13px] text-[#33392F]">{p.remarks}</p>}
                  {p.media.length > 0 && (
                    <div className="mt-1.5 flex gap-2 overflow-x-auto">
                      {p.media.map((m, i) => (
                        m.mediaType === 'PHOTO' ? (
                          <img key={i} src={m.fileUrl} alt={t('pw.td.progressAlt')} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span key={i} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#F1ECE2] text-[10px] text-[#8A8F86]">{tr(`pw.media.${m.mediaType}`, m.mediaType)}</span>
                        )
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Disclosure>

          {!orderTask && <Disclosure title={isProjectTask ? t('pw.td.assignedTeamCaps') : t('pw.td.assigned_team')} count={task.team.length}
            meta={isProjectTask ? t('pw.td.members', { n: task.team.length }) : undefined} icon={<Users className="h-4 w-4" />}
            defaultOpen={(task.joinRequests?.length ?? 0) > 0}>
            <ul className="flex flex-col gap-2">
              {task.team.map((m) => (
                <li key={m.employeeId} className="flex items-center justify-between text-[13px] text-[#33392F]">
                  <span>{m.employeeName}{m.role ? ` · ${m.role}` : ''}</span>
                  <span className="text-[11px] text-[#9A9E96]">{tr(`pw.status.${m.status}`, m.status.replace('_', ' '))}</span>
                </li>
              ))}
            </ul>
            {/* Join requests + Add helper live with the team: any member can approve a request or add a colleague. */}
            {!locked && (
              <div className="mt-3">
                <TaskTeamPanel taskId={taskId} canRequestJoin={false} joinRequested={false} canManage={!!task.canManageTeam}
                  requests={task.joinRequests ?? []} onChanged={load} />
              </div>
            )}
          </Disclosure>}

          {task.issues.length > 0 && (
            <Disclosure title={t('pw.td.issues')} count={task.issues.length} icon={<AlertTriangle className="h-4 w-4" />}>
              <ul className="flex flex-col gap-2">
                {task.issues.map((i) => (
                  <li key={i.id} className="text-[13px] text-[#33392F]">
                    <span className="font-medium">{tr(`pw.issue.${i.issueType}`, i.issueType.replace('_', ' '))}</span> — {i.description}
                    <span className="ml-1 text-[11px] text-[#9A9E96]">({tr(`pw.status.${i.status}`, String(i.status))})</span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>
        </>)}

        {/* Remarks — shown for every task type (including lead forms); tracked project tasks use Team chat. */}
        {!workTracking && !orderView && <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
          <Disclosure defaultOpen={reqView} title={reqView ? t('pw.td.task_notes_photos') : isProjectTask ? t('pw.td.remarks_notes') : t('pw.td.remarks')} count={task.comments.length}
            meta={isProjectTask ? (task.comments.length ? t('pw.td.notesCount', { n: task.comments.length }) : t('pw.td.add_notes')) : undefined}
            icon={<MessageSquare className="h-4 w-4" />}>
            <ul className="mb-2.5 flex flex-col gap-2">
              {task.comments.length === 0 && <li className="text-[13px] text-[#9A9E96]">{t('pw.td.no_remarks_yet')}</li>}
              {task.comments.map((c) => {
                const isVoiceOnly = c.content === '🎤 Voice note';
                return (
                  <li key={c.id} className="text-[13px] text-[#33392F]">
                    <span className="font-medium">{c.authorName}:</span>{!isVoiceOnly && ` ${c.content}`}
                    {c.audioUrl && (
                      <AudioPlayer src={resolveFileUrl(c.audioUrl)} className="mt-1 w-full max-w-[240px]" />
                    )}
                  </li>
                );
              })}
            </ul>
            {locked ? (
              <p className="text-[12px] text-[#9A9E96]">{t('pw.td.notes_are_closed_this_task_is_locked')}</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <BaseInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pw.td.add_a_note')}
                    className="flex-1 rounded-xl border border-[#DDE2DE] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0A573B]" />
                  <button onClick={() => addNote()} className="rounded-xl bg-[#0A573B] px-4 text-[13px] font-semibold text-white active:scale-95">{t('pw.td.post')}</button>
                </div>
                {/* Voice remark — record with the mic or upload a clip; posts on its own. */}
                <div className="mt-2">
                  <AudioCaptureField value={voice} onChange={onVoiceRemark} module="task-remark" label={t('pw.td.or_add_a_voice_note')} />
                </div>
                {task.leadId && <p className="mt-1.5 text-[11px] text-[#8A918C]">{t('pw.td.notes_also_show_on_the_lead_page')}</p>}
              </>
            )}
            {/* Collect Requirement: site photos live with the notes — taken or uploaded, saved on the lead's Documents. */}
            {reqView && (
              <div className="mt-3.5 border-t border-[#F1ECE2] pt-3">
                <LeadPhotosCard taskId={taskId} canEdit={canSubmitForm} takeFirst={canPick} embedded />
              </div>
            )}
          </Disclosure>
        </div>}
      </div>

      {/* Collect Requirement: one clear bottom action — take it, then mark it completed via the form. */}
      {reqView && !locked && (canPick || canSubmitForm || primaryAction) && (
        <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-md md:max-w-2xl lg:max-w-3xl -translate-x-1/2 bg-[#FAF8F3]/95 px-3.5 pb-3 pt-2 backdrop-blur">
          {actionErr && <p className="mb-2 rounded-lg bg-[#FBE7E4] p-2.5 text-[12px] text-[#B94B45]">{actionErr}</p>}
          {canPick ? (
            <button onClick={pickUp} disabled={busy} className={`${solid} bg-[#0A573B] text-white`}>
              <ThumbsUp className="h-4 w-4" /> {t('pw.td.take_this_task')}
            </button>
          ) : canSubmitForm ? (
            <button onClick={() => openForm(null)} disabled={busy} className={`${solid} bg-[#0A573B] text-white`}>
              <ClipboardCheck className="h-5 w-5" /> {t('pw.td.mark_as_completed')}
            </button>
          ) : primaryAction && (
            <button onClick={() => doAction(primaryAction.action)} disabled={busy} className={`${solid} bg-[#0A573B] text-white`}>
              <primaryAction.icon className="h-4 w-4" /> {primaryAction.label}
            </button>
          )}
        </div>
      )}

      {/* Bottom action bar with field-work buttons — hidden for lead forms (their CTA card is at top). */}
      {/* Orders lane: one clear action — take it, start / complete the order, or mark it installed. */}
      {orderTask && (
        <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-md md:max-w-2xl lg:max-w-3xl -translate-x-1/2 border-t border-[#EEE7DA] bg-[#FDFCF9]/95 px-3.5 pb-3 pt-2.5 backdrop-blur shadow-[0_-4px_16px_rgba(80,55,20,0.07)]">
          {actionErr && <p className="mb-2 rounded-lg bg-[#FBE7E4] p-2.5 text-[12px] text-[#B94B45]">{actionErr}</p>}
          {canPick ? (
            <button onClick={pickUp} disabled={busy} className={`${solid} bg-[#0A573B] text-white`}>
              <ThumbsUp className="h-4 w-4" /> {t('pw.td.take_this_task')}
            </button>
          ) : !mine ? null : orderView ? (
            orderNext === 'PROCESS' ? (
              <button onClick={advanceOrderNow} disabled={busy} className={`${solid} bg-[#0A573B] text-white`}>
                <Play className="h-4 w-4" /> {t('pw.td.start_work_lc')}
              </button>
            ) : orderNext ? (
              <button onClick={() => setSheet('orderstep')} disabled={busy} className={`${solid} bg-[#0A573B] text-white`}>
                <CheckCircle2 className="h-4 w-4" /> {orderNext === 'COMPLETED' ? t('pw.td.mark_completed') : t('pw.td.moveTo', { s: stepLabel(orderNext) })}
              </button>
            ) : (
              <p className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-[#0A573B]">
                <CheckCircle2 className="h-4 w-4" /> {t('pw.td.order_completed_the_counter_hands_it_over')}
              </p>
            )
          ) : task.installOrder && !task.installOrder.installed ? (
            <button onClick={() => setSheet('installed')} disabled={busy || !task.installOrder.ready}
              className={`${solid} bg-[#0A573B] text-white disabled:opacity-50`}>
              <CheckCircle2 className="h-4 w-4" />
              {!task.installOrder.ready ? t('pw.td.waiting_for_the_order_to_be_completed')
                : Number(task.installOrder.balanceDue ?? 0) > 0 ? t('pw.td.mark_installed_collect') : t('pw.td.mark_installed')}
            </button>
          ) : (
            <p className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-[#0A573B]">
              <CheckCircle2 className="h-4 w-4" /> {t('pw.td.installed')}
            </p>
          )}
        </div>
      )}
      {task.order && orderNext && (
        <OrderStepSheet taskId={taskId} code={task.order.code} nextStatus={orderNext} open={sheet === 'orderstep'}
          onOpenChange={(o) => setSheet(o ? 'orderstep' : null)} onDone={load} />
      )}

      {!isLeadForm && !isCallTask && !orderTask && (
      <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-md md:max-w-2xl lg:max-w-3xl -translate-x-1/2 border-t border-[#EEE7DA] bg-[#FDFCF9]/95 px-3.5 pb-3 pt-2.5 backdrop-blur shadow-[0_-4px_16px_rgba(80,55,20,0.07)]">
        {locked ? (
          <p className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#8A8F86]">
            <CheckCircle2 className="h-4 w-4 text-[#2C7050]" /> {t('pw.td.task_locked_no_further_updates')}
          </p>
        ) : (
          <>
            {/* Primary state action (Accept / Start / Pause / Resume) — unchanged behaviour. */}
            {primaryAction && (
              <button onClick={() => doAction(primaryAction.action)} disabled={busy}
                className={`${solid} mb-2 ${mine === 'IN_PROGRESS' ? 'border border-[#DDE2DE] bg-white text-[#0A573B]' : 'bg-[#0A573B] text-white'}`}>
                <primaryAction.icon className="h-4 w-4" /> {primaryAction.label}
              </button>
            )}
            {/* Module-driven tasks open their module; in-progress field tasks complete via the confirm sheet;
                an untaken pool task can be picked up here. */}
            {task.installOrder && !task.installOrder.installed && mine ? (
              <button onClick={() => setSheet('installed')} disabled={busy || !task.installOrder.ready}
                className={`${solid} mb-2 bg-[#0A573B] text-white disabled:opacity-50`}>
                <CheckCircle2 className="h-4 w-4" /> {task.installOrder.ready ? t('pw.td.markInstalledCaps') : t('pw.td.mark_installed_order_not_completed_yet')}
              </button>
            ) : moduleDriven && task.moduleLink ? (
              <button onClick={() => navigate(task.moduleLink!)} className={`${solid} mb-2 bg-[#0A573B] text-white`}>
                <ClipboardList className="h-4 w-4" /> {task.moduleLabel ?? t('pw.td.open_module')}
              </button>
            ) : (!moduleDriven && (mine === 'IN_PROGRESS' || (isProjectTask && (mine === 'ACCEPTED' || mine === 'PAUSED')))) ? (
              <button onClick={() => setSheet('complete')} disabled={busy} className={`${solid} mb-2 bg-[#0A573B] text-white`}>
                <CheckCircle2 className="h-4 w-4" /> {t('pw.td.complete_task')}
              </button>
            ) : (!primaryAction && canPick) ? (
              <button onClick={pickUp} disabled={busy} className={`${solid} mb-2 bg-[#0A573B] text-white`}>
                <ThumbsUp className="h-4 w-4" /> {t('pw.td.take_this_task')}
              </button>
            ) : null}
            {actionErr && <p className="mb-2 rounded-lg bg-[#FBE7E4] p-2.5 text-[12px] text-[#B94B45]">{actionErr}</p>}
            {!(isProjectTask && !mine) && <div className={`grid gap-2 ${workTracking ? 'grid-cols-2' : isProjectExec ? 'grid-cols-1' : 'grid-cols-3'}`}>
              {workTracking ? (<>
                <button onClick={() => { setWorkTab('log'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex flex-col items-center gap-1 rounded-xl border border-[#E4DECF] bg-white py-2.5 text-[11px] font-medium text-[#4B524E] active:scale-95">
                  <CalendarDays className="h-[18px] w-[18px] text-[#0A573B]" /> {t('pw.td.today_s_update')}
                </button>
                <button onClick={() => { setWorkTab('chat'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex flex-col items-center gap-1 rounded-xl border border-[#E4DECF] bg-white py-2.5 text-[11px] font-medium text-[#4B524E] active:scale-95">
                  <MessageSquare className="h-[18px] w-[18px] text-[#0A573B]" /> {t('pw.td.team_chat')}
                </button>
              </>) : (
                <button onClick={() => setSheet('progress')} className="flex flex-col items-center gap-1 rounded-xl border border-[#E4DECF] bg-white py-2.5 text-[11px] font-medium text-[#4B524E] active:scale-95">
                  <Camera className="h-[18px] w-[18px] text-[#0A573B]" /> {t('pw.td.progress')}
                </button>
              )}
              {/* Issue / material logging is per-item field work — hidden on the shared project tasks. */}
              {!isProjectTask && (
                <button onClick={() => setSheet('issue')} className="flex flex-col items-center gap-1 rounded-xl border border-[#E4DECF] bg-white py-2.5 text-[11px] font-medium text-[#4B524E] active:scale-95">
                  <AlertTriangle className="h-[18px] w-[18px] text-[#B27A12]" /> {t('pw.td.report_issue')}
                </button>
              )}
              {!isProjectTask && (
                <button onClick={() => setSheet('material')} className="flex flex-col items-center gap-1 rounded-xl border border-[#E4DECF] bg-white py-2.5 text-[11px] font-medium text-[#4B524E] active:scale-95">
                  <Package className="h-[18px] w-[18px] text-[#9B6B32]" /> {t('pw.td.material')}
                </button>
              )}
            </div>}
          </>
        )}
      </div>
      )}

      <ProgressSheet taskId={taskId} open={sheet === 'progress'} onOpenChange={(o) => setSheet(o ? 'progress' : null)} onSaved={load} />
      <IssueReportSheet taskId={taskId} open={sheet === 'issue'} onOpenChange={(o) => setSheet(o ? 'issue' : null)} onSaved={load} />
      <MaterialUsageSheet taskId={taskId} open={sheet === 'material'} onOpenChange={(o) => setSheet(o ? 'material' : null)} onSaved={load} />
      <CompleteSheet taskId={taskId} execution={workTracking ? closing : isProjectExec}
        due={dueToCollect} open={sheet === 'complete'} onOpenChange={(o) => setSheet(o ? 'complete' : null)}
        onDone={() => { load(); navigate('/employee/tasks?view=ACTIVE'); }} />
      {task.installOrder && (
        <MarkInstalledSheet taskId={taskId} info={task.installOrder} open={sheet === 'installed'}
          onOpenChange={(o) => setSheet(o ? 'installed' : null)} onDone={() => { load(); navigate('/employee/tasks?view=ACTIVE'); }} />
      )}
      <CollectPaymentSheet taskId={taskId} open={sheet === 'payment'} onOpenChange={(o) => setSheet(o ? 'payment' : null)} onSaved={load} />
      {isLeadForm && task.formType === 'REQUIREMENT' ? (
        <RequirementFormSheet
          taskId={taskId}
          leadId={task.leadId ?? null}
          fromCall={isCallTask && !task.leadId}
          initial={isCallTask && call ? {
            name: call.contactName,
            mobileNumber: call.phoneNumber,
            leadSource: 'Phone Call',
            customerRequirements: call.note,
          } : undefined}
          focus={formFocus}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={() => { setFormOpen(false); load(); navigate('/employee/tasks?view=ACTIVE'); }}
          onDetailsSaved={() => { toast.success(t('pw.td.lead_details_saved')); load(); }}
        />
      ) : isLeadForm && task.formType && (
        <LeadTaskFormSheet
          taskId={taskId}
          formType={task.formType}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={() => { setFormOpen(false); load(); navigate('/employee/tasks?view=ACTIVE'); }}
        />
      )}
    </div>
  );
}

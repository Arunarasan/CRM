import type { TaskCard as TaskCardType } from '@/types/employeeTask';
import { tNow, currentLang, dateLocale } from '@/i18n';

/**
 * Presentation-only helpers shared across the employee task-execution screens.
 * These translate the backend's raw status/priority/due values into the plain,
 * scannable language a field employee needs — they NEVER change task logic.
 */

/** Whole-day difference from today for an ISO date string ("2026-09-03", no time). */
export function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const d = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** Human-friendly deadline: "Due today", "Due tomorrow", "Due in 3 days", "2 days overdue". */
export function humanizeDue(
  dueDate: string | null,
  status?: string,
): { text: string; tone: 'normal' | 'soon' | 'overdue' } {
  if (!dueDate) return { text: tNow('pw.due.none'), tone: 'normal' };
  const d = new Date(`${dueDate}T00:00:00`);
  const nice = d.toLocaleDateString(dateLocale(currentLang()), { month: 'short', day: 'numeric' });
  const closed = status === 'COMPLETED' || status === 'CANCELLED';
  const diff = daysUntil(dueDate);
  if (closed || diff == null) return { text: tNow('pw.due.on', { date: nice }), tone: 'normal' };
  if (diff < 0) {
    const n = -diff;
    return { text: n === 1 ? tNow('pw.due.overdue1') : tNow('pw.due.overdueN', { n }), tone: 'overdue' };
  }
  if (diff === 0) return { text: tNow('pw.due.today'), tone: 'soon' };
  if (diff === 1) return { text: tNow('pw.due.tomorrow'), tone: 'soon' };
  if (diff <= 6) return { text: tNow('pw.due.inDays', { n: diff }), tone: 'normal' };
  return { text: tNow('pw.due.on', { date: nice }), tone: 'normal' };
}

/** Compact deadline for tight card corners: "30d late", "Today", "Tomorrow", "In 3d", "12 Oct". */
export function shortDue(dueDate: string | null, status?: string): string {
  if (!dueDate) return tNow('pw.due.short.none');
  const nice = new Date(`${dueDate}T00:00:00`).toLocaleDateString(dateLocale(currentLang()), { day: 'numeric', month: 'short' });
  const diff = daysUntil(dueDate);
  if (status === 'COMPLETED' || status === 'CANCELLED' || diff == null) return nice;
  if (diff < 0) return tNow('pw.due.short.late', { n: -diff });
  if (diff === 0) return tNow('pw.due.short.today');
  if (diff === 1) return tNow('pw.due.short.tomorrow');
  if (diff <= 6) return tNow('pw.due.short.inDays', { n: diff });
  return nice;
}

const DUE_TONE: Record<string, string> = {
  normal: 'text-[#6B726E]',
  soon: 'text-[#B27A12]',
  overdue: 'text-[#B94B45]',
};
export const dueToneClass = (tone: 'normal' | 'soon' | 'overdue') => DUE_TONE[tone];

/** Priority as a coloured dot + word. HIGH/URGENT/CRITICAL all read as the top tier. */
export function priorityMeta(priority?: string): { label: string; dot: string; urgent: boolean } {
  switch ((priority ?? '').toUpperCase()) {
    case 'URGENT':
    case 'CRITICAL':
      return { label: tNow('pw.prio.urgent'), dot: 'bg-[#DC2626]', urgent: true };
    case 'HIGH':
      return { label: tNow('pw.prio.high'), dot: 'bg-[#EA6A2D]', urgent: true };
    case 'LOW':
      return { label: tNow('pw.prio.low'), dot: 'bg-[#9AA39E]', urgent: false };
    case 'MEDIUM':
    default:
      return { label: tNow('pw.prio.medium'), dot: 'bg-[#D7AA4A]', urgent: false };
  }
}

/** Plain-language task status the employee actually understands, with a soft pill colour. */
export function statusMeta(status: string): { label: string; cls: string } {
  switch (status) {
    case 'AVAILABLE': // backend-only status on pool cards
      return { label: tNow('pw.ts2.AVAILABLE'), cls: 'bg-[#F6ECDD] text-[#9B6B32]' };
    case 'PENDING':
      return { label: tNow('pw.ts2.PENDING'), cls: 'bg-[#EEF0EE] text-[#5B625E]' };
    case 'ACCEPTED':
      return { label: tNow('pw.ts2.ACCEPTED'), cls: 'bg-[#E7F2EC] text-[#28704F]' };
    case 'IN_PROGRESS':
      return { label: tNow('pw.ts2.IN_PROGRESS'), cls: 'bg-[#E7F2EC] text-[#28704F]' };
    case 'PAUSED':
      return { label: tNow('pw.ts2.PAUSED'), cls: 'bg-[#FBEED0] text-[#9D6B10]' };
    case 'WAITING_MATERIAL':
      return { label: tNow('pw.ts2.WAITING_MATERIAL'), cls: 'bg-[#FDE9D6] text-[#B45A1B]' };
    case 'WAITING_APPROVAL':
      return { label: tNow('pw.ts2.WAITING_APPROVAL'), cls: 'bg-[#EDE6F7] text-[#6D4AA8]' };
    case 'COMPLETED':
      return { label: tNow('pw.ts2.COMPLETED'), cls: 'bg-[#E7F2EC] text-[#28704F]' };
    case 'REWORK':
    case 'REJECTED':
      return { label: tNow('pw.ts2.REWORK'), cls: 'bg-[#FBE2E0] text-[#B94B45]' };
    case 'CANCELLED':
      return { label: tNow('pw.ts2.CANCELLED'), cls: 'bg-[#EEF0EE] text-[#8A918C]' };
    default:
      return { label: (() => { const k = `pw.status.${status}`; const v = tNow(k); return v === k ? status.replace(/_/g, ' ') : v; })(), cls: 'bg-[#EEF0EE] text-[#5B625E]' };
  }
}

/**
 * Plan order within a group: brand-new leads first, then projects Ready-to-Fit, then everything else
 * by progress (furthest along first). Ties break on lead star rating, then earliest due date.
 */
const NEW_LEAD_MS = 3 * 24 * 3600 * 1000;
export function rankTier(t: TaskCardType): number {
  const fresh = t.category === 'LEAD' && t.createdAt != null
    && Date.now() - new Date(t.createdAt).getTime() < NEW_LEAD_MS
    && t.myAssignmentStatus !== 'IN_PROGRESS' && !(t.progressPercent && t.progressPercent > 0);
  if (fresh) return 0;
  if (t.workStage === 'READY_TO_FIT') return 1;
  return 2;
}
export function byPlanRank(a: TaskCardType, b: TaskCardType): number {
  return rankTier(a) - rankTier(b)
    || (rankTier(a) === 2 ? (b.progressPercent ?? 0) - (a.progressPercent ?? 0) : 0)
    || (b.leadRating ?? 0) - (a.leadRating ?? 0)
    || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
}

/** Lead tasks worked in the lead workspace: Collect Requirement, and the site visit / measure / quote stage. */
export const REQUIREMENT_CODES = ['TT_COLLECT_REQUIREMENT', 'TT_UNDERSTAND_REQ'];
export const QUOTE_CODES = ['TT_MEASURE_QUOTE', 'TT_VISIT_MEASURE', 'TT_BOQ_QUOTE'];
export const inLeadWorkspace = (t: { leadId?: number | null; category?: string | null; taskTypeCode?: string | null }) => {
  const code = (t.taskTypeCode ?? '').toUpperCase();
  return t.leadId != null && ['LEAD', 'ENQUIRY'].includes((t.category ?? '').toUpperCase())
    && (REQUIREMENT_CODES.includes(code) || QUOTE_CODES.includes(code));
};

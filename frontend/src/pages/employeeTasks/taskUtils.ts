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
  if (!dueDate) return { text: 'No due date', tone: 'normal' };
  const d = new Date(`${dueDate}T00:00:00`);
  const nice = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const closed = status === 'COMPLETED' || status === 'CANCELLED';
  const diff = daysUntil(dueDate);
  if (closed || diff == null) return { text: `Due ${nice}`, tone: 'normal' };
  if (diff < 0) {
    const n = -diff;
    return { text: n === 1 ? '1 day overdue' : `${n} days overdue`, tone: 'overdue' };
  }
  if (diff === 0) return { text: 'Due today', tone: 'soon' };
  if (diff === 1) return { text: 'Due tomorrow', tone: 'soon' };
  if (diff <= 6) return { text: `Due in ${diff} days`, tone: 'normal' };
  return { text: `Due ${nice}`, tone: 'normal' };
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
      return { label: 'Urgent', dot: 'bg-[#DC2626]', urgent: true };
    case 'HIGH':
      return { label: 'High', dot: 'bg-[#EA6A2D]', urgent: true };
    case 'LOW':
      return { label: 'Low', dot: 'bg-[#9AA39E]', urgent: false };
    case 'MEDIUM':
    default:
      return { label: 'Medium', dot: 'bg-[#D7AA4A]', urgent: false };
  }
}

/** Plain-language task status the employee actually understands, with a soft pill colour. */
export function statusMeta(status: string): { label: string; cls: string } {
  switch (status) {
    case 'PENDING':
      return { label: 'Not started', cls: 'bg-[#EEF0EE] text-[#5B625E]' };
    case 'ACCEPTED':
      return { label: 'Ready to start', cls: 'bg-[#E7F2EC] text-[#28704F]' };
    case 'IN_PROGRESS':
      return { label: 'In progress', cls: 'bg-[#E7F2EC] text-[#28704F]' };
    case 'PAUSED':
      return { label: 'Paused', cls: 'bg-[#FBEED0] text-[#9D6B10]' };
    case 'WAITING_MATERIAL':
      return { label: 'Waiting on material', cls: 'bg-[#FDE9D6] text-[#B45A1B]' };
    case 'WAITING_APPROVAL':
      return { label: 'Awaiting approval', cls: 'bg-[#EDE6F7] text-[#6D4AA8]' };
    case 'COMPLETED':
      return { label: 'Completed', cls: 'bg-[#E7F2EC] text-[#28704F]' };
    case 'REWORK':
    case 'REJECTED':
      return { label: 'Needs rework', cls: 'bg-[#FBE2E0] text-[#B94B45]' };
    case 'CANCELLED':
      return { label: 'Cancelled', cls: 'bg-[#EEF0EE] text-[#8A918C]' };
    default:
      return { label: status.replace(/_/g, ' '), cls: 'bg-[#EEF0EE] text-[#5B625E]' };
  }
}

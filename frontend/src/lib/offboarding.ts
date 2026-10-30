import api from "@/lib/api";

interface OffboardingPreview {
  openTasks: number;
  unreadNotifications: number;
  leaveRequests: number;
  correctionRequests: number;
  profileRequests: number;
  payrollRequestsNeedAdmin: number;
  conversionRequestsNeedAdmin: number;
}

/**
 * Human-readable list of what deactivating / deleting an employee will clean up automatically
 * (open tasks go back to the pool, pending requests are closed). Empty string when nothing applies
 * or the preview can't be loaded — the confirm still works without it.
 */
export async function offboardingNote(employeeId: number | string): Promise<string> {
  try {
    const { data } = await api.get<OffboardingPreview>(`/hr/employees/${employeeId}/offboarding-preview`);
    const closed = data.leaveRequests + data.correctionRequests + data.profileRequests;
    const needAdmin = data.payrollRequestsNeedAdmin + data.conversionRequestsNeedAdmin;
    const lines: string[] = [];
    if (data.openTasks > 0) lines.push(`• ${data.openTasks} open task(s) will be released back to the task pool`);
    if (closed > 0) lines.push(`• ${closed} pending leave / attendance / profile request(s) will be closed`);
    if (data.unreadNotifications > 0) lines.push(`• ${data.unreadNotifications} unread notification(s) will be cleared`);
    if (needAdmin > 0) lines.push(`• ${needAdmin} payroll / project-conversion request(s) still need your decision`);
    return lines.length ? `\n\nAutomatic clean-up:\n${lines.join("\n")}` : "";
  } catch {
    return "";
  }
}

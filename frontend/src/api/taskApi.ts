import api from '../lib/api';

// Thin typed wrapper around the new Enterprise PM endpoints on /api/tasks (assignment + dependencies).
// These return ApiResponse<T>-wrapped bodies, auto-unwrapped by the axios interceptor.

const BASE = '/tasks';

export const taskApi = {
  assign: (taskId: number, payload: { phaseId?: number; roomId?: number; contractorId?: number; employeeId?: number }) =>
    api.put<any>(`${BASE}/${taskId}/assign`, payload).then((r) => r.data),
  addDependency: (taskId: number, dependsOnTaskId: number) =>
    api.post<any>(`${BASE}/${taskId}/dependencies`, { dependsOnTaskId }).then((r) => r.data),
  removeDependency: (taskId: number, dependsOnTaskId: number) =>
    api.delete(`${BASE}/${taskId}/dependencies/${dependsOnTaskId}`),
  // Focused edit (name/priority/due date/description/status) that preserves project + assignment.
  editBasics: (taskId: number, payload: { taskName?: string; priority?: string; status?: string; dueDate?: string | null; description?: string }) =>
    api.put<any>(`${BASE}/${taskId}/basics`, payload).then((r) => r.data),
  remove: (taskId: number) => api.delete(`${BASE}/${taskId}`),
  // Full task details ({ task, comments, attachments }) — used to prefill the editor.
  details: (taskId: number) => api.get<any>(`${BASE}/${taskId}`).then((r) => r.data),
};

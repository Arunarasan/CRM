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
};

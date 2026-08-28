import api from '../lib/api';
import {
  RecommendRequest,
  RecommendResult,
  AssignmentSettings,
  AssignmentHistoryRow,
  AssignmentDashboard,
} from '../types/assignment';

// Smart Employee Auto Assignment API (/api/assignments). Recommendation engine, one-click
// assign / replace, manager settings, history and dashboard widgets. All endpoints return
// ApiResponse<T>, auto-unwrapped by the axios interceptor in lib/api.ts.

const BASE = '/assignments';

export interface AssignSelection {
  resourceType?: string;
  resourceId: number;
  role?: string;
  suitabilityScore?: number;
  reason?: string;
}

export const smartAssignmentApi = {
  recommend: (body: RecommendRequest) =>
    api.post<RecommendResult>(`${BASE}/recommend`, body).then((r) => r.data),

  assign: (taskId: number, selections: AssignSelection[], method = 'AUTO') =>
    api.post<{ assigned: number; taskId: number; method: string }>(`${BASE}/assign`, {
      taskId,
      method,
      selections,
    }).then((r) => r.data),

  suggestReplacement: (taskId: number, resourceId: number, reason?: string, resourceType = 'EMPLOYEE') =>
    api.get<RecommendResult & { replacing: Record<string, unknown> }>(
      `${BASE}/replace/suggest`,
      { params: { taskId, resourceId, resourceType, reason } },
    ).then((r) => r.data),

  replace: (body: {
    taskId: number;
    oldResourceId: number;
    oldResourceType?: string;
    reason?: string;
    replacement: AssignSelection;
  }) => api.post<Record<string, unknown>>(`${BASE}/replace`, body).then((r) => r.data),

  getSettings: () => api.get<AssignmentSettings>(`${BASE}/settings`).then((r) => r.data),
  updateSettings: (settings: Partial<AssignmentSettings>) =>
    api.put<AssignmentSettings>(`${BASE}/settings`, settings).then((r) => r.data),

  history: (taskId?: number) =>
    api.get<AssignmentHistoryRow[]>(`${BASE}/history`, { params: taskId ? { taskId } : {} }).then((r) => r.data),

  dashboard: () => api.get<AssignmentDashboard>(`${BASE}/dashboard`).then((r) => r.data),

  // --- Merged Tasks & Employees board ---
  taskBoard: () => api.get<TaskBoardRow[]>(`${BASE}/task-board`).then((r) => r.data),
  roster: () => api.get<RosterRow[]>(`${BASE}/roster`).then((r) => r.data),
};

export type TaskBucket = 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'NEEDS_APPROVAL' | 'COMPLETED';

export interface TaskAssigneeView {
  resourceType: string;
  resourceId: number;
  name: string;
  code: string | null;
  status: string;
}

export interface TaskBoardRow {
  id: number;
  taskName: string;
  projectId: number | null;
  project: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  bucket: TaskBucket;
  assignees: TaskAssigneeView[];
}

export interface RosterRow {
  employeeId: number;
  userId: number | null;
  resourceId: number | null;
  employeeCode: string | null;
  name: string;
  designation: string | null;
  department: string | null;
  tasksAssignedNow: number;
  completedLast24h: number;
  workingNow: boolean;
  onLeave: boolean;
  status: string | null;
  maxTasksPerDay: number;
  atCapacity: boolean;
  assignable: boolean;
}

// --- Small helpers for the form dropdowns (raw entity endpoints, not ApiResponse-wrapped) ---

export interface ProjectOption { id: number; projectName: string; priority?: string }
export interface TaskOption { id: number; taskName: string; estimatedHours?: number; requiredSkills?: string }
export interface DepartmentOption { id: number; name: string }

export const assignmentLookups = {
  projects: () =>
    api.get<any>('/projects', { params: { size: 200 } }).then((r) => {
      const d = r.data;
      const list = Array.isArray(d) ? d : d?.content ?? [];
      return list as ProjectOption[];
    }),
  tasksByProject: (projectId: number) =>
    api.get<TaskOption[]>(`/tasks/project/${projectId}`).then((r) => r.data),
  departments: () =>
    api.get<any>('/hr/departments').then((r) => {
      const d = r.data;
      return (Array.isArray(d) ? d : d?.content ?? []) as DepartmentOption[];
    }),
};

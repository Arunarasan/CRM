import api from '../lib/api';
import { DailyLog, WorkBoard, WorkEvent, WorkStepType } from '../types/projectWork';

// /api/project-work — Category → Product tracking for a project's Execution + Installation tasks.
const BASE = '/project-work';

export const projectWorkApi = {
  board: (projectId: number) => api.get<WorkBoard>(`${BASE}/projects/${projectId}`).then((r) => r.data),
  setup: (projectId: number) => api.post<WorkBoard>(`${BASE}/projects/${projectId}/setup`).then((r) => r.data),
  syncQuote: (projectId: number) => api.post<WorkBoard>(`${BASE}/projects/${projectId}/sync-quote`).then((r) => r.data),

  addLine: (projectId: number, body: {
    category?: string; itemName: string; color?: string; location?: string;
    quantity?: number | string; unit?: string; productId?: number; steps?: WorkStepType[];
  }) => api.post<WorkBoard>(`${BASE}/projects/${projectId}/lines`, body).then((r) => r.data),
  updateLine: (lineId: number, body: { productId?: number | null; location?: string; itemName?: string }) =>
    api.put<WorkBoard>(`${BASE}/lines/${lineId}`, body).then((r) => r.data),
  removeLine: (lineId: number) => api.delete<WorkBoard>(`${BASE}/lines/${lineId}`).then((r) => r.data),
  setLineSteps: (lineId: number, steps: WorkStepType[]) =>
    api.put<WorkBoard>(`${BASE}/lines/${lineId}/steps`, { steps }).then((r) => r.data),

  updateStep: (stepId: number, body: {
    percent?: number; done?: boolean; deliveryRoute?: string; deliveryStage?: string | null;
    pickupFrom?: string; note?: string; photoUrl?: string;
  }) => api.put<WorkBoard>(`${BASE}/steps/${stepId}`, body).then((r) => r.data),

  addInstallCategory: (projectId: number, category: string) =>
    api.post<WorkBoard>(`${BASE}/projects/${projectId}/install-categories`, { category }).then((r) => r.data),
  setInstallPercent: (categoryId: number, percent: number | null) =>
    api.put<WorkBoard>(`${BASE}/install-categories/${categoryId}/percent`, { percent }).then((r) => r.data),
  addInstallStep: (categoryId: number, content: string) =>
    api.post<WorkBoard>(`${BASE}/install-categories/${categoryId}/steps`, { content }).then((r) => r.data),
  toggleInstallStep: (stepId: number) =>
    api.put<WorkBoard>(`${BASE}/install-steps/${stepId}/toggle`).then((r) => r.data),
  removeInstallStep: (stepId: number) =>
    api.delete<WorkBoard>(`${BASE}/install-steps/${stepId}`).then((r) => r.data),

  dailyLogs: (taskId: number) => api.get<DailyLog[]>(`${BASE}/tasks/${taskId}/daily-logs`).then((r) => r.data),
  addDailyLog: (taskId: number, body: {
    workDone?: string; tomorrowPlan?: string; photos?: string[]; audioUrl?: string;
    categoryPercents?: Record<number, number>;
  }) => api.post<DailyLog>(`${BASE}/tasks/${taskId}/daily-logs`, body).then((r) => r.data),
  projectDailyLogs: (projectId: number) =>
    api.get<DailyLog[]>(`${BASE}/projects/${projectId}/daily-logs`).then((r) => r.data),
  events: (projectId: number) => api.get<WorkEvent[]>(`${BASE}/projects/${projectId}/events`).then((r) => r.data),
};

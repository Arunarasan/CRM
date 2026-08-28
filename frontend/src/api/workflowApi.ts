import api from '../lib/api';

// Admin workflow surface: template config, the exception-console overview, and console actions.
// The employee-facing task/pool/time APIs live in employeeTaskApi.ts.

const BASE = '/workflow';

export interface ConsoleTaskCard {
  id: number;
  taskName: string;
  project: string | null;
  projectId: number | null;
  status: string;
  priority: string;
  source: string;
  dueDate: string | null;
  assignee: string | null;
}

export interface CapacityRow {
  employeeId: number;
  name: string;
  active: number;
  max: number;
  atCapacity: boolean;
}

export interface RiskRow {
  projectId: number;
  projectName: string;
  status: string;
  progress: number | null;
  endDate: string | null;
  overdueTasks: number;
}

export interface ConsoleOverview {
  counts: Record<string, number>;
  available: ConsoleTaskCard[];
  inProgress: ConsoleTaskCard[];
  blocked: ConsoleTaskCard[];
  overdue: ConsoleTaskCard[];
  unassigned: ConsoleTaskCard[];
  employeeCapacity: CapacityRow[];
  projectsAtRisk: RiskRow[];
  pendingTimeApprovals: number;
}

export interface TemplateTask {
  id: number; name: string; code: string; orderIndex: number;
  assignmentType: string; completionRule: string; eligibleRoles: string | null;
  priority: string; dependsOn: string[];
}
export interface TemplatePhase { id: number; name: string; code: string; orderIndex: number; tasks: TemplateTask[]; }
export interface WorkflowTemplate { id: number; code: string; name: string; scope: string; active: boolean; phases: TemplatePhase[]; }

export const workflowApi = {
  templates: () => api.get<WorkflowTemplate[]>(`${BASE}/templates`).then((r) => r.data),

  consoleOverview: () => api.get<ConsoleOverview>(`${BASE}/console/overview`).then((r) => r.data),
  extendDueDate: (taskId: number, dueDate: string) =>
    api.post(`${BASE}/console/tasks/${taskId}/extend?dueDate=${dueDate}`).then((r) => r.data),
  changePriority: (taskId: number, priority: string) =>
    api.post(`${BASE}/console/tasks/${taskId}/priority`, { priority }).then((r) => r.data),
  returnToPool: (taskId: number) => api.post(`${BASE}/console/tasks/${taskId}/return-to-pool`).then((r) => r.data),
  cancelTask: (taskId: number) => api.post(`${BASE}/console/tasks/${taskId}/cancel`).then((r) => r.data),
};

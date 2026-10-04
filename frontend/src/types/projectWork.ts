// Category → Product work tracking behind a project's "Project Execution" and "Installation" tasks.

export type WorkStepType = 'MATERIAL' | 'MANUFACTURE' | 'STITCHING' | 'DELIVERY';
export type DeliveryRoute = 'DIRECT' | 'PICKUP';
export type DeliveryStage = 'DISPATCHED' | 'PICKED_UP' | 'ON_THE_WAY' | 'AT_SITE';

export interface WorkPoOrder {
  id: number;
  poNumber: string;
  status: string;
  supplierName?: string | null;
  quantity: number;
  received: number;
  expectedDeliveryDate?: string | null;
}

export interface WorkStep {
  id: number;
  stepType: WorkStepType;
  label: string;
  percent: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  /** PO = material follows the project's purchase orders; MANUAL = ticked / slid by the team. */
  source: 'PO' | 'MANUAL';
  po?: { label: string; ordered: number; received: number; orders: WorkPoOrder[]; inTransit: string[] } | null;
  deliveryRoute?: DeliveryRoute | null;
  deliveryStage?: DeliveryStage | null;
  pickupFrom?: string | null;
  note?: string | null;
  photoUrl?: string | null;
  updatedByName?: string | null;
  doneAt?: string | null;
  updatedAt?: string | null;
}

export interface WorkLine {
  id: number;
  itemName: string;
  category: string;
  productId?: number | null;
  color?: string | null;
  location?: string | null;
  quantity?: number | null;
  unit?: string | null;
  imageUrl?: string | null;
  percent: number;
  atSite: boolean;
  custom: boolean;
  steps: WorkStep[];
}

export interface WorkCategory {
  category: string;
  percent: number;
  productCount: number;
  atSiteCount: number;
  lines: WorkLine[];
}

export interface InstallStep {
  id: number;
  content: string;
  done: boolean;
  doneByName?: string | null;
  doneAt?: string | null;
}

export interface InstallCategory {
  id: number;
  category: string;
  percent: number;
  manualPercent?: number | null;
  productCount: number;
  waitingCount: number;
  ready: boolean;
  steps: InstallStep[];
}

export interface WorkTaskInfo {
  id: number;
  name: string;
  status: string;
  progress?: number | null;
  dueDate?: string | null;
}

export interface WorkBoard {
  projectId: number;
  hasLines: boolean;
  executionTask: WorkTaskInfo | null;
  installationTask: WorkTaskInfo | null;
  executionPercent: number;
  installationPercent: number;
  overallPercent: number;
  productCount: number;
  atSiteCount: number;
  categories: WorkCategory[];
  install: InstallCategory[];
  stepTypes: { type: WorkStepType; label: string }[];
}

export interface DailyLog {
  id: number;
  taskId: number;
  logDate: string;
  workDone?: string | null;
  tomorrowPlan?: string | null;
  percentBefore?: number | null;
  percentAfter?: number | null;
  photos: string[];
  audioUrl?: string | null;
  authorName?: string | null;
  createdAt?: string | null;
}

export interface WorkEvent {
  id: number;
  workLineId?: number | null;
  itemName?: string | null;
  installCategoryId?: number | null;
  category?: string | null;
  stepType?: string | null;
  stepLabel?: string | null;
  action: string;
  percent?: number | null;
  note?: string | null;
  photoUrl?: string | null;
  actorName?: string | null;
  createdAt: string;
}

/** The delivery steps each route goes through, in order. */
export const DELIVERY_FLOW: Record<DeliveryRoute, { stage: DeliveryStage; label: string }[]> = {
  DIRECT: [
    { stage: 'DISPATCHED', label: 'Dispatched' },
    { stage: 'AT_SITE', label: 'At site' },
  ],
  PICKUP: [
    { stage: 'PICKED_UP', label: 'Picked up' },
    { stage: 'ON_THE_WAY', label: 'On the way' },
    { stage: 'AT_SITE', label: 'At site' },
  ],
};

export const EVENT_LABELS: Record<string, string> = {
  DONE: 'Done',
  PROGRESS: 'Progress',
  UPDATED: 'Updated',
  RESET: 'Reset',
  DISPATCHED: 'Dispatched',
  PICKED_UP: 'Picked up',
  ON_THE_WAY: 'On the way',
  AT_SITE: 'Reached site',
  TICKED: 'Ticked',
  UNTICKED: 'Unticked',
  PERCENT: 'Set progress',
};

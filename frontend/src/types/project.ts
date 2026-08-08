// Central types for the Enterprise Project Management module additions
// (phases/rooms/items, material planning, daily-log children, approvals, dashboard/progress).
// Mirrors backend com.arudra.crm.entity.Project* / com.arudra.crm.service.ProjectService.

export interface ProjectPhase {
  id?: number;
  name: string;
  sequence?: number;
  status?: string; // PLANNING, IN_PROGRESS, COMPLETED, ON_HOLD
  budget?: number;
  estimatedCost?: number;
  actualCost?: number;
  startDate?: string;
  endDate?: string;
  completionPercentage?: number; // auto-rolled up from rooms — read only
  completedDate?: string;
  remarks?: string;
  boqPhaseId?: number;
}

export interface ProjectRoom {
  id?: number;
  roomName: string;
  floorName?: string;
  roomType?: string;
  completionPercentage?: number; // auto-rolled up from items — read only
  status?: string; // PENDING, IN_PROGRESS, COMPLETED, ON_HOLD — auto
  completedDate?: string;
  remarks?: string;
}

// The full work-item lifecycle. Only work items are edited by hand; everything above rolls up.
export const WORK_ITEM_STATUSES = [
  "PENDING", "ASSIGNED", "MATERIAL_READY", "STARTED", "IN_PROGRESS",
  "INSPECTION", "COMPLETED", "ON_HOLD", "REWORK", "CANCELLED",
] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export interface ProjectRoomItem {
  id?: number;
  itemType: string; // WINDOW, DOOR, WARDROBE, KITCHEN, CURTAIN, PAINTING, FLOORING, ELECTRICAL, PLUMBING, FALSE_CEILING, FURNITURE, CUSTOM
  itemName: string;
  description?: string;
  quantity?: number;
  unit?: string;
  status?: string; // WorkItemStatus
  progress?: number; // 0-100
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  completedDate?: string;
  // Unified workforce assignment (EMPLOYEE -> users.id, CONTRACTOR -> contractors.id).
  resourceType?: string;
  resourceId?: number;
  assignedResource?: { resourceType: string; resourceId: number; name?: string; subtitle?: string; contact?: string };
  photos?: string; // JSON array of URLs
  locked?: boolean;
  delayed?: boolean; // computed server-side
  remarks?: string;
}

export interface ProjectItemProgressLog {
  id?: number;
  eventType: string;
  oldProgress?: number;
  newProgress?: number;
  oldStatus?: string;
  newStatus?: string;
  remarks?: string;
  photos?: string;
  logTime: string;
  user?: { id: number; name?: string };
}

export interface ProjectFloorProgress {
  phaseName: string;
  floorName: string;
  progress: number;
  roomCount: number;
  completed: boolean;
  delayed: boolean;
}

export interface ProjectProgressDashboard {
  overallProgress: number;
  projectStatus: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  delayedTasks: number;
  inspectionPending: number;
  totalRooms: number;
  completedRooms: number;
  delayedRooms: number;
  totalFloors: number;
  completedFloors: number;
  delayedFloors: number;
  totalPhases: number;
  completedPhases: number;
  delayedPhases: number;
  floors: ProjectFloorProgress[];
}

export interface ProjectMaterialRequirement {
  id?: number;
  product?: { id: number; name?: string; unit?: string };
  requiredQty: number;
  reservedQty?: number;
  issuedQty?: number;
  returnedQty?: number;
  consumedQty?: number;
  remainingQty?: number;
  unit?: string;
  purchaseOrder?: { id: number; poNumber?: string; status?: string };
  remarks?: string;
}

export interface ProjectDailyLogEmployee {
  id?: number;
  employee: { id: number; name?: string };
  present?: boolean;
  hoursWorked?: number;
}

export interface ProjectDailyLogMaterial {
  id?: number;
  product: { id: number; name?: string };
  quantityUsed?: number;
}

export interface ProjectDailyLogMedia {
  id?: number;
  mediaType: "PHOTO" | "VIDEO";
  fileUrl?: string;
  caption?: string;
}

export interface ProjectProgress {
  overallPercent: number;
  phasePercent: number;
  roomPercent: number;
  taskPercent: number;
  materialPercent: number;
  financialPercent: number;
}

export interface ProjectModuleDashboard {
  totalProjects: number;
  runningProjects: number;
  completedProjects: number;
  delayedProjects: number;
  todaysTasks: number;
  pendingTasks: number;
  budget: number;
  expenses: number;
  profit: number;
  pendingPayments: number;
}

export interface GenerateFromBoqResult {
  phasesCreated: number;
  roomsCreated: number;
  tasksCreated: number;
  materialsCreated: number;
}

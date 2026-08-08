// Smart Employee Auto Assignment — shared types for the recommendation engine, settings,
// history and dashboard widgets. Backend returns ApiResponse<T> (auto-unwrapped by lib/api.ts).

export interface RecommendRequest {
  taskId?: number | null;
  projectId?: number | null;
  estimatedHours?: number | null;
  departmentId?: number | null;
  requiredRole?: string | null;
  requiredSkills?: string[];
  requiredCount?: number;
  allowOvertime?: boolean | null;
  includeExcluded?: boolean;
}

export interface EmployeeRecommendation {
  employeeId: number;
  userId: number;
  resourceType: string;
  resourceId: number;
  employeeCode?: string;
  name: string;
  photoUrl?: string | null;
  department?: string | null;
  designation?: string | null;
  skills: string[];
  tasksToday: number;
  assignedHours: number;
  actualHoursToday: number;
  remainingHours: number;
  pendingTasks: number;
  highPriorityTasks: number;
  overtimeThisWeek: number;
  currentProjectCompletion: number;
  performanceRating?: number | null;
  starRating?: number | null;
  distanceToProject?: number | null;
  suitabilityScore: number;
  reasons: string[];
  warnings: string[];
  overtimeRequired: boolean;
  recommended?: boolean;
}

export interface ExcludedCandidate {
  employeeId: number;
  name: string;
  department?: string | null;
  designation?: string | null;
  reason: string;
}

export interface RecommendResult {
  requiredCount: number;
  availableCount: number;
  recommendations: EmployeeRecommendation[];
  topPicks: EmployeeRecommendation[];
  excluded: ExcludedCandidate[];
  warning?: string;
  settings: {
    minSuitabilityScore: number;
    allowOvertime: boolean;
    mandatorySkillMatching: boolean;
    maxWorkingHours: number;
    maxTasksPerDay: number;
  };
}

export interface AssignmentSettings {
  id?: number;
  maxTasksPerDay: number;
  maxWorkingHours: number;
  maxOvertimeHours: number;
  autoBalanceEnabled: boolean;
  allowOvertime: boolean;
  allowLowPriorityReassign: boolean;
  minSuitabilityScore: number;
  mandatorySkillMatching: boolean;
  preferSameProjectTeam: boolean;
  preferNearest: boolean;
  minPerformanceScore: number;
  weightAvailability: number;
  weightWorkload: number;
  weightSkills: number;
  weightDepartment: number;
  weightPerformance: number;
  weightLocation: number;
  weightExperience: number;
}

export interface AssignmentHistoryRow {
  id: number;
  taskId?: number | null;
  taskName?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  resourceType: string;
  resourceId?: number | null;
  employeeId?: number | null;
  employeeName?: string | null;
  assignedByName?: string | null;
  assignmentMethod: string;
  suitabilityScore?: number | null;
  reason?: string | null;
  reassignmentReason?: string | null;
  status: string;
  createdAt?: string | null;
}

export interface WorkloadWidget {
  name: string;
  hours: number;
}

export interface AssignmentDashboard {
  availableToday: number;
  onLeave: number;
  workingNow: number;
  freeEmployees: number;
  highestWorkload?: WorkloadWidget | null;
  lowestWorkload?: WorkloadWidget | null;
  inOvertime: number;
  pendingAssignments: number;
  aiRecommendedAssignments: number;
  totalEmployees: number;
}

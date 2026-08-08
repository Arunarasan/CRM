// Central types + constants for the Measurement Management module.
// Mirrors backend com.arudra.crm.util.MeasurementWorkflow and the Measurement* entities.

export interface EntityRef {
  id: number;
  name?: string;
  projectName?: string;
  visitNumber?: string;
  email?: string;
  roles?: string[];
  // Contact detail carried down the Lead → Site Visit → Measurement chain for display.
  leadNumber?: string;
  customerCode?: string;
  customerType?: string;
  phone?: string;
  mobileNumber?: string;
  address?: string;
  siteAddress?: string;
  billingAddress?: string;
  city?: string;
}

export interface Measurement {
  id?: number;
  measurementNumber?: string;
  lead?: EntityRef;
  customer?: EntityRef;
  siteVisit?: EntityRef;
  project?: EntityRef;
  measurementType?: string;
  status?: string;
  priority?: string;
  measuredBy?: string;
  verifiedBy?: string;
  measurementDate?: string;
  startTime?: string;
  endTime?: string;
  assignedEngineer?: EntityRef;
  designer?: EntityRef;
  revisionNumber?: number;
  parentMeasurement?: EntityRef;
  isLatestRevision?: boolean;
  remarks?: string;
  internalNotes?: string;
  propertyType?: string;
  location?: string;
  siteAddress?: string;
  constructionStage?: string;
  totalFloors?: number;
  totalArea?: number;
  mapLocation?: string;

  totalFloorArea?: number;
  totalWallArea?: number;
  totalCeilingArea?: number;
  totalDoorArea?: number;
  totalWindowArea?: number;
  totalPaintableArea?: number;
  totalFalseCeilingArea?: number;
  totalTileArea?: number;
  totalWoodworkArea?: number;
  roomCount?: number;

  submittedAt?: string;
  reviewedBy?: EntityRef;
  reviewedAt?: string;
  approvedBy?: EntityRef;
  approvedAt?: string;
  rejectionReason?: string;
  completedAt?: string;

  customerRemarks?: string;
  approvalDate?: string;
  digitalSignature?: string;
  engineerSignature?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface MeasurementRoom {
  id?: number;
  roomName: string;
  roomType?: string;
  floorNumber?: string;
  description?: string;
  status?: string;
  length?: number;
  width?: number;
  height?: number;
  ceilingHeight?: number;
  doorCount?: number;
  windowCount?: number;
  columnCount?: number;
  beamCount?: number;
  falseCeilingRequired?: boolean;
  flooringRequired?: boolean;
  paintingRequired?: boolean;
  wardrobeRequired?: boolean;
  kitchenRequired?: boolean;
  tvUnitRequired?: boolean;
  loftRequired?: boolean;
  storageRequired?: boolean;
  notes?: string;
  floorArea?: number;
  wallArea?: number;
  ceilingArea?: number;
  perimeter?: number;
  doorArea?: number;
  windowArea?: number;
  paintableArea?: number;
  falseCeilingArea?: number;
  tileArea?: number;
  woodworkArea?: number;
}

export interface MeasurementItem {
  id?: number;
  itemType: string;
  itemName?: string;
  length?: number;
  width?: number;
  height?: number;
  quantity?: number;
  area?: number;
  unit?: string;
  material?: string;
  notes?: string;
}

export interface MeasurementAssignment {
  id?: number;
  employee: EntityRef;
  role: string;
  status?: string;
  assignedDate?: string;
  acceptedTime?: string;
  completedTime?: string;
  remarks?: string;
  assignedBy?: EntityRef;
}

export interface MeasurementDrawing {
  id?: number;
  drawingType?: string;
  fileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: EntityRef;
  description?: string;
  createdAt?: string;
}

export interface MeasurementMedia {
  id?: number;
  measurementRoom?: { id: number; roomName?: string };
  fileName: string;
  filePath: string;
  mediaType?: string;
  category?: string;
  uploadedBy?: EntityRef;
  description?: string;
  createdAt?: string;
}

export interface MeasurementChecklistItem {
  id?: number;
  itemName: string;
  isCompleted?: boolean;
  sortOrder?: number;
  completedBy?: string;
  completedAt?: string;
  remarks?: string;
}

export interface MeasurementHistoryEntry {
  id?: number;
  versionNumber?: number;
  changedBy?: string;
  changedAt?: string;
  changeReason?: string;
  previousValues?: string;
  newValues?: string;
}

export interface MeasurementTimelineEvent {
  actionType: string;
  description: string;
  performedBy: string;
  role?: string;
  actionTime: string;
}

export interface MeasurementActivityLogEntry {
  id?: number;
  actionType: string;
  description: string;
  performedBy: string;
  role?: string;
  actionTime: string;
}

export interface MeasurementDashboard {
  todaysMeasurements: number;
  pending: number;
  underReview: number;
  completed: number;
  approved: number;
  revisionRequests: number;
  measurementsThisMonth: number;
  averageCompletionHours?: number | null;
  mostActiveEngineer?: string | null;
  mostActiveEngineerCount: number;
}

export interface MeasurementMeta {
  types: string[];
  statuses: string[];
  priorities: string[];
  assignmentRoles: string[];
  drawingTypes: string[];
  mediaCategories: string[];
  itemTypes: string[];
  roomTypes: string[];
  checklistItems: string[];
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface MeasurementFilters {
  status?: string;
  measurementType?: string;
  priority?: string;
  customerId?: number;
  projectId?: number;
  leadId?: number;
  engineerId?: number;
  latestOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export const MEASUREMENT_TYPES = ["Initial", "Revision", "Final", "Verification", "Site Recheck"];

export const MEASUREMENT_STATUSES = [
  "Draft", "Assigned", "Accepted", "In Progress", "Under Review",
  "Approved", "Revision Required", "Completed", "Cancelled",
];

export const MEASUREMENT_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const ASSIGNMENT_ROLES = ["Measurement Engineer", "Interior Designer", "Project Manager", "Supervisor"];

export const ROOM_TYPES = [
  "Living Room", "Bedroom", "Master Bedroom", "Kitchen", "Bathroom", "Dining Room",
  "Study", "Balcony", "Utility", "Pooja Room", "Foyer", "Terrace", "Office", "Other",
];

// Mirrors MeasurementWorkflow.ITEM_TYPES — each type becomes the generated BOQ item's category.
export const ITEM_TYPES = [
  "Wall", "Door", "Window", "Column", "Beam", "Ceiling", "Floor", "Partition",
  "Wardrobe", "Cupboard", "Loft", "TV Unit", "Kitchen Cabinet", "Crockery Unit",
  "Shelf", "Storage Unit", "Study Table", "Vanity", "Wall Panelling", "Skirting", "False Ceiling",
  "Screen", "Glass Partition", "Mirror", "Curtain / Blind", "Railing",
  "Electrical Point", "Switch", "Socket", "Light", "Fan", "AC Point", "Plumbing Point", "Custom",
];

// Units a measured item can be quantified in; mirrors BoqService.DEFAULT_UNITS values.
export const MEASUREMENT_UNITS = ["Sqft", "Rft", "Nos", "Lot", "Sqm", "Kg"];

// Mirrors MeasurementWorkflow.FLOOR_LEVELS — keeps BoqItem.floorName grouping consistent.
export const FLOOR_LEVELS = [
  "Basement", "Stilt", "Ground Floor", "First Floor", "Second Floor", "Third Floor",
  "Fourth Floor", "Fifth Floor", "Terrace", "Common Area",
];

export const DRAWING_TYPES = [
  "Floor Plan", "CAD File", "PDF Drawing", "Sketch", "Blueprint", "3D Design",
  "Electrical Layout", "Plumbing Layout", "Furniture Layout", "Ceiling Layout",
];

export const MEDIA_CATEGORIES = ["Before Photo", "Room Photo", "Measurement Photo", "Video", "Voice Note"];

export const STATUS_STYLES: Record<string, string> = {
  "Draft": "bg-slate-100 text-slate-700",
  "Assigned": "bg-blue-100 text-blue-700",
  "Accepted": "bg-indigo-100 text-indigo-700",
  "In Progress": "bg-amber-100 text-amber-700",
  "Under Review": "bg-violet-100 text-violet-700",
  "Approved": "bg-green-100 text-green-700",
  "Revision Required": "bg-red-100 text-red-700",
  "Completed": "bg-emerald-100 text-emerald-700",
  "Cancelled": "bg-gray-200 text-gray-600",
};

export const PRIORITY_STYLES: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-blue-100 text-blue-700",
  Low: "bg-slate-100 text-slate-600",
};

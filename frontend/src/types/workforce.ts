// Unified workforce resource model — the Project module treats employees and contractors as one
// pool of assignable resources. Mirrors backend com.arudra.crm.entity.ResourceType and
// dto/workforce/WorkforceResourceView.

export type ResourceType =
  | 'EMPLOYEE'
  | 'CONTRACTOR'
  | 'FREELANCER'
  | 'SUBCONTRACTOR'
  | 'CONSULTANT'
  | 'VENDOR';

export interface WorkforceResourceView {
  resourceType: ResourceType;
  resourceId: number;
  name: string;
  subtitle?: string;
  contact?: string;
}

export interface WorkforceProductivityRow {
  resourceType: ResourceType;
  resourceId: number;
  name: string;
  assigned: number;
  completed: number;
  overdue: number;
  completionRate: number;
}

export interface WorkforceDashboard {
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  overdueAssignments: number;
  employeeAssignments: number;
  contractorAssignments: number;
  distinctResources: number;
  productivity: WorkforceProductivityRow[];
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employee',
  CONTRACTOR: 'Contractor',
  FREELANCER: 'Freelancer',
  SUBCONTRACTOR: 'Subcontractor',
  CONSULTANT: 'Consultant',
  VENDOR: 'Vendor',
};

export const RESOURCE_TYPE_STYLES: Record<string, string> = {
  EMPLOYEE: 'bg-emerald-100 text-emerald-700',
  CONTRACTOR: 'bg-amber-100 text-amber-700',
  FREELANCER: 'bg-teal-100 text-teal-700',
  SUBCONTRACTOR: 'bg-orange-100 text-orange-700',
  CONSULTANT: 'bg-purple-100 text-purple-700',
  VENDOR: 'bg-cyan-100 text-cyan-700',
};

// ---------------------------------------------------------------------------
// Unified Workforce MASTER model (single "Add Workforce" flow, one directory, one profile).
// Mirrors backend dto/workforce/{WorkforceRequest,WorkforceListRow,WorkforceDetailView} and the
// Workforce entity. Kept in the same file as the assignment-side types above.
// ---------------------------------------------------------------------------

export type WorkforceStatus = 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'INACTIVE';

export const WORKFORCE_STATUSES: WorkforceStatus[] = ['AVAILABLE', 'BUSY', 'ON_LEAVE', 'INACTIVE'];

export const WORKFORCE_STATUS_TONE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  BUSY: 'bg-amber-100 text-amber-700',
  ON_LEAVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
};

export interface WorkforceListRow {
  id: number;
  workforceType: ResourceType;
  fullName: string;
  primarySkill?: string;
  status: WorkforceStatus;
  activeProjects: number;
  mobile?: string;
  email?: string;
  profilePhotoUrl?: string;
  employeeId?: number;
  department?: string;
  contractorId?: number;
  companyName?: string;
}

/** The workforce header entity (shared fields). */
export interface Workforce {
  id: number;
  workforceType: ResourceType;
  fullName: string;
  profilePhotoUrl?: string;
  mobile?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  drivingLicense?: string;
  passportNumber?: string;
  emergencyContactName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  primarySkill?: string;
  secondarySkills?: string;
  experienceYears?: number;
  certifications?: string;
  availableFrom?: string;
  status: WorkforceStatus;
  notes?: string;
}

export interface WorkforceDocument {
  id: number;
  docType: string;
  fileName: string;
  fileUrl: string;
  notes?: string;
}

export interface WorkforceDetail {
  workforce: Workforce;
  employee?: any;    // Employee extension (payroll/department/designation)
  contractor?: any;  // Contractor extension (company/GST/rates/compliance)
  documents: WorkforceDocument[];
  activeProjects: number;
  attendanceRequired: boolean;
}

export interface EmployeeDetailsInput {
  employeeCode?: string;
  departmentId?: number;
  designation?: string;
  joiningDate?: string;
  salary?: number;
  salaryType?: string;
  shift?: string;
  attendanceRequired?: boolean;
  leavePolicy?: string;
  payrollEnabled?: boolean;
  pfNumber?: string;
  esiNumber?: string;
  bankAccount?: string;
  ifsc?: string;
  uan?: string;
}

export interface ContractorDetailsInput {
  companyName?: string;
  contractorCode?: string;
  contactPerson?: string;
  gstNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  labourRate?: number;
  paymentTerms?: string;
  agreementNumber?: string;
  serviceCategories?: string;
  tdsApplicable?: boolean;
  insuranceDetails?: string;
}

export interface WorkforceRequest {
  workforceType: ResourceType;
  fullName?: string;
  profilePhotoUrl?: string;
  mobile?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  drivingLicense?: string;
  passportNumber?: string;
  emergencyContactName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  primarySkill?: string;
  secondarySkills?: string;
  experienceYears?: number;
  certifications?: string;
  availableFrom?: string;
  status?: WorkforceStatus;
  notes?: string;
  employee?: EmployeeDetailsInput;
  contractor?: ContractorDetailsInput;
}

export interface WorkforceTypeMeta {
  value: ResourceType;
  label: string;
  creatable: boolean;
}

export interface WorkforceMeta {
  types: WorkforceTypeMeta[];
  statuses: string[];
  skills: string[];
  salaryTypes: string[];
  departments: { id: number; name: string }[];
}

// Central types for the Project Change Request workflow (customer-driven scope/budget changes).
// Mirrors backend com.arudra.crm.entity.ProjectChangeRequest(Phase) / ProjectChangeRequestService.

export type ChangeRequestType =
  | "CUSTOMER_REQUEST" | "SITE_CONDITION" | "MEASUREMENT_CHANGE" | "MATERIAL_CHANGE"
  | "BUDGET_REDUCTION" | "BUDGET_INCREASE" | "DESIGN_REVISION" | "ENGINEER_SUGGESTION";

export type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

export interface ChangeRequestPhaseAction {
  id?: number;
  projectPhase: { id: number; name?: string };
  action: "ACTIVATE" | "DEACTIVATE";
}

export interface ProjectChangeRequest {
  id?: number;
  requestNumber?: string;
  project?: { id: number; projectName?: string };
  customer?: { id: number; name?: string };
  requestedBy?: { id: number; name?: string };
  approvedBy?: { id: number; name?: string };
  requestDate?: string;
  reason?: string;
  changeType: ChangeRequestType;
  status?: ChangeRequestStatus;
  description?: string;
  approvalDate?: string;
  completedDate?: string;
  rejectionReason?: string;
  resultingBoqId?: number;
  resultingQuotationId?: number;
}

export const CHANGE_REQUEST_TYPE_LABELS: Record<ChangeRequestType, string> = {
  CUSTOMER_REQUEST: "Customer Request",
  SITE_CONDITION: "Site Condition",
  MEASUREMENT_CHANGE: "Measurement Change",
  MATERIAL_CHANGE: "Material Change",
  BUDGET_REDUCTION: "Budget Reduction",
  BUDGET_INCREASE: "Budget Increase",
  DESIGN_REVISION: "Design Revision",
  ENGINEER_SUGGESTION: "Engineer Suggestion",
};

export const CHANGE_REQUEST_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

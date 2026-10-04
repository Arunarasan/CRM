import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { uploadFile, resolveFileUrl } from "@/lib/uploadFile";
import { projectApi, AvailableQuotation } from "@/api/projectApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { smartAssignmentApi } from "@/api/smartAssignmentApi";
import { EmployeeRecommendation } from "@/types/assignment";
import { boqApi } from "@/api/boqApi";
import { changeRequestApi } from "@/api/changeRequestApi";
import { inventoryApi } from "@/api/inventoryApi";
import { financeApi } from "@/api/financeApi";
import { ProjectProfitability } from "@/types/finance";
import { ProjectPhase, ProjectRoom, ProjectRoomItem, ProjectMaterialRequirement, ProjectProgressDashboard, ProjectItemProgressLog, GenerateFromBoqResult, WORK_ITEM_STATUSES } from "@/types/project";
import { ProjectChangeRequest } from "@/types/changeRequest";
import ProjectPaymentsTab from "@/pages/projectFinance/ProjectPaymentsTab";
import BulkWorkUpdateDialog from "@/pages/projectCommandCenter/BulkWorkUpdateDialog";
import CompleteProjectDialog from "@/pages/projectCommandCenter/CompleteProjectDialog";
import ProjectPurchaseOrdersTab from "@/pages/projectCommandCenter/tabs/ProjectPurchaseOrdersTab";
import ProjectGoodsReceivedTab from "@/pages/projectCommandCenter/tabs/ProjectGoodsReceivedTab";
import CameraCaptureButton from "@/components/CameraCaptureButton";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, User, Activity,
  AlertTriangle, CheckCircle2, FileImage,
  TrendingUp, Plus, CheckSquare, Layers, Package, Sparkles,
  ChevronDown, ChevronRight, ShoppingCart, ClipboardCheck,
  Phone, Play, History, RotateCcw, Lock,
  MoreHorizontal, MapPin, MessageCircle, Wallet, Users,
  Pencil, Check, Trash2,
  Calendar, Clock, Flag, Building2, FileText, IndianRupee,
  BarChart3, FileBarChart, Home, Settings, ClipboardList,
  ArrowRight, Percent, Zap, Info, Navigation, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input, BaseInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ProjectContractorsTab from "@/pages/contractors/ProjectContractorsTab";
import DecisionsTab from "@/pages/projectCommandCenter/tabs/DecisionsTab";
import DailyLogsTab from "@/pages/projectCommandCenter/tabs/DailyLogsTab";
import FieldProgressTab from "@/pages/projectCommandCenter/tabs/FieldProgressTab";
import WorkProgressTab from "@/pages/projectCommandCenter/tabs/WorkProgressTab";
import QualityTab from "@/pages/projectCommandCenter/tabs/QualityTab";
import IssuesRisksTab from "@/pages/projectCommandCenter/tabs/IssuesRisksTab";
import DocumentsTab from "@/pages/projectCommandCenter/tabs/DocumentsTab";
import LabourTab from "@/pages/projectCommandCenter/tabs/LabourTab";
import ServiceWarrantyTab from "@/pages/projectCommandCenter/tabs/ServiceWarrantyTab";
import ProjectReportsTab from "@/pages/projectCommandCenter/tabs/ProjectReportsTab";
import WorkCategoriesTab from "@/pages/projectCommandCenter/tabs/WorkCategoriesTab";
import { dailyReportApi } from "@/api/dailyReportApi";
import TrackingLinkDialog from "@/components/projects/TrackingLinkDialog";
import { ProjectInfoRow, ProjectJourneyBar, ProjectHeaderSummary, waLink } from "@/pages/projectCommandCenter/ProjectJourneyHeader";
import ResourceSelect, { ResourceSelection } from "@/components/workforce/ResourceSelect";
import { ResourceType } from "@/types/workforce";
import { useGoBack } from "@/hooks/useGoBack";
import { toast } from "@/components/ui/toast";
import SearchableSelect from "@/components/ui/searchable-select";
import QuoteWorkspace from "@/pages/leads/quote/QuoteWorkspace";
import { UNIT_DATALIST_ID } from "@/components/UnitOptions";

const ITEM_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  ASSIGNED: 'bg-emerald-100 text-emerald-700',
  MATERIAL_READY: 'bg-cyan-100 text-cyan-700',
  STARTED: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-700',
  INSPECTION: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  REWORK: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
};
const itemStatusStyle = (status?: string) => ITEM_STATUS_STYLES[(status || 'PENDING').toUpperCase()] || ITEM_STATUS_STYLES.PENDING;

// Compact inline editor input, sized to sit inside an overview cell without reflowing the layout.
const cellInput = "w-full h-8 rounded-md border border-input bg-background px-2 text-sm";

const progressBarColor = (pct: number) => pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300';

// Premium stat-strip tones, matching the Overview stats cards (bg / border / icon-chip).
const STAT_TONES: Record<string, [string, string, string]> = {
  emerald: ['bg-emerald-50/70', 'border-emerald-100', 'bg-emerald-100 text-emerald-600'],
  sky: ['bg-sky-50/70', 'border-sky-100', 'bg-sky-100 text-sky-600'],
  violet: ['bg-violet-50/70', 'border-violet-100', 'bg-violet-100 text-violet-600'],
  orange: ['bg-orange-50/70', 'border-orange-100', 'bg-orange-100 text-orange-600'],
  rose: ['bg-rose-50/70', 'border-rose-100', 'bg-rose-100 text-rose-600'],
  amber: ['bg-amber-50/70', 'border-amber-100', 'bg-amber-100 text-amber-600'],
};
// Compact donut progress ring used on the Phases & Rooms dashboard band.
function ProgressRing({ pct, label, sub, color }: { pct: number; label: string; sub: string; color: string }) {
  const r = 30, circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/40 px-2 py-3 flex flex-col items-center text-center">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 72 72" className="h-16 w-16 -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#eef2f7" strokeWidth="7" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - clamped / 100)} className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800">{clamped}%</div>
      </div>
      <div className="mt-1.5 text-xs font-semibold text-slate-700 leading-tight">{label}</div>
      <div className="text-[10px] text-slate-400">{sub}</div>
    </div>
  );
}

type StatItem = { label: string; value: React.ReactNode; sub?: string; icon: React.ComponentType<{ className?: string }>; tone: keyof typeof STAT_TONES };
/** A row of Overview-style stat cards used to head each Execution section. */
function StatStrip({ items, className = 'grid grid-cols-2 md:grid-cols-4 gap-2.5' }: { items: StatItem[]; className?: string }) {
  return (
    <div className={className}>
      {items.map((s) => {
        const [bg, ring, chip] = STAT_TONES[s.tone];
        const Icon = s.icon;
        return (
          <div key={s.label} className={`${bg} ${ring} border rounded-xl px-3 py-2 flex flex-col`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${chip}`}><Icon className="w-3.5 h-3.5" /></span>
            <span className="text-[11px] font-semibold text-slate-500 mt-1.5 truncate">{s.label}</span>
            <span className="text-xl font-black text-slate-800 leading-tight">{s.value}</span>
            {s.sub && <span className="text-[10px] font-medium text-slate-400 truncate">{s.sub}</span>}
          </div>
        );
      })}
    </div>
  );
}

// Overview card chrome, matching the premium mockup.
const CARD = "bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.12)]";
const CARD_TITLE = "text-base font-bold text-slate-900 flex items-center gap-2";

const STATUS_PILL: Record<string, string> = {
  PLANNING: "bg-sky-50 text-sky-700 ring-sky-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-sky-50 text-sky-700 ring-sky-200",
  RUNNING: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAUSED: "bg-amber-50 text-amber-700 ring-amber-200",
  ON_HOLD: "bg-amber-50 text-amber-700 ring-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-200",
};

type ActivityKind = "created" | "stage" | "edit" | "document" | "issue" | "log" | "payment";
type ActivityItem = { date?: string; activity: string; by?: string; details?: string; kind: ActivityKind };
const ACTIVITY_ICON: Record<ActivityKind, [React.ComponentType<{ className?: string }>, string]> = {
  created: [Plus, "bg-emerald-100 text-emerald-700"],
  stage: [ArrowRight, "bg-sky-100 text-sky-700"],
  edit: [Pencil, "bg-amber-100 text-amber-700"],
  document: [FileText, "bg-sky-50 text-sky-600"],
  issue: [AlertTriangle, "bg-rose-100 text-rose-600"],
  log: [ClipboardList, "bg-slate-100 text-slate-600"],
  payment: [IndianRupee, "bg-emerald-50 text-emerald-700"],
};
const activityKindOf = (text: string): ActivityKind => {
  const t = text.toLowerCase();
  if (t.includes("created") || t.includes("converted")) return "created";
  if (t.includes("stage") || t.includes("status") || t.includes("execution") || t.includes("handover") || t.includes("completed")) return "stage";
  if (t.includes("payment") || t.includes("invoice")) return "payment";
  if (t.includes("document") || t.includes("upload")) return "document";
  if (t.includes("issue") || t.includes("risk")) return "issue";
  return "edit";
};

function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <div className="py-8 text-center text-sm text-slate-400">No activity yet.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {items.map((a, i) => {
        const [Icon, tone] = ACTIVITY_ICON[a.kind];
        return (
          <div key={i} className="flex items-start gap-3 py-2.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-800 truncate" title={a.details ? `${a.activity}: ${a.details}` : a.activity}>
                {a.activity}{a.details ? <>: <span className="font-semibold">{a.details}</span></> : null}
              </div>
              {a.by && <div className="text-xs text-slate-400 truncate">by {a.by}</div>}
            </div>
            {a.date && <div className="text-[11px] text-slate-400 whitespace-nowrap pt-0.5" title={format(new Date(a.date), 'dd MMM yyyy, hh:mm a')}>{formatDistanceToNow(new Date(a.date), { addSuffix: true })}</div>}
          </div>
        );
      })}
    </div>
  );
}

// The 12 operational sections grouped into 5 task-shaped areas, so the tab bar reads as
// "where in the project am I working" instead of a wall of equal chips. Each section keeps its
// own content block untouched — this is purely how they're navigated.
const TAB_GROUPS: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; sections: [string, string][] }[] = [
  { id: "overview", label: "Overview", icon: ClipboardList, sections: [["overview", "Overview"]] },
  { id: "execution", label: "Execution", icon: Layers, sections: [["workProgress", "Execution & Installation"]] },
  { id: "commercial", label: "Commercial", icon: Wallet, sections: [
    ["payments", "Billing & Payments"], ["received", "Payments"], ["profit", "Expenses & Profit"],
    ["quote", "Quotation"], ["approvals", "Approvals & Changes"], ["changeRequests", "Change Requests"],
  ] },
  { id: "resources", label: "Resources", icon: Package, sections: [
    ["purchaseOrders", "Purchase Orders"], ["goodsReceived", "Goods Received"],
  ] },
  { id: "documents", label: "Documents", icon: FileText, sections: [["media", "Documents"]] },
  { id: "activity", label: "Activity", icon: History, sections: [["activity", "Activity"]] },
  // Shown only once the project is COMPLETED (see the tab-strip filter below).
  { id: "service", label: "Service & Warranty", icon: Settings, sections: [["serviceWarranty", "Service & Warranty"]] },
];
// Reachable from inside another section (Work Categories → "Floors & rooms view"), not the strip.
const HIDDEN_SECTIONS = new Set(["phases", "changeRequests", "received", "profit"]);
// Old section keys that now live inside another section's screen — highlight that section instead.
const SECTION_ALIAS: Record<string, string> = { received: "payments", profit: "payments", changeRequests: "approvals" };
// Retired Resources sections — old ?tab= links land on Purchase Orders instead.
const RETIRED_SECTIONS: Record<string, string> = {
  supplyInstall: "purchaseOrders", materials: "purchaseOrders", contractors: "purchaseOrders", labour: "purchaseOrders",
  // Handover moved into the Mark Completed dialog.
  handover: "overview",
  // Execution is just "Execution & Installation" now (products, installation, daily log, chat, history).
  fieldProgress: "workProgress", workCategories: "workProgress", execution: "workProgress",
  reports: "workProgress", quality: "workProgress", phases: "workProgress",
};
const groupOf = (section: string) =>
  TAB_GROUPS.find((g) => g.sections.some(([v]) => v === section)) || TAB_GROUPS[0];

export default function ProjectCommandCenter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack("/projects");
  const projectId = Number(id);
  // ?tab=<section> deep-links straight to a section (e.g. ?tab=quote from an old BOQ link).
  const [activeTab, setActiveTab] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get("tab");
    const t = raw && (RETIRED_SECTIONS[raw] || raw);
    return t && TAB_GROUPS.some((g) => g.sections.some(([v]) => v === t)) ? t : "overview";
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Phases & Rooms — measurement-style card grid + modal editors.
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [roomsByPhase, setRoomsByPhase] = useState<Record<number, ProjectRoom[]>>({});
  const [itemsByRoom, setItemsByRoom] = useState<Record<number, ProjectRoomItem[]>>({});
  const [allItemsBrief, setAllItemsBrief] = useState<import("@/api/projectApi").ProjectItemBrief[]>([]);
  // Modal editors (mirrors the measurement Rooms tab: add/edit via dialogs, detail in a dialog)
  const [phaseDialog, setPhaseDialog] = useState<{ open: boolean; phase: ProjectPhase | null }>({ open: false, phase: null });
  const [roomDialog, setRoomDialog] = useState<{ open: boolean; phaseId: number | null; room: ProjectRoom | null }>({ open: false, phaseId: null, room: null });
  const [detailRoom, setDetailRoom] = useState<{ room: ProjectRoom; phaseId: number } | null>(null);
  // Room-wise (card grid) vs Item-wise (flat work-item list) — mirrors the measurement Rooms tab toggle.
  const [phaseView, setPhaseView] = useState<'rooms' | 'items'>(
    () => (localStorage.getItem('projectPhaseView') as 'rooms' | 'items') || 'rooms');
  useEffect(() => { try { localStorage.setItem('projectPhaseView', phaseView); } catch { /* ignore */ } }, [phaseView]);
  const [masterBoq, setMasterBoq] = useState<any>(null);
  const [profitability, setProfitability] = useState<ProjectProfitability | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false); // "Update Work" batch sheet
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false); // full measurement & quotation workspace
  const [reportsPending, setReportsPending] = useState(0);
  const loadReportsPending = () => {
    dailyReportApi.list({ projectId: Number(id), status: 'SUBMITTED' }).then((r) => setReportsPending(r.length)).catch(() => {});
  };
  useEffect(loadReportsPending, [id]);
  const [scrolled, setScrolled] = useState(false); // collapses the big header into a compact sticky bar

  // "Build from approved quotation" picker (replaces the old blind "Generate from BOQ" button)
  const [quotationPicker, setQuotationPicker] = useState<{ open: boolean; list: AvailableQuotation[]; loading: boolean; selectedId: number | null; generating: boolean }>(
    { open: false, list: [], loading: false, selectedId: null, generating: false });

  // Inline editing of the Overview card (key facts + budget + description/address/requirements)
  const [editingOverview, setEditingOverview] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [pform, setPform] = useState<Record<string, any>>({});

  // Progress tracking: live dashboard + work-item editor
  const [progressDashboard, setProgressDashboard] = useState<ProjectProgressDashboard | null>(null);
  const [editingItem, setEditingItem] = useState<ProjectRoomItem | null>(null);
  const [itemForm, setItemForm] = useState<{ progress: number; status: string; remarks: string }>({ progress: 0, status: 'PENDING', remarks: '' });
  const [itemPhotos, setItemPhotos] = useState<string[]>([]);
  const [itemTimeline, setItemTimeline] = useState<ProjectItemProgressLog[]>([]);
  const [savingItem, setSavingItem] = useState(false);
  const [itemPhotoUploading, setItemPhotoUploading] = useState(false);

  // Field tasks — source for the FAB "assign resource" picker and the Field Progress tab (which
  // lazy-loads its own per-task assignments/execution detail).
  const [fieldTasks, setFieldTasks] = useState<any[]>([]);

  // Materials
  const [materials, setMaterials] = useState<ProjectMaterialRequirement[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [newMaterial, setNewMaterial] = useState({ productId: '', requiredQty: 0, unit: '' });

  // Materials — stock movements, purchase summary, new product
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [materialTransactions, setMaterialTransactions] = useState<any[]>([]);
  const [purchaseSummary, setPurchaseSummary] = useState<any[]>([]);
  const [materialUsage, setMaterialUsage] = useState<any[]>([]);
  const [stockMove, setStockMove] = useState<{ open: boolean; direction: 'IN' | 'OUT'; productId: string; type: string; quantity: number; warehouseId: string; reference: string }>(
    { open: false, direction: 'IN', productId: '', type: 'PURCHASE', quantity: 1, warehouseId: '', reference: '' });
  const [newProduct, setNewProduct] = useState({ open: false, name: '', unit: '', costPrice: '', sellingPrice: '', brand: '' });

  // Per-material quantity editor (replaces the old type-and-blur inline cells)
  const [matEdit, setMatEdit] = useState<{ open: boolean; id: number | null; productName: string; requiredQty: number; reservedQty: number; issuedQty: number; returnedQty: number; consumedQty: number }>(
    { open: false, id: null, productName: '', requiredQty: 0, reservedQty: 0, issuedQty: 0, returnedQty: 0, consumedQty: 0 });
  const [savingMat, setSavingMat] = useState(false);

  // Change Requests (list only; the tab owns its own create/decision form state)
  const [changeRequests, setChangeRequests] = useState<ProjectChangeRequest[]>([]);

  // Form states for dialogs still owned by this shell (Add Stage + the FAB's Report Issue quick action)
  const [newIssue, setNewIssue] = useState({ title: '', description: '', priority: 'MEDIUM' });

  // Quick Actions states
  const [quickActionView, setQuickActionView] = useState<'menu'|'create_task'|'assign_employee'|'report_issue'|'purchase_request'>('menu');
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [newTaskState, setNewTaskState] = useState({ taskName: '', description: '', dueDate: format(new Date(), 'yyyy-MM-dd') });
  const [newAssignState, setNewAssignState] = useState<{ taskId: string; resource: ResourceSelection | null }>({ taskId: '', resource: null });
  const [newPurchaseState, setNewPurchaseState] = useState({ itemDesc: '', quantity: 1 });

  // Assign Team — smart-recommend the best 2 people for the project; user picks the pair
  // and they're assigned as workforce resources on a project task (smart-assignment engine).
  const [teamDialog, setTeamDialog] = useState(false);
  const [teamPicks, setTeamPicks] = useState<EmployeeRecommendation[]>([]);
  const [teamSel, setTeamSel] = useState<Record<string, boolean>>({});
  const [teamTopKeys, setTeamTopKeys] = useState<Set<string>>(new Set());
  const [teamShowOthers, setTeamShowOthers] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  // The core project blob (`data`) — overview, stages, daily logs, issues, risks, quality checks,
  // approvals and documents all come from this single GET. Mutations that only touch those
  // sub-records refresh with fetchCore() instead of re-pulling all ~13 endpoints.
  const fetchCore = () => {
    api.get(`/projects/${id}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
        if (res.data?.boq?.id) {
          boqApi.getMaster(res.data.boq.id).then(setMasterBoq).catch(err => console.error("Failed to fetch master BOQ", err));
        }
      })
      .catch(err => {
        console.error("Failed to fetch project", err);
        setLoading(false);
      });
  };

  const fetchStats = () => {
    api.get(`/projects/${id}/command-center-stats`).then(res => setStats(res.data)).catch(err => console.error("Failed to fetch stats", err));
  };

  // Full reload — used on first mount and after cross-cutting changes (e.g. change requests that
  // cascade to phases, materials and the quotation).
  const fetchProjectData = () => {
    fetchCore();
    fetchStats();
    projectApi.getProgressDashboard(projectId).then(setProgressDashboard).catch(err => console.error("Failed to fetch progress dashboard", err));
    projectApi.getPhases(projectId).then(list => {
      setPhases(list);
      // Card-grid design — every phase shows its room cards, so load all rooms up front.
      list.map(p => p.id!).filter(Boolean).forEach(pid => loadRooms(pid).catch(() => {}));
    }).catch(err => console.error("Failed to fetch phases", err));
    loadAllItemsBrief();
    projectApi.getMaterials(projectId).then(setMaterials).catch(err => console.error("Failed to fetch materials", err));
    api.get(`/inventory/products`).then(res => setProducts(res.data.content || [])).catch(() => {});
    inventoryApi.getWarehouses().then(setWarehouses).catch(() => {});
    projectApi.getMaterialTransactions(projectId).then(setMaterialTransactions).catch(() => {});
    projectApi.getMaterialPurchaseSummary(projectId).then(setPurchaseSummary).catch(() => {});
    projectApi.getTaskMaterialUsage(projectId).then(setMaterialUsage).catch(() => {});
    changeRequestApi.getByProject(projectId).then(setChangeRequests).catch(err => console.error("Failed to fetch change requests", err));
    api.get(`/tasks/project/${projectId}`).then(res => setFieldTasks(res.data)).catch(err => console.error("Failed to fetch field tasks", err));
    // Re-syncs project expenses server-side, so "Amount Spent" reflects live purchases/payments.
    financeApi.getProjectProfitability(projectId).then(setProfitability).catch(() => {});
  };

  const handleQuickCreateTask = () => {
     api.post(`/tasks`, { project: { id: projectId }, status: 'PENDING', priority: 'MEDIUM', ...newTaskState })
       .then(() => { setQuickActionOpen(false); setQuickActionView('menu'); fetchProjectData(); })
       .catch(err => console.error(err));
  };
  const handleQuickAssign = () => {
     if (!newAssignState.taskId || !newAssignState.resource) return;
     employeeTaskApi.assignResources(Number(newAssignState.taskId), [{
       resourceType: newAssignState.resource.resourceType,
       resourceId: newAssignState.resource.resourceId,
     }])
       .then(() => { setQuickActionOpen(false); setQuickActionView('menu'); setNewAssignState({ taskId: '', resource: null }); fetchProjectData(); })
       .catch(err => toast.error(err?.response?.data?.message || 'Failed to assign resource'));
  };

  // --- Assign Team: recommend the best 2 people, pick the pair, assign to a project task ----
  const teamKey = (p: { resourceType: string; resourceId: number }) => `${p.resourceType}:${p.resourceId}`;
  const loadTeamPicks = (taskId?: string) => {
    setTeamLoading(true);
    smartAssignmentApi.recommend({
      projectId: Number(projectId),
      taskId: taskId ? Number(taskId) : null,
      requiredCount: 2,
    })
      .then((res) => {
        const all = res.recommendations?.length ? res.recommendations : (res.topPicks || []);
        const top = (res.topPicks?.length ? res.topPicks : all).slice(0, 2);
        const topKeys = new Set(top.map(teamKey));
        // Top 2 first (pre-selected), then the rest of the eligible people to swap in.
        const ordered = [...top, ...all.filter((p) => !topKeys.has(teamKey(p)))];
        setTeamPicks(ordered);
        setTeamTopKeys(topKeys);
        setTeamSel(Object.fromEntries(top.map((p) => [teamKey(p), true])));
        setTeamShowOthers(false);
      })
      .catch((err) => { setTeamPicks([]); setTeamTopKeys(new Set()); toast.error(err?.response?.data?.message || 'Failed to load recommendations'); })
      .finally(() => setTeamLoading(false));
  };
  const openAssignTeam = () => {
    setTeamDialog(true);
    setTeamPicks([]);
    setTeamSel({});
    loadTeamPicks();
  };
  // The picked pair becomes the project's leadership: highest suitability → Project Manager,
  // second → Assistant Manager. Saved onto the project's roles (not a task assignment).
  const handleAssignTeam = () => {
    const chosen = teamPicks
      .filter((p) => teamSel[teamKey(p)])
      .sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    if (!chosen.length) { toast.error('Pick at least one person'); return; }
    const pm = chosen[0];
    const am = chosen[1]; // optional — a single pick just sets the Project Manager
    if (!pm.userId) { toast.error(`${pm.name} has no linked user account and can't be set as Project Manager`); return; }
    if (am && !am.userId) { toast.error(`${am.name} has no linked user account and can't be set as Assistant Manager`); return; }
    setTeamSaving(true);
    api.put(`/projects/${projectId}/team`, {
      projectManagerId: pm.userId,
      assistantManagerId: am ? am.userId : null,
    })
      .then(() => { toast.success('Team assigned'); setTeamDialog(false); fetchCore(); })
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to assign team'))
      .finally(() => setTeamSaving(false));
  };

  const handleQuickIssue = () => {
     api.post(`/projects/${projectId}/issues`, newIssue)
       .then(() => { setQuickActionOpen(false); setQuickActionView('menu'); fetchCore(); fetchStats(); })
       .catch(err => console.error(err));
  };
  const handleQuickPurchase = () => {
     api.post(`/projects/${projectId}/purchases`, newPurchaseState)
       .then(() => { setQuickActionOpen(false); setQuickActionView('menu'); fetchProjectData(); })
       .catch(err => console.error(err));
  };

  const loadRooms = (phaseId: number) =>
    projectApi.getRooms(phaseId).then(rooms => setRoomsByPhase(prev => ({ ...prev, [phaseId]: rooms })));
  const loadItems = (roomId: number) =>
    projectApi.getItems(roomId).then(items => setItemsByRoom(prev => ({ ...prev, [roomId]: items })));
  const loadAllItemsBrief = () =>
    projectApi.getAllItems(projectId).then(setAllItemsBrief).catch(() => {});

  const handleDeletePhase = (phaseId: number) => {
    if (!window.confirm("Delete this phase and all its rooms & work items? This cannot be undone.")) return;
    projectApi.deletePhase(phaseId)
      .then(() => { setPhases(prev => prev.filter(p => p.id !== phaseId)); loadAllItemsBrief(); toast.success("Phase deleted"); })
      .catch(() => toast.error("Failed to delete phase"));
  };

  const handleDeleteRoom = (room: ProjectRoom, phaseId: number) => {
    if (!window.confirm(`Delete room "${room.roomName}" and its work items?`)) return;
    projectApi.deleteRoom(room.id!)
      .then(() => { loadRooms(phaseId); loadAllItemsBrief(); toast.success("Room deleted"); })
      .catch(() => toast.error("Failed to delete room"));
  };

  // A phase/room/item change rolls up to the whole project — refresh the affected branch + counts.
  const refreshPhaseTree = (phaseId?: number) => {
    projectApi.getPhases(projectId).then(setPhases).catch(() => {});
    if (phaseId) loadRooms(phaseId);
    loadAllItemsBrief();
    projectApi.getProgressDashboard(projectId).then(setProgressDashboard).catch(() => {});
  };

  // Item-wise view uses lightweight briefs; fetch the full item before opening the editor so its
  // photos/remarks are preserved on save (the editor overwrites photos from what it loaded).
  const openItemBrief = (b: import("@/api/projectApi").ProjectItemBrief) => {
    if (!b.id || !b.roomId) return;
    projectApi.getItems(b.roomId).then(items => {
      setItemsByRoom(prev => ({ ...prev, [b.roomId!]: items }));
      const full = items.find(i => i.id === b.id);
      if (full) openItemEditor(full);
    }).catch(() => toast.error("Failed to open work item"));
  };
  const deleteItemBrief = (b: import("@/api/projectApi").ProjectItemBrief) => {
    if (b.locked) { toast.error("This item is locked (from the BOQ) and cannot be deleted."); return; }
    if (!window.confirm(`Delete work item "${b.itemName}"?`)) return;
    projectApi.deleteItem(b.id)
      .then(() => { refreshPhaseTree(b.phaseId); toast.success("Work item deleted"); })
      .catch(() => toast.error("Failed to delete work item"));
  };

  // ---- Work-item progress editing + rollup refresh --------------------------
  const parsePhotos = (raw?: string): string[] => {
    if (!raw) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  };

  // A work-item change rolls up to its room, phase and the whole project — refresh all of it.
  const refreshAfterItemChange = (roomId: number, phaseId: number) => {
    projectApi.getItems(roomId).then(items => setItemsByRoom(prev => ({ ...prev, [roomId]: items })));
    projectApi.getRooms(phaseId).then(rooms => setRoomsByPhase(prev => ({ ...prev, [phaseId]: rooms })));
    projectApi.getPhases(projectId).then(setPhases);
    projectApi.getProgressDashboard(projectId).then(setProgressDashboard).catch(() => {});
  };

  const openItemEditor = (item: ProjectRoomItem) => {
    setEditingItem(item);
    setItemForm({ progress: item.progress ?? 0, status: item.status ?? 'PENDING', remarks: '' });
    setItemPhotos(parsePhotos(item.photos));
    setItemTimeline([]);
    if (item.id) projectApi.getItemTimeline(item.id).then(setItemTimeline).catch(() => {});
  };

  const handleItemPhotoUpload = async (file: File) => {
    setItemPhotoUploading(true);
    try {
      const { fileUrl } = await uploadFile(file, 'PROJECT');
      setItemPhotos(prev => [...prev, fileUrl]);
    } catch {
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setItemPhotoUploading(false);
    }
  };

  const handleSaveItemProgress = () => {
    if (!editingItem?.id) return;
    setSavingItem(true);
    projectApi.updateItemProgress(editingItem.id, {
      progress: itemForm.progress,
      status: itemForm.status,
      remarks: itemForm.remarks,
      photos: JSON.stringify(itemPhotos),
    })
      .then(() => {
        const roomId = (editingItem as any).room?.id ?? findRoomIdForItem(editingItem.id!);
        const phaseId = findPhaseIdForRoom(roomId);
        if (roomId && phaseId) refreshAfterItemChange(roomId, phaseId);
        setEditingItem(null);
      })
      .catch(err => toast.error(err?.response?.data?.message || "Failed to update work item"))
      .finally(() => setSavingItem(false));
  };

  // Assign/unassign a workforce resource (employee OR contractor) to the open work item.
  const handleAssignResource = (sel: ResourceSelection | null) => {
    if (!editingItem?.id) return;
    const payload = { ...editingItem, resourceType: sel?.resourceType, resourceId: sel?.resourceId };
    projectApi.updateItem(editingItem.id, payload as any)
      .then(updated => {
        setEditingItem(updated);
        const roomId = findRoomIdForItem(editingItem.id!);
        const phaseId = findPhaseIdForRoom(roomId);
        if (roomId && phaseId) refreshAfterItemChange(roomId, phaseId);
      })
      .catch(err => toast.error(err?.response?.data?.message || "Failed to update assignment"));
  };

  const handleReopenItem = () => {
    if (!editingItem?.id) return;
    setSavingItem(true);
    projectApi.reopenItem(editingItem.id)
      .then(() => {
        const roomId = findRoomIdForItem(editingItem.id!);
        const phaseId = findPhaseIdForRoom(roomId);
        if (roomId && phaseId) refreshAfterItemChange(roomId, phaseId);
        setEditingItem(null);
      })
      .catch(err => toast.error(err?.response?.data?.message || "Failed to reopen work item"))
      .finally(() => setSavingItem(false));
  };

  const findRoomIdForItem = (itemId: number): number => {
    for (const [rid, items] of Object.entries(itemsByRoom)) {
      if (items.some(i => i.id === itemId)) return Number(rid);
    }
    return 0;
  };
  const findPhaseIdForRoom = (roomId: number): number => {
    for (const [pid, rooms] of Object.entries(roomsByPhase)) {
      if (rooms.some(r => r.id === roomId)) return Number(pid);
    }
    return 0;
  };

  const applyGenerateResult = (result: GenerateFromBoqResult) => {
    const totalChanges = result.phasesCreated + result.roomsCreated + result.tasksCreated + result.materialsCreated;
    if (totalChanges === 0) {
      toast.info("Already in sync — nothing new to build. The selected quotation's BOQ has no new active items.");
    } else {
      toast.success(`Generated ${result.phasesCreated} phase(s), ${result.roomsCreated} room(s), ${result.tasksCreated} task(s), ${result.materialsCreated} material requirement(s).`);
    }
    projectApi.getPhases(projectId).then(setPhases);
    projectApi.getMaterials(projectId).then(setMaterials);
  };

  const openQuotationPicker = () => {
    setQuotationPicker(s => ({ ...s, open: true, loading: true, selectedId: null }));
    projectApi.getAvailableQuotations(projectId)
      .then(list => setQuotationPicker(s => ({
        ...s, list, loading: false,
        selectedId: list.find(q => q.isCurrent)?.id ?? list[0]?.id ?? null,
      })))
      .catch(() => { toast.error("Failed to load approved quotations"); setQuotationPicker(s => ({ ...s, loading: false })); });
  };

  const handleGenerateFromQuotation = () => {
    const qid = quotationPicker.selectedId;
    if (!qid) { toast.error("Select an approved quotation"); return; }
    setQuotationPicker(s => ({ ...s, generating: true }));
    projectApi.generateFromQuotation(projectId, qid)
      .then(result => {
        applyGenerateResult(result);
        fetchCore(); // project.boq/quotation was re-linked — refresh the BOQ summary card
        setQuotationPicker(s => ({ ...s, open: false, generating: false }));
      })
      .catch(err => {
        toast.error(err?.response?.data?.message || err?.message || "Failed to build from the selected quotation");
        setQuotationPicker(s => ({ ...s, generating: false }));
      });
  };

  const handleAddMaterial = () => {
    if (!newMaterial.productId) { toast.error("Select a product"); return; }
    projectApi.addMaterial(projectId, {
      product: { id: Number(newMaterial.productId) },
      requiredQty: Number(newMaterial.requiredQty),
      unit: newMaterial.unit,
    })
      .then(m => {
        setMaterials(prev => [...prev, m]);
        setNewMaterial({ productId: '', requiredQty: 0, unit: '' });
      })
      .catch(() => toast.error("Failed to add material requirement"));
  };

  const openMatEdit = (m: ProjectMaterialRequirement) => {
    setMatEdit({
      open: true, id: m.id ?? null, productName: m.product?.name || 'Material', requiredQty: Number(m.requiredQty) || 0,
      reservedQty: Number(m.reservedQty) || 0, issuedQty: Number(m.issuedQty) || 0,
      returnedQty: Number(m.returnedQty) || 0, consumedQty: Number(m.consumedQty) || 0,
    });
  };

  const handleSaveMatEdit = () => {
    if (matEdit.id == null) return;
    const { reservedQty, issuedQty, returnedQty, consumedQty } = matEdit;
    if ([reservedQty, issuedQty, returnedQty, consumedQty].some(v => v < 0)) { toast.error("Quantities cannot be negative"); return; }
    if (returnedQty + consumedQty > issuedQty) { toast.error("Returned + consumed cannot exceed issued"); return; }
    const material = materials.find(m => m.id === matEdit.id);
    if (!material) return;
    setSavingMat(true);
    projectApi.updateMaterial(matEdit.id, { ...material, reservedQty, issuedQty, returnedQty, consumedQty })
      .then(updated => {
        setMaterials(prev => prev.map(m => m.id === matEdit.id ? updated : m));
        setMatEdit(s => ({ ...s, open: false }));
        toast.success("Material updated");
      })
      .catch(() => toast.error("Failed to update material"))
      .finally(() => setSavingMat(false));
  };

  const refreshMaterialData = () => {
    projectApi.getMaterials(projectId).then(setMaterials).catch(() => {});
    projectApi.getMaterialTransactions(projectId).then(setMaterialTransactions).catch(() => {});
    projectApi.getMaterialPurchaseSummary(projectId).then(setPurchaseSummary).catch(() => {});
    projectApi.getTaskMaterialUsage(projectId).then(setMaterialUsage).catch(() => {});
  };

  const openStockMove = (direction: 'IN' | 'OUT', productId?: number) => {
    setStockMove({
      open: true,
      direction,
      productId: productId ? String(productId) : '',
      type: direction === 'IN' ? 'PURCHASE' : 'CONSUMPTION',
      quantity: 1,
      warehouseId: warehouses[0]?.id ? String(warehouses[0].id) : '',
      reference: '',
    });
  };

  const handleRecordStock = () => {
    if (!stockMove.productId) { toast.error("Select a material"); return; }
    if (!stockMove.warehouseId) { toast.error("Select a warehouse"); return; }
    if (!stockMove.quantity || stockMove.quantity <= 0) { toast.error("Quantity must be greater than zero"); return; }
    const isInbound = stockMove.direction === 'IN';
    const payload: Record<string, unknown> = {
      type: stockMove.type,
      quantity: Number(stockMove.quantity),
      reference: stockMove.reference || null,
      product: { id: Number(stockMove.productId) },
      sourceWarehouse: isInbound ? null : { id: Number(stockMove.warehouseId) },
      destinationWarehouse: isInbound ? { id: Number(stockMove.warehouseId) } : null,
    };
    projectApi.recordMaterialTransaction(projectId, payload)
      .then(() => {
        setStockMove(s => ({ ...s, open: false }));
        refreshMaterialData();
      })
      .catch((err) => toast.error(err?.response?.data?.message || "Failed to record stock movement"));
  };

  const handleCreateProduct = () => {
    if (!newProduct.name.trim()) { toast.error("Product name is required"); return; }
    inventoryApi.createProduct({
      name: newProduct.name.trim(),
      unit: newProduct.unit || undefined,
      costPrice: newProduct.costPrice ? Number(newProduct.costPrice) : undefined,
      sellingPrice: newProduct.sellingPrice ? Number(newProduct.sellingPrice) : undefined,
      brand: newProduct.brand || undefined,
    } as any)
      .then((p) => {
        setProducts(prev => [p, ...prev]);
        setNewProduct({ open: false, name: '', unit: '', costPrice: '', sellingPrice: '', brand: '' });
        toast.success(`Product "${p.name}" created (${p.materialCode || 'new'}).`);
      })
      .catch((err) => toast.error(err?.response?.data?.message || "Failed to create product"));
  };

  const handleRequestMaterial = (m: ProjectMaterialRequirement) => {
    if (!m.product?.id) return;
    inventoryApi.createMaterialRequest({
      projectId,
      items: [{ productId: m.product.id, quantity: Number(m.remainingQty) || 1 }],
      remarks: `Project material requirement #${m.id}`,
    })
      .then(() => toast.success("Material request raised — visible under Inventory > Material Requests."))
      .catch((err) => toast.error(err?.response?.data?.message || "Failed to raise material request"));
  };

  const handleRequestPurchase = (reqId: number) => {
    projectApi.requestPurchase(reqId)
      .then(() => {
        toast.success("Purchase order created.");
        projectApi.getMaterials(projectId).then(setMaterials);
      })
      .catch((err) => toast.error(err?.response?.data?.message || err?.message || "Failed to request purchase"));
  };

  // Mark Completed opens the handover dialog (photos + client approval + delivery confirmation).
  const [completeOpen, setCompleteOpen] = useState(false);
  const handleCompleteProject = () => setCompleteOpen(true);

  const handleStartExecution = () => {
    api.post(`/projects/${id}/start-execution`)
      .then(() => fetchProjectData())
      .catch((err: any) => toast.error(err?.response?.data?.message || "Failed to start execution"));
  };

  if (loading) return <div className="p-8 text-slate-500">Loading Command Center...</div>;
  if (!data || !data.project) return <div className="p-8 text-red-500">Project not found</div>;

  const { project, stages, dailyLogs, qualityChecks, issues, risks, documents } = data;
  const summary: ProjectHeaderSummary = data.summary || {};
  // Estimate budget is taken from the approved BOQ's grand total (falls back to the linked BOQ
  // revision, then the manual budget/estimate). Amount spent comes from live project expenses.
  const approvedBoqId: number | null = masterBoq?.id ?? data?.boq?.id ?? null;
  const boqEstimate = Number(masterBoq?.grandTotal ?? data?.boq?.grandTotal ?? project.budget ?? project.estimatedCost ?? 0);
  const spentAmount = Number(profitability?.totalExpenses ?? project.spentAmount ?? 0);
  const profitOrLoss = boqEstimate - spentAmount;
  const utilizationPct = boqEstimate ? Math.round((spentAmount / boqEstimate) * 100) : 0;

  const inr = (n?: number | null) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const shortDate = (iso?: string) => iso ? format(new Date(iso), 'dd MMM yyyy') : '—';
  const daysRemaining = project.endDate ? differenceInDays(new Date(project.endDate), new Date()) : null;

  // --- Inline overview editing -------------------------------------------------
  // updateProject is a full replace, so we merge the edited fields onto the whole project object.
  const startEdit = (_which?: 'overview' | 'details') => {
    setPform({
      projectType: project.projectType ?? '',
      projectCategory: project.projectCategory ?? '',
      priority: project.priority ?? 'MEDIUM',
      startDate: project.startDate ? String(project.startDate).slice(0, 10) : '',
      endDate: project.endDate ? String(project.endDate).slice(0, 10) : '',
      estimatedCost: project.estimatedCost ?? '',
      budget: project.budget ?? '',
      propertyAddress: project.propertyAddress ?? '',
      projectDescription: project.projectDescription ?? '',
      customerNotes: project.customerNotes ?? '',
    });
    setEditingOverview(true);
  };

  const num = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));

  const saveProjectFields = (patch: Record<string, any>, done: () => void) => {
    setSavingProject(true);
    // Send scalars only, plus id-refs for the four links updateProject copies. Echoing the full
    // nested customer/lead/measurement graph back made the server reject the body (400).
    const ref = (o: any) => (o?.id ? { id: o.id } : null);
    const scalars = Object.fromEntries(
      Object.entries(project).filter(([, v]) => v === null || typeof v !== 'object'));
    api.put(`/projects/${id}`, {
      ...scalars,
      customer: ref(project.customer), lead: ref(project.lead),
      siteVisit: ref(project.siteVisit), measurement: ref(project.measurement),
      ...patch,
    })
      .then(() => { fetchCore(); toast.success("Project updated"); done(); })
      .catch(err => toast.error(err?.response?.data?.message || "Failed to update project"))
      .finally(() => setSavingProject(false));
  };

  // One Edit on Project Overview now persists the key facts AND the descriptive fields.
  const saveOverview = () => saveProjectFields({
    projectType: pform.projectType || null,
    projectCategory: pform.projectCategory || null,
    priority: pform.priority || null,
    startDate: pform.startDate || null,
    endDate: pform.endDate || null,
    estimatedCost: num(pform.estimatedCost),
    budget: num(pform.budget),
    propertyAddress: pform.propertyAddress || null,
    projectDescription: pform.projectDescription || null,
    customerNotes: pform.customerNotes || null,
  }, () => setEditingOverview(false));

  const daysRemainingText = daysRemaining === null ? '—' : daysRemaining < 0 ? `${Math.abs(daysRemaining)} Days Over` : `${daysRemaining} Days`;

  // Activity — the project's own activity log plus events synthesized from its sub-records, newest first.
  const activityFeed: ActivityItem[] = (() => {
    const items: ActivityItem[] = [];
    (data.activityLogs || []).forEach((l: any) => l.description && items.push({ date: l.time, activity: l.description, by: l.user?.name || l.role, kind: activityKindOf(l.description) }));
    (dailyLogs || []).forEach((l: any) => items.push({ date: l.logDate, activity: 'Daily log', by: l.createdBy?.name || l.recordedBy?.name, details: l.workCompleted || `${l.percentageCompleted ?? 0}% completed`, kind: 'log' }));
    (issues || []).forEach((i: any) => items.push({ date: i.createdAt || i.reportedDate, activity: 'Issue reported', by: i.reportedBy?.name || i.createdBy?.name, details: i.title || i.description, kind: 'issue' }));
    (stages || []).forEach((s: any) => s.name && items.push({ date: s.completedDate || s.dueDate, activity: s.status === 'COMPLETED' ? 'Stage completed' : 'Stage updated', details: s.name, kind: 'stage' }));
    (documents || []).forEach((d: any) => items.push({ date: d.createdAt || d.uploadedAt, activity: 'Document added', by: d.uploadedBy?.name, details: d.fileName || d.documentName || 'Document', kind: 'document' }));
    return items
      .filter((x) => x.date)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  })();

  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative overflow-hidden">
      {/* Single smooth-scroll surface: the whole top scrolls away, only the tab bar pins. */}
      <div onScroll={(e) => setScrolled((e.target as HTMLDivElement).scrollTop > 120)} className="flex-1 overflow-y-auto scroll-smooth @container">

      {/* Breadcrumb */}
      <div className="px-4 sm:px-6 lg:px-8 pt-3 shrink-0 z-10">
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <Link to="/" className="hover:text-emerald-600 flex items-center gap-1"><Home className="w-3.5 h-3.5" /></Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/projects" className="hover:text-emerald-600">Projects</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-600 font-medium truncate">{project.customer?.name || project.projectCode}</span>
        </div>
      </div>

      {/* Premium header band */}
      <div className="px-4 sm:px-6 lg:px-8 pt-2 shrink-0 z-10">
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-white via-white to-emerald-50/60 px-4 sm:px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="relative grid grid-cols-1 @4xl:grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <button type="button" onClick={goBack} title="Back"
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-slate-900 hover:border-slate-300">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="min-w-0 max-w-full text-xl sm:text-2xl lg:text-[28px] font-bold tracking-tight text-slate-900 truncate">{summary.customerName || project.customer?.name || project.projectName}</h1>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${STATUS_PILL[project.status] || STATUS_PILL.PLANNING}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {project.status.replace(/_/g, ' ')}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {['PLANNING', 'PENDING', 'APPROVED'].includes(project.status) && (
                        <DropdownMenuItem onSelect={handleStartExecution}><Play className="w-4 h-4 mr-2"/> Start Execution</DropdownMenuItem>
                      )}
                      {project.status !== 'COMPLETED' && (
                        <DropdownMenuItem onSelect={handleCompleteProject}><CheckCircle2 className="w-4 h-4 mr-2"/> Mark Completed</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {(stats?.health === 'WARNING' || stats?.health === 'CRITICAL') && (
                    <span className={`px-2.5 py-1 text-[11px] rounded-full font-bold uppercase tracking-wide ${
                      stats.health === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {stats.health === 'CRITICAL' ? 'Critical' : 'Warning'}
                    </span>
                  )}
                </div>
                <div className="-ml-[52px] mt-3 @xl:ml-0 @xl:mt-0"><ProjectInfoRow summary={summary} /></div>
              </div>
            </div>

            <div className="flex flex-col @2xl:flex-row @2xl:flex-wrap @4xl:flex-col items-stretch @2xl:items-center @4xl:items-end gap-3 min-w-0">
              <div className="flex items-center gap-2 @2xl:order-2 @4xl:order-none @2xl:ml-auto @4xl:ml-0">
                <Button variant="outline" title="Edit Project" className="h-11 shrink-0 rounded-xl border-slate-200 bg-white px-3.5 @lg:px-4 text-slate-700 font-semibold transition hover:-translate-y-px hover:shadow-sm" onClick={() => { setActiveTab('overview'); startEdit('overview'); }}>
                  <Pencil className="w-4 h-4 @lg:mr-2" /> <span className="hidden @lg:inline">Edit Project</span>
                </Button>
                {project.status !== 'COMPLETED' && (
                  <Button onClick={handleCompleteProject} className="h-11 flex-1 @2xl:flex-none whitespace-nowrap rounded-xl bg-emerald-800 hover:bg-emerald-900 px-5 font-semibold text-white shadow-[0_4px_14px_-4px_rgba(0,53,34,0.45)] transition hover:-translate-y-px">
                    <CheckCircle2 className="w-4 h-4 mr-2"/> Mark Completed
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl border-slate-200 text-slate-600 bg-white"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {['PLANNING', 'PENDING', 'APPROVED'].includes(project.status) && (
                      <>
                        <DropdownMenuItem onSelect={handleStartExecution}><Play className="w-4 h-4 mr-2"/> Start Execution</DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem asChild><Link to={`/tasks?projectId=${projectId}`}>View Tasks</Link></DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTrackingOpen(true)}>Customer Tracking Link</DropdownMenuItem>
                    {project.customer?.id && (
                      <DropdownMenuItem asChild><Link to={`/customers/${project.customer.id}`}>View Customer</Link></DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Date card — start date | days remaining */}
              <div className="flex items-stretch rounded-2xl bg-white border border-slate-100 shadow-sm divide-x divide-slate-100 @2xl:order-1 @4xl:order-none">
                <div className="flex items-center gap-3 px-3 @lg:px-4 py-2.5 flex-1 min-w-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shrink-0"><Calendar className="w-5 h-5" /></span>
                  <div>
                    <div className="text-[11px] font-medium text-slate-400 whitespace-nowrap">Start Date</div>
                    <div className="text-sm font-bold text-slate-800 whitespace-nowrap">{shortDate(project.startDate)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 @lg:px-4 py-2.5 flex-1 min-w-0">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${daysRemaining !== null && daysRemaining < 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-500'}`}><Clock className="w-5 h-5" /></span>
                  <div>
                    <div className="text-[11px] font-medium text-slate-400 whitespace-nowrap">Days Remaining</div>
                    <div className={`text-sm font-bold whitespace-nowrap ${daysRemaining !== null && daysRemaining < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{daysRemainingText}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ProjectJourneyBar stages={summary.journey || []} onOpen={() => setActiveTab('workProgress')} />
      </div>
      <TrackingLinkDialog projectId={Number(projectId)} open={trackingOpen} onOpenChange={setTrackingOpen} />

      <div className="flex flex-col">
        <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {(() => {
            const active = groupOf(activeTab);
            const issueCount = issues.length + risks.length;
            return (
              <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 mb-3 bg-slate-50/95 backdrop-blur-sm space-y-2">
                {/* Compact header — slides in on scroll so the project stays identifiable once the big header leaves */}
                <div className={`flex items-center justify-between gap-2 overflow-hidden transition-all duration-300 ${scrolled ? 'max-h-14 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <button type="button" onClick={goBack} title="Back" className="text-slate-400 hover:text-slate-600 shrink-0"><ArrowLeft className="h-4 w-4" /></button>
                    <span className="font-bold text-slate-800 truncate">{project.customer?.name || project.projectCode}</span>
                    {project.customer?.city && <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">· {project.customer.city}</span>}
                    <span className="px-2 py-0.5 text-[10px] rounded-full font-semibold uppercase bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 shrink-0">{project.status.replace(/_/g, ' ')}</span>
                  </div>
                  {project.status !== 'COMPLETED' && (
                    <Button size="sm" onClick={handleCompleteProject} className="bg-emerald-800 hover:bg-emerald-900 rounded-lg h-8 shrink-0"><CheckCircle2 className="w-4 h-4 mr-1.5"/> Mark Completed</Button>
                  )}
                </div>
                {/* Primary strip — the areas of work + Generate Report */}
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 bg-white p-1.5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-2xl flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {TAB_GROUPS.filter((g) => g.id !== "service" || project.status === "COMPLETED").map((g) => {
                      const isActive = g.id === active.id;
                      const Icon = g.icon;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setActiveTab(g.sections[0][0])}
                          className={`rounded-xl px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 shrink-0 ${isActive ? "bg-emerald-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                        >
                          <Icon className="w-4 h-4" />
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" title="Generate Report" className="h-[54px] px-3.5 @5xl:px-4 rounded-2xl border-slate-100 text-emerald-800 font-semibold bg-white shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <FileBarChart className="w-4 h-4 @5xl:mr-2 text-emerald-700" /> <span className="hidden @5xl:inline">Generate Report</span> <ChevronDown className="w-4 h-4 ml-1 @5xl:ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.print()}><FileBarChart className="w-4 h-4 mr-2" /> Print this page</DropdownMenuItem>
                      <DropdownMenuItem asChild><Link to="/reports">Open Reports</Link></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Secondary strip — sections inside the active area */}
                {active.sections.length > 1 && (
                  <div className="flex gap-1 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {active.sections.filter(([value]) => !HIDDEN_SECTIONS.has(value) || (value === activeTab && !SECTION_ALIAS[value])).map(([value, label]) => {
                      const isActive = value === (SECTION_ALIAS[activeTab] ?? activeTab);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setActiveTab(value)}
                          className={`rounded-lg px-3 py-1 text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "text-slate-500 hover:bg-slate-50"}`}
                        >
                          {label}
                          {value === "quality" && issueCount > 0 && (
                            <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-[10px] font-bold">{issueCount}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {groupOf(activeTab).id === 'commercial' && (() => {
            const pf = profitability;
            const contract = Number(pf?.quotationValue ?? project.estimatedCost ?? project.budget ?? 0);
            const received = Number(pf?.collected ?? 0);
            const due = Number(pf?.outstanding ?? 0);
            const collectedPct = contract ? Math.min(100, Math.round((received / contract) * 100)) : 0;
            const profit = pf ? Number(pf.cashProfit ?? 0) : null;
            const tiles: { label: string; value: string; sub: string; icon: React.ComponentType<{ className?: string }>; tone: string; valueTone?: string; go: string }[] = [
              { label: 'Contract Value', value: inr(contract), sub: 'approved quote', icon: FileText, tone: 'bg-emerald-50 text-emerald-700', go: 'quote' },
              { label: 'Invoiced', value: pf ? inr(pf.revenue) : '—', sub: contract && pf ? `${Math.round((Number(pf.revenue || 0) / contract) * 100)}% of contract` : 'bills raised', icon: FileBarChart, tone: 'bg-sky-50 text-sky-700', go: 'payments' },
              { label: 'Received', value: pf ? inr(received) : '—', sub: `${collectedPct}% collected`, icon: IndianRupee, tone: 'bg-emerald-50 text-emerald-700', go: 'received' },
              { label: 'Balance Due', value: pf ? inr(due) : '—', sub: due > 0 ? 'to collect' : 'nothing due', icon: Wallet, tone: due > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500', valueTone: due > 0 ? 'text-rose-700' : undefined, go: 'payments' },
              { label: 'Profit', value: profit === null ? '—' : inr(profit), sub: pf ? `${Number(pf.cashMarginPercent ?? 0).toFixed(1)}% margin · cash` : 'finance access needed', icon: Percent, tone: profit !== null && profit < 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700', valueTone: profit !== null && profit < 0 ? 'text-rose-700' : undefined, go: 'profit' },
            ];
            return (
              <div className="mb-3 space-y-2.5">
                <div className="grid grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5 gap-2.5">
                  {tiles.map((t, ti) => {
                    const [bg, fg] = t.tone.split(' ');
                    return (
                      <button key={t.label} type="button" onClick={() => setActiveTab(t.go)}
                        className={`${ti === 0 ? 'col-span-2 @3xl:col-span-1' : ''} min-w-0 text-left rounded-2xl border border-slate-100 bg-white px-3 @lg:px-3.5 py-2.5 @lg:py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:shadow-md ${activeTab === t.go ? 'ring-2 ring-emerald-200' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${bg} ${fg}`}><t.icon className="h-4 w-4" /></span>
                          <span className="text-xs font-semibold text-slate-500 truncate">{t.label}</span>
                        </div>
                        <div className={`mt-1.5 @lg:mt-2 text-base @lg:text-lg @5xl:text-xl font-bold leading-tight truncate ${t.valueTone || 'text-slate-900'}`}>{t.value}</div>
                        {t.label === 'Received' ? (
                          <div className="mt-1.5">
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${collectedPct}%` }} /></div>
                            <div className="mt-1 text-[11px] text-slate-400">{t.sub}</div>
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-slate-400 truncate">{t.sub}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {Number(pf?.excessPaid ?? 0) > 0 && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <div className="font-semibold">Customer has paid {inr(Number(pf?.excessPaid))} more than the contract value</div>
                      <div className="text-xs text-amber-800/80">Received {inr(received)} against a contract of {inr(Number(pf?.quotationValue ?? 0))} after a quote change. Refund it or adjust it against other work.</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="pb-20">
            
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-3 mt-0 h-full outline-none">
              {/* Row 1 — Project Overview · Project Progress · Financial Summary */}
              <div className="grid grid-cols-1 @3xl:grid-cols-2 @6xl:grid-cols-[1.15fr_1fr_1.15fr] gap-3 items-stretch">

                {/* Project Overview — key facts (inline editable) */}
                <div className={CARD}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className={CARD_TITLE}><ClipboardCheck className="w-5 h-5 text-emerald-700"/> Project Overview</h3>
                    {!editingOverview ? (
                      <button type="button" onClick={() => startEdit('overview')} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-700"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" onClick={saveOverview} disabled={savingProject} className="h-7 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs"><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingOverview(false)} className="h-7 rounded-lg text-xs">Cancel</Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-100">
                    {([
                      { k: 'projectType', icon: FileText, label: 'Project Type', view: project.projectType || '—',
                        edit: <BaseInput className={cellInput} value={pform.projectType} onChange={e => setPform({ ...pform, projectType: e.target.value })} placeholder="Residential, Commercial…" /> },
                      { k: 'projectCategory', icon: Building2, label: 'Property Type', view: project.projectCategory || '—',
                        edit: <BaseInput className={cellInput} value={pform.projectCategory} onChange={e => setPform({ ...pform, projectCategory: e.target.value })} placeholder="Apartment, Villa…" /> },
                      { k: 'priority', icon: Flag, label: 'Priority',
                        view: project.priority ? <span className="inline-block px-3 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase">{project.priority}</span> : '—',
                        edit: <select className={cellInput} value={pform.priority} onChange={e => setPform({ ...pform, priority: e.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}</select> },
                      { k: 'pm', icon: User, label: 'Project Manager', view: project.projectManager?.name ? <span className="text-emerald-800">{project.projectManager.name}</span> : '—' },
                      { k: 'endDate', icon: Calendar, label: 'Target Completion', view: shortDate(project.endDate),
                        edit: <BaseInput type="date" className={cellInput} value={pform.endDate} onChange={e => setPform({ ...pform, endDate: e.target.value })} /> },
                      { k: 'value', icon: IndianRupee, label: 'Project Value', view: project.estimatedCost ? inr(project.estimatedCost) : (project.budget ? inr(project.budget) : '—'),
                        edit: <BaseInput type="number" min={0} className={cellInput} value={pform.estimatedCost} onChange={e => setPform({ ...pform, estimatedCost: e.target.value })} placeholder="Estimated value" /> },
                    ] as { k: string; icon: React.ComponentType<{ className?: string }>; label: string; view: React.ReactNode; edit?: React.ReactNode }[]).map((f, i) => (
                      <div key={f.k} className={`py-2.5 ${i % 2 === 0 ? 'pr-4' : 'pl-4'} ${i >= 2 ? 'border-t border-slate-100' : ''}`}>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400"><f.icon className="w-3.5 h-3.5" /> {f.label}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800 break-words">{editingOverview && f.edit ? f.edit : f.view}</div>
                      </div>
                    ))}
                  </div>
                  {editingOverview && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">Start Date</div>
                        <BaseInput type="date" className={cellInput} value={pform.startDate} onChange={e => setPform({ ...pform, startDate: e.target.value })} />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">Budget</div>
                        <BaseInput type="number" min={0} className={cellInput} value={pform.budget} onChange={e => setPform({ ...pform, budget: e.target.value })} />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">Property Address</div>
                        <textarea className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={pform.propertyAddress} onChange={e => setPform({ ...pform, propertyAddress: e.target.value })} placeholder="Site / property address" />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">Description</div>
                        <textarea className="w-full min-h-[52px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={pform.projectDescription} onChange={e => setPform({ ...pform, projectDescription: e.target.value })} placeholder="Scope / description of the project" />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">Customer Requirements</div>
                        <textarea className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={pform.customerNotes} onChange={e => setPform({ ...pform, customerNotes: e.target.value })} placeholder="What the customer asked for" />
                      </div>
                    </div>
                  )}
                  {!editingOverview && project.projectDescription && (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500 whitespace-pre-line line-clamp-3">{project.projectDescription}</p>
                  )}
                </div>

                {/* Project Progress — donut + legend */}
                <div className={CARD}>
                  <h3 className={`${CARD_TITLE} mb-3`}><Activity className="w-5 h-5 text-emerald-700"/> Project Progress</h3>
                  <div className="flex items-center gap-4 @xl:gap-5">
                    <div className="relative h-28 w-28 @xl:h-32 @xl:w-32 shrink-0">
                      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="11" className="text-slate-200" />
                        <circle cx="50" cy="50" r="40" fill="none" strokeWidth="11" strokeLinecap="round"
                          className="text-emerald-600" stroke="currentColor"
                          strokeDasharray={2 * Math.PI * 40}
                          strokeDashoffset={2 * Math.PI * 40 * (1 - Math.min(100, project.progress || 0) / 100)} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-900 leading-none">{project.progress || 0}%</span>
                        <span className="text-[11px] text-slate-400 mt-1">Complete</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2.5 text-[13px] @xl:text-sm [&>div]:whitespace-nowrap">
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-300 shrink-0"/><span className="font-bold text-slate-800">{project.progress || 0}%</span><span className="text-slate-500">Execution</span></div>
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-600 shrink-0"/><span className="font-bold text-slate-800">{stats?.tasks?.completed ?? 0} of {stats?.tasks?.total ?? 0}</span><span className="text-slate-500">Tasks Completed</span></div>
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0"/><span className="font-bold text-slate-800">{stats?.tasks?.delayed ?? 0}</span><span className="text-slate-500">Delayed Tasks</span></div>
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-300 shrink-0"/><span className="font-bold text-slate-800">{stats?.tasks?.total ?? 0}</span><span className="text-slate-500">Total Tasks</span></div>
                    </div>
                  </div>
                  <div className="mt-3 text-right">
                    <button type="button" onClick={() => setActiveTab('workProgress')} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">View Tasks <ArrowRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* Financial Summary — estimate · spent · remaining */}
                <div className={`${CARD} @3xl:col-span-2 @6xl:col-span-1`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={CARD_TITLE}><Wallet className="w-5 h-5 text-emerald-700"/> Financial Summary</h3>
                    <button type="button" onClick={() => setActiveTab('payments')} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">View Details <ArrowRight className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { label: 'Estimate Budget', value: inr(boqEstimate), icon: Wallet, tone: 'bg-emerald-50 text-emerald-700', valueTone: 'text-slate-900',
                        onClick: () => approvedBoqId ? navigate(`/boq/${approvedBoqId}`) : setActiveTab('workProgress'), title: approvedBoqId ? 'Open the BOQ' : 'No BOQ linked yet' },
                      { label: 'Amount Spent', value: inr(spentAmount), icon: BarChart3, tone: 'bg-sky-50 text-sky-600', valueTone: 'text-slate-900',
                        onClick: () => setActiveTab('profit'), title: 'View expenses & profit' },
                      { label: 'Remaining', value: inr(profitOrLoss), icon: Percent, tone: profitOrLoss < 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600', valueTone: profitOrLoss < 0 ? 'text-rose-700' : 'text-slate-900',
                        onClick: () => setActiveTab('profit'), title: `${utilizationPct}% of the estimate used` },
                    ]).map((t) => (
                      <button key={t.label} type="button" onClick={t.onClick} title={t.title}
                        className={`text-left rounded-xl p-3 transition hover:brightness-[0.97] min-w-0 ${t.tone.split(' ')[0]}`}>
                        <t.icon className={`w-5 h-5 ${t.tone.split(' ')[1]}`} />
                        <div className={`mt-3 text-base xl:text-lg font-bold leading-tight truncate ${t.valueTone}`}>{t.value}</div>
                        <div className={`mt-1 text-[11px] font-medium truncate ${t.tone.split(' ')[1]}`} title={t.label}>{t.label}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-1.5 rounded-full transition-all ${profitOrLoss < 0 ? 'bg-rose-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, utilizationPct)}%` }} />
                    </div>
                    <div className="mt-1 text-right text-[11px] font-medium text-slate-400">{utilizationPct}% utilised</div>
                  </div>
                  {!boqEstimate && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-400"><IndianRupee className="w-3.5 h-3.5 shrink-0 mt-0.5"/> Create or link a BOQ to set the estimate budget and track profitability.</div>
                  )}
                </div>
              </div>

              {/* Row 2 — Recent Activity · (Quick Actions + Key Information + Team) */}
              <div className="grid grid-cols-1 @6xl:grid-cols-[1fr_1.4fr] gap-3 items-start">
                <div className={CARD}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={CARD_TITLE}><History className="w-5 h-5 text-emerald-700"/> Recent Activity</h3>
                    <button type="button" onClick={() => setActiveTab('activity')} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">View All <ArrowRight className="w-3.5 h-3.5" /></button>
                  </div>
                  <ActivityList items={activityFeed.slice(0, 6)} />
                </div>

                <div className="space-y-3">
                  {/* Quick Actions */}
                  <div className={`${CARD} @container`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={CARD_TITLE}><Zap className="w-5 h-5 text-amber-500"/> Quick Actions</h3>
                      <button type="button" onClick={() => { setQuickActionView('menu'); setQuickActionOpen(true); }} className="text-xs font-semibold text-slate-500 hover:text-emerald-700">More</button>
                    </div>
                    <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-2">
                      {([
                        { label: 'Add Task', icon: ClipboardList, cls: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100', onClick: () => { setQuickActionView('create_task'); setQuickActionOpen(true); } },
                        { label: 'Upload Document', icon: FileText, cls: 'bg-sky-50 text-sky-700 hover:bg-sky-100', onClick: () => setActiveTab('media') },
                        { label: 'Add Expense', icon: Wallet, cls: 'bg-amber-50 text-amber-800 hover:bg-amber-100', onClick: () => setActiveTab('profit') },
                        { label: 'Create Invoice', icon: FileBarChart, cls: 'bg-rose-50 text-rose-700 hover:bg-rose-100', onClick: () => setActiveTab('payments') },
                      ]).map((a) => (
                        <button key={a.label} type="button" onClick={a.onClick}
                          className={`flex items-center justify-center gap-2 rounded-xl px-2.5 py-3 text-[13px] font-medium leading-tight text-center transition-all duration-200 hover:-translate-y-px ${a.cls}`}>
                          <a.icon className="w-4 h-4 shrink-0" /> <span>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Key Information */}
                  <div className={`${CARD} @container`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={CARD_TITLE}><Info className="w-5 h-5 text-slate-500"/> Key Information</h3>
                      {project.customer?.id && (
                        <Link to={`/customers/${project.customer.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-700"><Pencil className="w-3.5 h-3.5" /> Edit</Link>
                      )}
                    </div>
                    <div className="grid grid-cols-2 @2xl:grid-cols-3 gap-3 @2xl:gap-x-0">
                      {([
                        { icon: User, label: 'Customer', value: summary.customerName || project.customer?.name, href: project.customer?.id ? `/customers/${project.customer.id}` : undefined, internal: true },
                        { icon: Phone, label: 'Phone', value: summary.phone, href: summary.phone ? `tel:${summary.phone}` : undefined },
                        { icon: MessageCircle, label: 'WhatsApp', value: summary.whatsapp, href: summary.whatsapp ? waLink(summary.whatsapp) : undefined, external: true },
                        { icon: MapPin, label: 'City', value: summary.city },
                        { icon: Navigation, label: 'Site Address', value: summary.address, href: summary.mapUrl, external: true },
                        { icon: UserCheck, label: 'Lead by', value: summary.leadBy },
                      ] as { icon: React.ComponentType<{ className?: string }>; label: string; value?: string; href?: string; internal?: boolean; external?: boolean }[]).map((f, i) => {
                        const val = f.value || '—';
                        const valueEl = f.href && f.value
                          ? (f.internal
                            ? <Link to={f.href} className="text-emerald-800 hover:underline">{val}</Link>
                            : <a href={f.href} target={f.external ? '_blank' : undefined} rel="noreferrer" className="text-emerald-800 hover:underline">{val}</a>)
                          : <span className="text-slate-800">{val}</span>;
                        return (
                          <div key={f.label} className={`flex items-start gap-3 min-w-0 @2xl:px-4 @2xl:border-l @2xl:border-slate-100 ${i % 3 === 0 ? '@2xl:!pl-0 @2xl:!border-l-0' : ''}`}>
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 shrink-0"><f.icon className="w-4 h-4" /></span>
                            <div className="min-w-0">
                              <div className="text-[11px] text-slate-400">{f.label}</div>
                              <div className="text-sm font-semibold truncate" title={f.value}>{valueEl}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Project Team */}
                  <div className={CARD}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={CARD_TITLE}><Users className="w-5 h-5 text-emerald-700"/> Project Team</h3>
                      <button type="button" onClick={openAssignTeam} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Assign Team</button>
                    </div>
                    {(() => {
                      const team = ([['Project Manager', project.projectManager], ['Assistant Manager', project.assistantManager], ['Sales', project.salesExecutive], ['Designer', project.designer], ['Site Engineer', project.siteEngineer]] as [string, any][]).filter(([, u]) => u);
                      return team.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {team.map(([role, u]) => (
                            <div key={role} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold shrink-0">{(u.name || '?').charAt(0).toUpperCase()}</span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-800 truncate">{u.name}</div>
                                <div className="text-[11px] text-slate-400">{role}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                          <span className="text-xs text-slate-500">No team members assigned yet</span>
                          <Button onClick={openAssignTeam} size="sm" className="h-7 bg-emerald-700 hover:bg-emerald-800 rounded-lg text-xs"><Plus className="w-3.5 h-3.5 mr-1"/> Assign</Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ACTIVITY TAB — the full feed */}
            <TabsContent value="activity" className="mt-0 h-full outline-none">
              <div className={CARD}>
                <h3 className={`${CARD_TITLE} mb-3`}><History className="w-5 h-5 text-emerald-700"/> All Activity</h3>
                <ActivityList items={activityFeed} />
              </div>
            </TabsContent>

            {/* PHASES & ROOMS TAB */}
            <TabsContent value="phases" className="space-y-6 mt-0 h-full outline-none">
              {progressDashboard && (() => {
                const d = progressDashboard;
                const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
                const rings = [
                  { pct: ratio(d.completedTasks, d.totalTasks), label: 'Tasks', sub: `${d.completedTasks}/${d.totalTasks}`, color: '#3b82f6' },
                  { pct: ratio(d.completedRooms, d.totalRooms), label: 'Rooms', sub: `${d.completedRooms}/${d.totalRooms}`, color: '#10b981' },
                  { pct: ratio(d.completedPhases, d.totalPhases), label: 'Phases', sub: `${d.completedPhases}/${d.totalPhases}`, color: '#8b5cf6' },
                ];
                return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  {/* Overall progress — premium compact card */}
                  <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1.5 text-emerald-600"/> Overall Progress</span>
                      <span className="text-2xl font-black text-slate-800 leading-none">{d.overallProgress}%</span>
                    </div>
                    <div className="mt-3 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500" style={{ width: `${d.overallProgress}%` }} />
                    </div>
                    <div className="mt-auto pt-4 grid grid-cols-3 gap-2 text-center">
                      {[['Done', d.completedTasks, 'text-emerald-600'], ['Active', d.inProgressTasks, 'text-sky-600'], ['Pending', d.pendingTasks, 'text-slate-500']].map(([l, v, c]) => (
                        <div key={l as string} className="rounded-lg bg-slate-50/70 py-1.5">
                          <div className={`text-base font-black ${c}`}>{v as number}</div>
                          <div className="text-[10px] font-medium text-slate-400">{l as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4 completion rings — premium compact card */}
                  <div className="lg:col-span-8 bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Completion Breakdown</div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {rings.map(r => <ProgressRing key={r.label} {...r} />)}
                    </div>
                  </div>

                </div>
                );
              })()}

              {data?.boq && (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Approved (Master) BOQ</div>
                    {masterBoq ? (
                      <Link to={`/boq/${masterBoq.id}`} className="font-semibold text-emerald-600 hover:underline">{masterBoq.boqNumber}</Link>
                    ) : <span className="text-slate-400">—</span>}
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Current BOQ Revision</div>
                    <Link to={`/boq/${data.boq.id}`} className="font-semibold text-emerald-600 hover:underline">
                      {data.boq.boqNumber} · Rev {data.boq.revisionNumber ?? 1}
                    </Link>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-slate-100 rounded-full uppercase">{data.boq.status}</span>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Remaining BOQ (not yet executed)</div>
                    <span className="font-semibold text-slate-800">
                      {(data.boq.items || []).filter((i: any) => i.status !== 'EXECUTED' && i.isActive !== false).length} item(s)
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center"><Layers className="w-5 h-5 mr-2 text-emerald-600"/> Phases & Rooms</h2>
                <div className="flex gap-3 flex-wrap items-center">
                  {/* Room-wise (card grid) vs Item-wise (flat work-item list) toggle */}
                  <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                    {([['rooms', 'Room-wise'], ['items', 'Item-wise']] as const).map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setPhaseView(v)}
                        className={`px-3 py-1.5 rounded-md font-medium transition-colors ${phaseView === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" onClick={() => setBulkOpen(true)}>
                    <CheckSquare className="w-4 h-4 mr-2 text-emerald-600"/> Update Work
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline"><Sparkles className="w-4 h-4 mr-2"/> Change plan <ChevronDown className="w-4 h-4 ml-2"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem onSelect={openQuotationPicker}>
                        <ClipboardCheck className="w-4 h-4 mr-2 text-emerald-600"/> Build from approved quotation
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={!project.lead?.id} onSelect={() => project.lead?.id && navigate(`/boq/new?leadId=${project.lead.id}`)}>
                        <Plus className="w-4 h-4 mr-2 text-emerald-600"/> Create new BOQ
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!project.lead?.id} onSelect={() => project.lead?.id && navigate(`/quotations/new?leadId=${project.lead.id}`)}>
                        <Plus className="w-4 h-4 mr-2 text-violet-600"/> Create new Quotation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={() => setPhaseDialog({ open: true, phase: null })}><Plus className="w-4 h-4 mr-2"/> Add Phase</Button>
                </div>
              </div>

              {/* Batch "Update Work" sheet — record a day's progress across many items at once. */}
              <BulkWorkUpdateDialog
                projectId={projectId}
                open={bulkOpen}
                onOpenChange={setBulkOpen}
                onApplied={() => refreshPhaseTree(detailRoom?.phaseId)}
              />

              {/* Build-from-approved-quotation picker — replaces the old blind "Generate from BOQ". */}
              <Dialog open={quotationPicker.open} onOpenChange={(o) => setQuotationPicker(s => ({ ...s, open: o }))}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader><DialogTitle>Build from approved quotation</DialogTitle></DialogHeader>
                  <div className="pt-2">
                    <p className="text-sm text-slate-500 mb-4">
                      Pick an approved quotation for this lead. The project's scope is set to that quotation's BOQ,
                      then phases, rooms, tasks and material requirements are (re)built from it.
                    </p>
                    {quotationPicker.loading ? (
                      <div className="py-10 text-center text-sm text-slate-400">Loading approved quotations…</div>
                    ) : quotationPicker.list.length === 0 ? (
                      <div className="py-10 text-center text-sm text-slate-400">
                        No approved quotations found for this project's lead.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {quotationPicker.list.map((q) => {
                          const selected = quotationPicker.selectedId === q.id;
                          return (
                            <button key={q.id} type="button"
                              onClick={() => setQuotationPicker(s => ({ ...s, selectedId: q.id }))}
                              className={`w-full text-left rounded-xl border p-3 transition ${selected ? 'border-emerald-500 ring-1 ring-emerald-200 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-semibold text-slate-800 truncate">{q.quotationNumber}</span>
                                  {q.revisionNumber > 0 && <span className="text-[11px] text-slate-400">Rev {q.revisionNumber}</span>}
                                  {q.isCurrent && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded uppercase shrink-0">Current</span>}
                                </div>
                                <span className="font-semibold text-slate-700 shrink-0">{inr(q.grandTotal)}</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                BOQ {q.boq.boqNumber} · Rev {q.boq.revisionNumber}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <Button className="w-full mt-4"
                      disabled={quotationPicker.generating || !quotationPicker.selectedId}
                      onClick={handleGenerateFromQuotation}>
                      {quotationPicker.generating ? 'Building…' : 'Use this quotation'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Room-wise — a table per phase (Room · Work Item · Type · Progress · Status · Actions). */}
              {phaseView === 'rooms' ? (
              <div className="space-y-4">
                {phases.map(phase => {
                  const rooms = roomsByPhase[phase.id!] || [];
                  return (
                  <div key={phase.id} className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                    {/* Phase header bar */}
                    <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                      <span className="font-bold text-slate-800">{phase.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{phase.status}</span>
                      <span className="text-xs text-slate-400">· {rooms.length} room{rooms.length === 1 ? '' : 's'} · Budget {inr(phase.budget)} · {phase.completionPercentage || 0}%</span>
                      <div className="flex-1" />
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setRoomDialog({ open: true, phaseId: phase.id!, room: null })}><Plus className="w-3.5 h-3.5 mr-1"/> Room</Button>
                        <button type="button" title="Edit phase" onClick={() => setPhaseDialog({ open: true, phase })} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="w-4 h-4"/></button>
                        <button type="button" title="Delete phase" onClick={() => handleDeletePhase(phase.id!)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>

                    {rooms.length === 0 ? (
                      <div className="py-6 text-center text-sm text-slate-400">
                        No rooms in this phase yet.
                        <button type="button" onClick={() => setRoomDialog({ open: true, phaseId: phase.id!, room: null })} className="ml-1 font-medium text-emerald-600 hover:underline">Add a room</button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[760px]">
                          <thead className="bg-slate-50 text-xs text-slate-500">
                            <tr>
                              <th className="text-left font-medium px-4 py-2 w-40">Room</th>
                              <th className="text-left font-medium px-3 py-2">Work Item</th>
                              <th className="text-left font-medium px-3 py-2 w-32">Type</th>
                              <th className="text-left font-medium px-3 py-2 w-48">Progress</th>
                              <th className="text-left font-medium px-3 py-2 w-32">Status</th>
                              <th className="text-right font-medium px-4 py-2 w-24">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rooms.map(room => {
                              const items = allItemsBrief.filter(i => i.roomId === room.id);
                              const roomMenu = (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><MoreHorizontal className="w-4 h-4"/></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem onSelect={() => setDetailRoom({ room, phaseId: phase.id! })}><Plus className="w-4 h-4 mr-2 text-emerald-600"/> Add / view items</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setRoomDialog({ open: true, phaseId: phase.id!, room })}><Pencil className="w-4 h-4 mr-2"/> Edit room</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600" onSelect={() => handleDeleteRoom(room, phase.id!)}><Trash2 className="w-4 h-4 mr-2"/> Delete room</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );
                              if (items.length === 0) {
                                return (
                                  <tr key={room.id} className="hover:bg-slate-50/60">
                                    <td className="px-4 py-2.5 align-top">
                                      <div className="font-medium text-slate-700">{room.roomName}</div>
                                      {room.floorName && <div className="text-[11px] text-slate-400">{room.floorName}</div>}
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-400 italic" colSpan={4}>
                                      No work items —
                                      <button type="button" onClick={() => setDetailRoom({ room, phaseId: phase.id! })} className="ml-1 not-italic font-medium text-emerald-600 hover:underline">add one</button>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">{roomMenu}</td>
                                  </tr>
                                );
                              }
                              return items.map((item, idx) => {
                                const pct = item.progress ?? 0;
                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/60">
                                    <td className="px-4 py-2.5 align-top">
                                      {idx === 0 ? (
                                        <>
                                          <div className="font-medium text-slate-700">{room.roomName}</div>
                                          {room.floorName && <div className="text-[11px] text-slate-400">{room.floorName}</div>}
                                        </>
                                      ) : <span className="text-slate-300">↳</span>}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                                        {item.itemName}
                                        {item.locked && <Lock className="w-3 h-3 text-slate-400" />}
                                        {item.delayed && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded">DELAYED</span>}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{item.itemType}</span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                          <div className={`h-full ${progressBarColor(pct)} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-500 w-9 text-right">{pct}%</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${itemStatusStyle(item.status)}`}>{(item.status || '').replace(/_/g, ' ')}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center justify-end gap-0.5">
                                        <button type="button" title="Update work item" onClick={() => openItemBrief(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"><Pencil className="w-4 h-4"/></button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><MoreHorizontal className="w-4 h-4"/></button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuItem onSelect={() => openItemBrief(item)}><Pencil className="w-4 h-4 mr-2"/> Update progress</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setDetailRoom({ room, phaseId: phase.id! })}><Plus className="w-4 h-4 mr-2 text-emerald-600"/> Add item to room</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setRoomDialog({ open: true, phaseId: phase.id!, room })}><Pencil className="w-4 h-4 mr-2"/> Edit room</DropdownMenuItem>
                                            {!item.locked && <>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem className="text-red-600" onSelect={() => deleteItemBrief(item)}><Trash2 className="w-4 h-4 mr-2"/> Delete item</DropdownMenuItem>
                                            </>}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  );
                })}
                {phases.length === 0 && (
                  <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
                    <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No phases yet. Add one manually or generate from the linked BOQ.</p>
                  </div>
                )}
              </div>
              ) : (
                /* Item-wise — every work item across all phases/rooms in one flat list */
                <div className="space-y-3">
                  {allItemsBrief.length === 0 ? (
                    <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
                      <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No work items yet. Switch to Room-wise to add rooms and items.</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="sm:hidden space-y-2.5">
                        {allItemsBrief.map(item => {
                          const pct = item.progress ?? 0;
                          return (
                            <div key={item.id} className="rounded-xl border bg-card p-3">
                              <div className="flex items-start gap-2">
                                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => openItemBrief(item)}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-slate-800 truncate">{item.itemName}</span>
                                    {item.locked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                                    <span className="text-[10px] text-slate-400 uppercase shrink-0">{item.itemType}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{item.phaseName} · {item.roomName || 'Unassigned'}</div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full ${progressBarColor(pct)} rounded-full`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-500 w-9 text-right">{pct}%</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${itemStatusStyle(item.status)}`}>{(item.status || '').replace(/_/g, ' ')}</span>
                                  </div>
                                </button>
                                {!item.locked && (
                                  <button type="button" title="Delete item" onClick={() => deleteItemBrief(item)} className="p-1.5 -m-0.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 shrink-0"><Trash2 className="w-4 h-4"/></button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden sm:block border rounded-xl overflow-x-auto bg-white">
                        <table className="w-full text-sm min-w-[720px]">
                          <thead className="bg-slate-50 text-xs text-slate-500">
                            <tr>
                              <th className="text-left px-3 py-2">Phase</th>
                              <th className="text-left px-3 py-2">Room</th>
                              <th className="text-left px-3 py-2">Work Item</th>
                              <th className="text-left px-3 py-2">Type</th>
                              <th className="text-left px-3 py-2 w-48">Progress</th>
                              <th className="text-left px-3 py-2">Status</th>
                              <th className="px-3 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {allItemsBrief.map(item => {
                              const pct = item.progress ?? 0;
                              return (
                                <tr key={item.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => openItemBrief(item)}>
                                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{item.phaseName || '—'}</td>
                                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{item.roomName || 'Unassigned'}</td>
                                  <td className="px-3 py-2 font-medium text-slate-700">
                                    <span className="inline-flex items-center gap-1.5">{item.itemName}{item.locked && <Lock className="w-3 h-3 text-slate-400" />}{item.delayed && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded">DELAYED</span>}</span>
                                  </td>
                                  <td className="px-3 py-2 text-[11px] text-slate-400 uppercase whitespace-nowrap">{item.itemType}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${progressBarColor(pct)} rounded-full`} style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-[11px] font-semibold text-slate-500 w-9 text-right">{pct}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${itemStatusStyle(item.status)}`}>{(item.status || '').replace(/_/g, ' ')}</span></td>
                                  <td className="px-3 py-2 text-right">
                                    {!item.locked && (
                                      <button type="button" title="Delete item" onClick={(e) => { e.stopPropagation(); deleteItemBrief(item); }} className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Click any item to update progress, status, photos and remarks.</p>
                    </>
                  )}
                </div>
              )}

              {/* Phase add/edit modal */}
              <PhaseFormDialog
                open={phaseDialog.open}
                phase={phaseDialog.phase}
                projectId={projectId}
                onOpenChange={(o) => setPhaseDialog(s => ({ ...s, open: o }))}
                onSaved={() => { setPhaseDialog({ open: false, phase: null }); refreshPhaseTree(); }}
              />
              {/* Room add/edit modal */}
              <RoomFormDialog
                open={roomDialog.open}
                phaseId={roomDialog.phaseId}
                room={roomDialog.room}
                onOpenChange={(o) => setRoomDialog(s => ({ ...s, open: o }))}
                onSaved={() => { const pid = roomDialog.phaseId; setRoomDialog({ open: false, phaseId: null, room: null }); refreshPhaseTree(pid ?? undefined); }}
              />
              {/* Room detail modal — work items table with add/edit/delete */}
              {detailRoom && (
                <RoomDetailDialog
                  room={detailRoom.room}
                  phaseId={detailRoom.phaseId}
                  items={itemsByRoom[detailRoom.room.id!] || []}
                  loadItems={loadItems}
                  onClose={() => setDetailRoom(null)}
                  onEditItem={openItemEditor}
                  onChanged={() => refreshPhaseTree(detailRoom.phaseId)}
                  itemStatusStyle={itemStatusStyle}
                  progressBarColor={progressBarColor}
                  inr={inr}
                />
              )}
            </TabsContent>

            {/* PAYMENTS & INVOICES TAB */}
            <TabsContent value="payments" className="mt-0 h-full outline-none">
              <ProjectPaymentsTab project={project} mode="all" onChanged={fetchProjectData} />
            </TabsContent>

            {/* MATERIALS TAB */}
            <TabsContent value="materials" className="space-y-6 mt-0 h-full outline-none">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center"><Package className="w-5 h-5 mr-2 text-emerald-600"/> Materials & Stock</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => setNewProduct(s => ({ ...s, open: true }))}><Sparkles className="w-4 h-4 mr-2"/> New Product</Button>
                  <Button variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => openStockMove('IN')}><TrendingUp className="w-4 h-4 mr-2"/> Stock In</Button>
                  <Button variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => openStockMove('OUT')}><RotateCcw className="w-4 h-4 mr-2"/> Stock Out</Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button><Plus className="w-4 h-4 mr-2"/> Add Material</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Material Requirement</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Product</Label>
                          <SearchableSelect
                            value={newMaterial.productId}
                            onChange={(v) => setNewMaterial({ ...newMaterial, productId: v })}
                            options={products.map((p: any) => ({ value: String(p.id), label: p.name, hint: p.materialCode }))}
                            placeholder="Select product…"
                          />
                        </div>
                        <div className="space-y-2"><Label>Required Quantity</Label><Input type="number" value={newMaterial.requiredQty} onChange={e => setNewMaterial({ ...newMaterial, requiredQty: Number(e.target.value) })} /></div>
                        <div className="space-y-2"><Label>Unit</Label><Input list={UNIT_DATALIST_ID} value={newMaterial.unit} onChange={e => setNewMaterial({ ...newMaterial, unit: e.target.value })} placeholder="e.g. Nos, Kg, Sqft, Mtr" /></div>
                        <Button className="w-full" onClick={handleAddMaterial}>Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="text-left p-3">Product</th>
                      <th className="text-right p-3">Required</th>
                      <th className="text-right p-3">Reserved</th>
                      <th className="text-right p-3">Issued</th>
                      <th className="text-right p-3">Returned</th>
                      <th className="text-right p-3">Consumed</th>
                      <th className="text-right p-3">Remaining</th>
                      <th className="text-center p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map(m => (
                      <tr key={m.id} className="border-t">
                        <td className="p-3 font-medium">{m.product?.name}</td>
                        <td className="p-3 text-right">{m.requiredQty}</td>
                        <td className="p-3 text-right tabular-nums">{m.reservedQty ?? 0}</td>
                        <td className="p-3 text-right tabular-nums">{m.issuedQty ?? 0}</td>
                        <td className="p-3 text-right tabular-nums">{m.returnedQty ?? 0}</td>
                        <td className="p-3 text-right tabular-nums">{m.consumedQty ?? 0}</td>
                        <td className={`p-3 text-right font-bold ${(m.remainingQty || 0) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{m.remainingQty}</td>
                        <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                          <Button size="sm" variant="outline" onClick={() => openMatEdit(m)} title="Edit reserved / issued / returned / consumed">
                            <Pencil className="w-3.5 h-3.5 mr-1"/> Edit
                          </Button>
                          <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => openStockMove('IN', m.product?.id)} title="Record stock received">
                            <TrendingUp className="w-3.5 h-3.5 mr-1"/> In
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => openStockMove('OUT', m.product?.id)} title="Issue / consume stock">
                            <RotateCcw className="w-3.5 h-3.5 mr-1"/> Out
                          </Button>
                          {(m.remainingQty || 0) > 0 && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleRequestMaterial(m)}>
                                <Package className="w-3.5 h-3.5 mr-1"/> Request Material
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleRequestPurchase(m.id!)}>
                                <ShoppingCart className="w-3.5 h-3.5 mr-1"/> Request PO
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {materials.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-slate-400 py-12">No material requirements yet.</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>

              {/* PURCHASE SUMMARY + MOVEMENT HISTORY */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center"><ShoppingCart className="w-4 h-4 mr-2 text-emerald-600"/> Purchase Summary</h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">By product</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-white text-xs font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="text-left p-3">Product</th>
                        <th className="text-right p-3">Purchased</th>
                        <th className="text-right p-3">Entries</th>
                        <th className="text-right p-3">Value</th>
                        <th className="text-right p-3">Last</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseSummary.map((row: any) => (
                        <tr key={row.productId} className="border-t">
                          <td className="p-3 font-medium text-slate-800">{row.productName}<div className="text-[11px] text-slate-400">{row.materialCode}</div></td>
                          <td className="p-3 text-right font-semibold">{Number(row.totalQty || 0).toLocaleString('en-IN')} {row.unit}</td>
                          <td className="p-3 text-right text-slate-500">{row.entries}</td>
                          <td className="p-3 text-right font-semibold">₹{Number(row.totalValue || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-right text-xs text-slate-500">{row.lastPurchaseDate ? format(new Date(row.lastPurchaseDate), 'MMM d') : '-'}</td>
                        </tr>
                      ))}
                      {purchaseSummary.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-slate-400 py-10">No purchases recorded for this project yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center"><History className="w-4 h-4 mr-2 text-emerald-600"/> Stock Movement</h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent</span>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white text-xs font-bold text-slate-500 uppercase sticky top-0">
                        <tr>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Type</th>
                          <th className="text-left p-3">Product</th>
                          <th className="text-right p-3">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialTransactions.map((tx: any) => {
                          const inbound = ['PURCHASE', 'OPENING', 'ADJUSTMENT', 'PROJECT_RETURN', 'SUPPLIER_RETURN'].includes(tx.type);
                          return (
                            <tr key={tx.id} className="border-t">
                              <td className="p-3 text-xs text-slate-500">{tx.date ? format(new Date(tx.date), 'MMM d, HH:mm') : '-'}</td>
                              <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">{tx.type}</span></td>
                              <td className="p-3 font-medium text-slate-800">{tx.product?.name}</td>
                              <td className={`p-3 text-right font-bold ${inbound ? 'text-emerald-600' : 'text-red-500'}`}>{inbound ? '+' : '−'}{tx.quantity} {tx.product?.unit}</td>
                            </tr>
                          );
                        })}
                        {materialTransactions.length === 0 && (
                          <tr><td colSpan={4} className="text-center text-slate-400 py-10">No stock movement yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* MATERIAL USAGE — which material, which task, who used it */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center"><Package className="w-4 h-4 mr-2 text-emerald-600"/> Material Usage — by Task &amp; Person</h3>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{materialUsage.length} record{materialUsage.length === 1 ? '' : 's'}</span>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-xs font-bold text-slate-500 uppercase sticky top-0">
                      <tr>
                        <th className="text-left p-3">Material</th>
                        <th className="text-left p-3">Used on Task</th>
                        <th className="text-left p-3">Used By</th>
                        <th className="text-right p-3">Qty</th>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialUsage.map((u: any) => (
                        <tr key={u.id} className="border-t hover:bg-slate-50/60">
                          <td className="p-3 font-medium text-slate-800">{u.productName}<div className="text-[11px] text-slate-400">{u.materialCode}</div></td>
                          <td className="p-3">
                            {u.taskId ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/projects/${projectId}/tasks/${u.taskId}`)}
                                className="text-emerald-700 hover:underline font-medium text-left"
                              >
                                {u.taskName || `Task #${u.taskId}`}
                              </button>
                            ) : <span className="text-slate-400">—</span>}
                            {u.taskStatus && <div className="text-[11px] text-slate-400">{u.taskStatus}</div>}
                          </td>
                          <td className="p-3 text-slate-700">{u.usedByName || <span className="text-slate-400">—</span>}</td>
                          <td className="p-3 text-right font-bold text-red-500">−{Number(u.quantityUsed || 0).toLocaleString('en-IN')} {u.unit}</td>
                          <td className="p-3 text-xs text-slate-500">{u.usedAt ? format(new Date(u.usedAt), 'MMM d, HH:mm') : '-'}</td>
                          <td className="p-3 text-xs text-slate-500 max-w-[220px] truncate" title={u.remarks || ''}>{u.remarks || '—'}</td>
                        </tr>
                      ))}
                      {materialUsage.length === 0 && (
                        <tr><td colSpan={6} className="text-center text-slate-400 py-10">No material usage reported on this project's tasks yet.<div className="text-xs mt-1">Field employees log consumption while executing a task; it appears here.</div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* STOCK MOVEMENT DIALOG */}
              <Dialog open={stockMove.open} onOpenChange={(o) => setStockMove(s => ({ ...s, open: o }))}>
                <DialogContent>
                  <DialogHeader><DialogTitle>{stockMove.direction === 'IN' ? 'Stock In — Record Received Material' : 'Stock Out — Issue / Consume Material'}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <SearchableSelect
                        value={stockMove.productId}
                        onChange={(v) => setStockMove(s => ({ ...s, productId: v }))}
                        options={products.map((p: any) => ({ value: String(p.id), label: p.name, hint: p.materialCode }))}
                        placeholder="Select product…"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Entry Type</Label>
                        <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={stockMove.type} onChange={e => setStockMove(s => ({ ...s, type: e.target.value }))}>
                          {stockMove.direction === 'IN'
                            ? ['PURCHASE', 'OPENING', 'ADJUSTMENT', 'PROJECT_RETURN'].map(t => <option key={t} value={t}>{t}</option>)
                            : ['CONSUMPTION'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{stockMove.direction === 'IN' ? 'Destination Warehouse' : 'Source Warehouse'}</Label>
                        <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={stockMove.warehouseId} onChange={e => setStockMove(s => ({ ...s, warehouseId: e.target.value }))}>
                          <option value="">Select...</option>
                          {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={stockMove.quantity} onChange={e => setStockMove(s => ({ ...s, quantity: Number(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Reference</Label><Input value={stockMove.reference} onChange={e => setStockMove(s => ({ ...s, reference: e.target.value }))} placeholder="PO / Invoice / DC #" /></div>
                    </div>
                    <Button className="w-full" onClick={handleRecordStock}>Record {stockMove.direction === 'IN' ? 'Stock In' : 'Stock Out'}</Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* NEW PRODUCT DIALOG */}
              <Dialog open={newProduct.open} onOpenChange={(o) => setNewProduct(s => ({ ...s, open: o }))}>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2"><Label>Name *</Label><Input value={newProduct.name} onChange={e => setNewProduct(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Birla White Cement 40kg" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Unit</Label><Input list={UNIT_DATALIST_ID} value={newProduct.unit} onChange={e => setNewProduct(s => ({ ...s, unit: e.target.value }))} placeholder="Nos, Kg, Mtr, Sqft" /></div>
                      <div className="space-y-2"><Label>Brand</Label><Input value={newProduct.brand} onChange={e => setNewProduct(s => ({ ...s, brand: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Cost Price</Label><Input type="number" value={newProduct.costPrice} onChange={e => setNewProduct(s => ({ ...s, costPrice: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Selling Price</Label><Input type="number" value={newProduct.sellingPrice} onChange={e => setNewProduct(s => ({ ...s, sellingPrice: e.target.value }))} /></div>
                    </div>
                    <Button className="w-full" onClick={handleCreateProduct}>Create Product</Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* MATERIAL QUANTITY EDITOR */}
              <Dialog open={matEdit.open} onOpenChange={(o) => setMatEdit(s => ({ ...s, open: o }))}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit — {matEdit.productName}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <p className="text-xs text-slate-500">Required <span className="font-semibold text-slate-700">{matEdit.requiredQty}</span>. Set the quantities booked against this requirement.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Reserved</Label><Input type="number" min={0} value={matEdit.reservedQty} onChange={e => setMatEdit(s => ({ ...s, reservedQty: Number(e.target.value) }))} /></div>
                      <div className="space-y-1.5"><Label>Issued</Label><Input type="number" min={0} value={matEdit.issuedQty} onChange={e => setMatEdit(s => ({ ...s, issuedQty: Number(e.target.value) }))} /></div>
                      <div className="space-y-1.5"><Label>Returned</Label><Input type="number" min={0} value={matEdit.returnedQty} onChange={e => setMatEdit(s => ({ ...s, returnedQty: Number(e.target.value) }))} /></div>
                      <div className="space-y-1.5"><Label>Consumed</Label><Input type="number" min={0} value={matEdit.consumedQty} onChange={e => setMatEdit(s => ({ ...s, consumedQty: Number(e.target.value) }))} /></div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Net on site (issued − returned − consumed): <span className="font-semibold text-slate-700">{matEdit.issuedQty - matEdit.returnedQty - matEdit.consumedQty}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setMatEdit(s => ({ ...s, open: false }))} disabled={savingMat}>Cancel</Button>
                      <Button onClick={handleSaveMatEdit} disabled={savingMat}>{savingMat ? 'Saving…' : 'Save'}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* MEASUREMENT & QUOTATION — the same combined workspace as the lead's Sales Journey */}
            <TabsContent value="received" className="mt-0 h-full outline-none">
              <ProjectPaymentsTab project={project} mode="all" focus="payments" onChanged={fetchProjectData} />
            </TabsContent>

            <TabsContent value="profit" className="mt-0 h-full outline-none">
              <ProjectPaymentsTab project={project} mode="all" focus="expenses" onChanged={fetchProjectData} />
            </TabsContent>

            <TabsContent value="quote" className="space-y-3 mt-0 h-full outline-none">
              {(() => {
                const q = project.quotation;
                if (!q) return null;
                const items = (q.items || []).filter((i: any) => !i.isDeleted);
                const expired = q.expiryDate && new Date(q.expiryDate).getTime() < new Date(new Date().toDateString()).getTime();
                const st = String(q.status || 'DRAFT');
                return (
                  <section className="rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="p-4 flex flex-col @3xl:flex-row @3xl:items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="h-5 w-5 text-emerald-700" />
                          <span className="text-base font-bold text-slate-900">{q.quotationNumber || 'Quotation'}</span>
                          {Number(q.revisionNumber || 0) > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Rev {q.revisionNumber}</span>}
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${st === 'APPROVED' || st === 'CONVERTED' ? 'bg-emerald-100 text-emerald-800' : st === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{st.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">{inr(Number(q.grandTotal || 0))}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
                          {q.quotationDate && <span>Quoted {shortDate(q.quotationDate)}</span>}
                          {q.expiryDate && <span className={expired ? 'font-semibold text-rose-600' : ''}>{expired ? 'Expired' : 'Valid till'} {shortDate(q.expiryDate)}</span>}
                          {q.approvedDate && <span>Approved {shortDate(q.approvedDate)}</span>}
                        </div>
                        {(summary.categories || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(summary.categories || []).map((c) => (
                              <span key={c} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {q.id && (
                          <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/quotations/${q.id}/print`} target="_blank" rel="noreferrer"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            <FileBarChart className="h-4 w-4 text-emerald-700" /> Print / PDF
                          </a>
                        )}
                        {project.lead?.id && (
                          <Button size="sm" variant="outline" onClick={() => setQuoteOpen(true)} className="h-9 rounded-xl">
                            <Pencil className="h-4 w-4 mr-1" /> Change quote
                          </Button>
                        )}
                        {project.lead?.id && (
                          <Button size="sm" onClick={() => setQuoteOpen((o) => !o)} className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white">
                            {quoteOpen ? 'Hide workspace' : 'Open full workspace'} <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${quoteOpen ? 'rotate-180' : ''}`} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })()}
              {project.lead?.id ? (
                (quoteOpen || !project.quotation) && <QuoteWorkspace leadId={String(project.lead.id)} projectId={project.id}
                  onChanged={() => { fetchCore(); fetchProjectData(); }} />
              ) : (
                <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                  This project wasn't created from a lead, so it has no measurement & quotation workspace.
                  {data?.boq?.id && <> Its BOQ is <span className="font-medium text-foreground">{data.boq.boqNumber}</span>.</>}
                </div>
              )}
            </TabsContent>

            {/* APPROVALS TAB */}
            {(["approvals", "changeRequests"] as const).map((key) => (
              <TabsContent key={key} value={key} className="mt-0 h-full outline-none">
                <DecisionsTab projectId={projectId} approvals={data.approvals} changeRequests={changeRequests} phases={phases}
                  onApprovalsChanged={fetchCore} onStatsChanged={fetchStats}
                  onChangeRequestsChanged={() => changeRequestApi.getByProject(projectId).then(setChangeRequests)}
                  onFullRefresh={fetchProjectData} />
              </TabsContent>
            ))}

            {/* DAILY LOGS & REPORTS — the site's execution logs + the employees' submitted daily reports, together */}
            <TabsContent value="execution" className="mt-0 h-full outline-none">
              <DailyLogsTab projectId={projectId} dailyLogs={dailyLogs} onChanged={fetchCore} />
            </TabsContent>

            <TabsContent value="reports" className="mt-0 h-full outline-none">
              <ProjectReportsTab projectId={projectId} onCountsChanged={loadReportsPending} />
            </TabsContent>

            {/* EXECUTION & INSTALLATION — Category → Product steps, installation checklists, daily log, team chat */}
            <TabsContent value="workProgress" className="mt-0 h-full outline-none">
              {activeTab === "workProgress" && <WorkProgressTab projectId={projectId} onChanged={fetchProjectData} />}
            </TabsContent>

            <TabsContent value="workCategories" className="mt-0 h-full outline-none">
              <WorkCategoriesTab projectId={projectId} onChanged={fetchProjectData} onOpenRooms={() => setActiveTab('phases')} />
            </TabsContent>

            {/* FIELD PROGRESS TAB — read-only view into the mobile Employee Task module (manager: live progress + employee timeline) */}
            <TabsContent value="fieldProgress" className="mt-0 h-full outline-none">
              <FieldProgressTab projectId={projectId} fieldTasks={fieldTasks}
                onAddTask={() => { setQuickActionView('create_task'); setQuickActionOpen(true); }}
                onChanged={() => api.get(`/tasks/project/${projectId}`).then(res => setFieldTasks(res.data)).catch(() => {})} />
            </TabsContent>

            {/* CONTRACTORS TAB — subcontracted scope on this project, as work packages */}
            <TabsContent value="contractors" className="space-y-6 mt-0 h-full outline-none">
              <ProjectContractorsTab projectId={projectId} />
            </TabsContent>

            {/* LABOUR TAB — people (employees + contractors) assigned across this project's tasks */}
            <TabsContent value="labour" className="space-y-6 mt-0 h-full outline-none">
              <LabourTab projectId={projectId} onManageTasks={() => setActiveTab("fieldProgress")} />
            </TabsContent>

            {/* QUALITY & ISSUES — inspections plus issues/risks, together */}
            <TabsContent value="quality" className="space-y-6 mt-0 h-full outline-none">
              {(() => {
                const q = qualityChecks || [];
                const passed = q.filter((c: any) => c.status === 'APPROVED').length;
                const failed = q.filter((c: any) => c.status === 'REJECTED' || c.status === 'REWORK_REQUIRED').length;
                return <StatStrip className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5" items={[
                  { label: 'Inspections', value: q.length, sub: 'recorded', icon: ClipboardCheck, tone: 'emerald' },
                  { label: 'Passed', value: passed, sub: q.length ? `${Math.round((passed / q.length) * 100)}% pass` : '—', icon: CheckCircle2, tone: 'sky' },
                  { label: 'Failed / Rework', value: failed, sub: failed ? 'needs rework' : 'none', icon: AlertTriangle, tone: 'rose' },
                  { label: 'Open Issues', value: (issues || []).length, sub: (issues || []).length ? 'need attention' : 'all clear', icon: AlertTriangle, tone: 'orange' },
                  { label: 'Risks', value: (risks || []).length, sub: 'tracked', icon: Flag, tone: 'amber' },
                ]} />;
              })()}
              <QualityTab projectId={projectId} qualityChecks={qualityChecks} onChanged={fetchCore} />
              <div className="border-t border-slate-100 pt-8">
                <IssuesRisksTab projectId={projectId} issues={issues} risks={risks} onChanged={fetchCore} onStatsChanged={fetchStats} />
              </div>
            </TabsContent>

            {/* MEDIA TAB */}
            <TabsContent value="purchaseOrders" className="mt-0 h-full outline-none">
              <ProjectPurchaseOrdersTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="goodsReceived" className="mt-0 h-full outline-none">
              <ProjectGoodsReceivedTab projectId={projectId} />
            </TabsContent>

            <CompleteProjectDialog projectId={projectId} open={completeOpen} onClose={() => setCompleteOpen(false)}
              onCompleted={async () => { await fetchProjectData(); fetchCore(); }} />

            <TabsContent value="media" className="mt-0 h-full outline-none">
              <DocumentsTab projectId={projectId} documents={documents} onChanged={fetchCore} />
            </TabsContent>

            {/* SERVICE & WARRANTY TAB (completed projects) */}
            <TabsContent value="serviceWarranty" className="mt-0 h-full outline-none">
              <ServiceWarrantyTab projectId={Number(projectId)} />
            </TabsContent>


          </div>
        </Tabs>
        </div>
      </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
         <Dialog open={quickActionOpen} onOpenChange={(open) => {
             setQuickActionOpen(open);
             if (!open) setTimeout(() => setQuickActionView('menu'), 200);
          }}>
            <DialogTrigger asChild>
               <Button className="rounded-full w-14 h-14 shadow-lg bg-emerald-600 hover:bg-emerald-700 border-4 border-white"><Plus className="w-6 h-6 text-white"/></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
               <DialogHeader>
                 <DialogTitle>
                   {quickActionView === 'menu' ? 'Quick Actions' : 
                    quickActionView === 'create_task' ? 'Create Task' :
                    quickActionView === 'assign_employee' ? 'Assign Resource' :
                    quickActionView === 'report_issue' ? 'Report Issue' : 'Purchase Request'}
                 </DialogTitle>
               </DialogHeader>
               
               {quickActionView === 'menu' && (
                 <div className="grid grid-cols-2 gap-4 pt-4">
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2" onClick={() => setQuickActionView('create_task')}><CheckSquare className="w-5 h-5 text-emerald-500"/> Create Task</Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2" onClick={() => setQuickActionView('assign_employee')}><User className="w-5 h-5 text-emerald-500"/> Assign Resource</Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2" onClick={() => setQuickActionView('report_issue')}><AlertTriangle className="w-5 h-5 text-red-500"/> Report Issue</Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2" onClick={() => setQuickActionView('purchase_request')}><ShoppingCart className="w-5 h-5 text-purple-500"/> Purchase Request</Button>
                 </div>
               )}

               {quickActionView === 'create_task' && (
                 <div className="space-y-4 pt-4">
                   <div className="space-y-2"><Label>Task Name</Label><Input value={newTaskState.taskName} onChange={e => setNewTaskState({...newTaskState, taskName: e.target.value})} placeholder="e.g. Paint the lobby" /></div>
                   <div className="space-y-2"><Label>Description</Label><Input value={newTaskState.description} onChange={e => setNewTaskState({...newTaskState, description: e.target.value})} placeholder="Additional details..." /></div>
                   <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={newTaskState.dueDate} onChange={e => setNewTaskState({...newTaskState, dueDate: e.target.value})} /></div>
                   <div className="flex gap-2 pt-2">
                     <Button variant="outline" onClick={() => setQuickActionView('menu')} className="flex-1">Back</Button>
                     <Button onClick={handleQuickCreateTask} className="flex-1">Save Task</Button>
                   </div>
                 </div>
               )}

               {quickActionView === 'assign_employee' && (
                 <div className="space-y-4 pt-4">
                   <div className="space-y-2"><Label>Select Task</Label>
                     <SearchableSelect
                       value={newAssignState.taskId}
                       onChange={(v) => setNewAssignState({ ...newAssignState, taskId: v })}
                       options={fieldTasks.map((t: any) => ({ value: String(t.id), label: t.taskName, hint: t.room?.roomName || t.phase?.name }))}
                       placeholder="Choose a task…"
                     />
                   </div>
                   <div className="space-y-2"><Label>Assign Resource</Label>
                     <ResourceSelect value={newAssignState.resource}
                       onChange={(sel) => setNewAssignState({ ...newAssignState, resource: sel })} />
                   </div>
                   <div className="flex gap-2 pt-2">
                     <Button variant="outline" onClick={() => setQuickActionView('menu')} className="flex-1">Back</Button>
                     <Button onClick={handleQuickAssign} className="flex-1">Assign</Button>
                   </div>
                 </div>
               )}

               {quickActionView === 'report_issue' && (
                 <div className="space-y-4 pt-4">
                   <div className="space-y-2"><Label>Issue Title</Label><Input value={newIssue.title} onChange={e => setNewIssue({...newIssue, title: e.target.value})} placeholder="e.g. Water leak" /></div>
                   <div className="space-y-2"><Label>Description</Label><Input value={newIssue.description} onChange={e => setNewIssue({...newIssue, description: e.target.value})} placeholder="Describe what happened..." /></div>
                   <div className="space-y-2"><Label>Priority</Label>
                     <select className="w-full p-2 border rounded-md text-sm" value={newIssue.priority} onChange={e => setNewIssue({...newIssue, priority: e.target.value})}>
                       <option value="LOW">Low</option>
                       <option value="MEDIUM">Medium</option>
                       <option value="HIGH">High</option>
                       <option value="CRITICAL">Critical</option>
                     </select>
                   </div>
                   <div className="flex gap-2 pt-2">
                     <Button variant="outline" onClick={() => setQuickActionView('menu')} className="flex-1">Back</Button>
                     <Button onClick={handleQuickIssue} className="flex-1">Report Issue</Button>
                   </div>
                 </div>
               )}

               {quickActionView === 'purchase_request' && (
                 <div className="space-y-4 pt-4">
                   <div className="space-y-2"><Label>Item / Description</Label><Input value={newPurchaseState.itemDesc} onChange={e => setNewPurchaseState({...newPurchaseState, itemDesc: e.target.value})} placeholder="e.g. Cement 50kg bags" /></div>
                   <div className="space-y-2"><Label>Quantity</Label><Input type="number" min="1" value={newPurchaseState.quantity} onChange={e => setNewPurchaseState({...newPurchaseState, quantity: Number(e.target.value)})} /></div>
                   <div className="flex gap-2 pt-2">
                     <Button variant="outline" onClick={() => setQuickActionView('menu')} className="flex-1">Back</Button>
                     <Button onClick={handleQuickPurchase} className="flex-1">Submit Request</Button>
                   </div>
                 </div>
               )}
            </DialogContent>
         </Dialog>
      </div>

      {/* Assign Team — best-2 smart recommendations; top pick → Project Manager, 2nd → Assistant Manager */}
      <Dialog open={teamDialog} onOpenChange={setTeamDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-600"/> Assign Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-emerald-50/70 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-800">
              Pick the pair — the higher-scored person becomes <b>Project Manager</b>, the other becomes <b>Assistant Manager</b>.
            </div>
            <div>
              {teamLoading ? (
                <div className="py-8 text-center text-sm text-slate-400">Finding the best people…</div>
              ) : teamPicks.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No eligible people found right now.</div>
              ) : (() => {
                const selCount = teamPicks.filter((p) => teamSel[teamKey(p)]).length;
                const top = teamPicks.filter((p) => teamTopKeys.has(teamKey(p)));
                const others = teamPicks.filter((p) => !teamTopKeys.has(teamKey(p)));
                // Selected pair (by score): 1st → Project Manager, 2nd → Assistant Manager.
                const chosen = teamPicks.filter((p) => teamSel[teamKey(p)]).sort((a, b) => b.suitabilityScore - a.suitabilityScore);
                const roleFor: Record<string, string> = {};
                if (chosen[0]) roleFor[teamKey(chosen[0])] = 'PM';
                if (chosen[1]) roleFor[teamKey(chosen[1])] = 'Asst. Manager';
                const Row = (p: EmployeeRecommendation) => {
                  const k = teamKey(p);
                  const on = !!teamSel[k];
                  const role = roleFor[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTeamSel((s) => ({ ...s, [k]: !on }))}
                      className={`w-full text-left flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${on ? 'border-emerald-300 bg-emerald-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold shrink-0">{(p.name || '?').charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                          {role && <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${role === 'PM' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>{role}</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{p.designation || p.department || p.employeeCode || '—'}{p.reasons?.[0] ? ` · ${p.reasons[0]}` : ''}</div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 shrink-0" title="Suitability score">{Math.round(p.suitabilityScore)}</span>
                      {on ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />}
                    </button>
                  );
                };
                return (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-500">Best suited — pick the pair</span>
                      {selCount > 0 && <span className="text-[11px] font-semibold text-emerald-600">{selCount} selected</span>}
                    </div>
                    <div className="space-y-2">{top.map(Row)}</div>
                    {others.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setTeamShowOthers((v) => !v)}
                          className="mt-2 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-600"
                        >
                          <span>Choose someone else ({others.length})</span>
                          {teamShowOthers ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {teamShowOthers && (
                          <div className="space-y-2 mt-1 max-h-56 overflow-y-auto pr-1">{others.map(Row)}</div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setTeamDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAssignTeam} disabled={teamSaving || teamLoading || !teamPicks.length} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                {teamSaving ? 'Assigning…' : 'Assign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Work Item — progress editor + timeline */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingItem?.itemName}
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">{editingItem?.itemType}</span>
            </DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-5 pt-2">
              {editingItem.locked && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-emerald-800">
                    <Lock className="w-4 h-4" /> Completed &amp; locked{editingItem.completedDate ? ` on ${editingItem.completedDate}` : ''}.
                  </div>
                  <Button size="sm" variant="outline" onClick={handleReopenItem} disabled={savingItem}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen
                  </Button>
                </div>
              )}

              {/* Unified workforce assignment — employee OR contractor from one picker */}
              <div className="space-y-2">
                <Label>Assigned Resource</Label>
                <ResourceSelect
                  disabled={editingItem.locked}
                  value={editingItem.resourceType && editingItem.resourceId ? {
                    resourceType: editingItem.resourceType as ResourceType,
                    resourceId: editingItem.resourceId,
                    name: editingItem.assignedResource?.name,
                  } : null}
                  onChange={handleAssignResource}
                />
              </div>

              {/* Read-only rolled-up context */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><span className="text-slate-400">Actual Start:</span> <span className="font-medium text-slate-700">{editingItem.actualStartDate || '—'}</span></div>
                <div><span className="text-slate-400">Planned End:</span> <span className={`font-medium ${editingItem.delayed ? 'text-red-600' : 'text-slate-700'}`}>{editingItem.plannedEndDate || '—'}{editingItem.delayed ? ' (delayed)' : ''}</span></div>
              </div>

              {/* Progress slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Progress</Label>
                  <span className="text-lg font-bold text-slate-800">{itemForm.progress}%</span>
                </div>
                <BaseInput type="range" min={0} max={100} step={5} value={itemForm.progress} disabled={editingItem.locked}
                  onChange={e => setItemForm(f => ({ ...f, progress: Number(e.target.value) }))}
                  className="w-full accent-emerald-600 disabled:opacity-50" />
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${progressBarColor(itemForm.progress)} rounded-full`} style={{ width: `${itemForm.progress}%` }} />
                </div>
                {itemForm.progress >= 100 && !editingItem.locked && (
                  <p className="text-[11px] text-emerald-600">Saving at 100% will mark this item Completed and lock it.</p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  value={itemForm.status} disabled={editingItem.locked}
                  onChange={e => setItemForm(f => ({ ...f, status: e.target.value }))}>
                  {WORK_ITEM_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label>Remarks (for this update)</Label>
                <Input value={itemForm.remarks} disabled={editingItem.locked}
                  onChange={e => setItemForm(f => ({ ...f, remarks: e.target.value }))}
                  placeholder="What changed? e.g. Frame fitted, glass pending" />
              </div>

              {/* Photos */}
              <div className="space-y-2">
                <Label>Photos</Label>
                <div className="flex flex-wrap gap-2">
                  {itemPhotos.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={resolveFileUrl(url)} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                      {!editingItem.locked && (
                        <button onClick={() => setItemPhotos(p => p.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] leading-none opacity-0 group-hover:opacity-100">×</button>
                      )}
                    </div>
                  ))}
                  {!editingItem.locked && (
                    <>
                      <label className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-emerald-400 text-slate-400" title="Choose from device">
                        <FileImage className="w-5 h-5" />
                        <BaseInput type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleItemPhotoUpload(f); e.target.value = ''; }} />
                      </label>
                      <CameraCaptureButton onCapture={handleItemPhotoUpload} label=""
                        className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center hover:border-emerald-400 text-slate-400" />
                    </>
                  )}
                </div>
                {itemPhotoUploading && <p className="text-xs text-slate-400">Uploading…</p>}
              </div>

              {!editingItem.locked && (
                <Button className="w-full" onClick={handleSaveItemProgress} disabled={savingItem}>
                  {savingItem ? 'Saving…' : 'Save Progress'}
                </Button>
              )}

              {/* Timeline / audit history */}
              <div className="pt-2 border-t">
                <div className="text-sm font-semibold text-slate-600 mb-3 flex items-center"><History className="w-4 h-4 mr-2 text-slate-400" /> Progress Timeline</div>
                {itemTimeline.length === 0 && <p className="text-xs text-slate-400">No history yet.</p>}
                <div className="space-y-3">
                  {itemTimeline.slice().reverse().map(log => (
                    <div key={log.id} className="flex gap-3 text-xs">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{(log.eventType || '').replace(/_/g, ' ')}</span>
                          <span className="text-slate-400">{log.logTime ? format(new Date(log.logTime), 'MMM d, HH:mm') : ''}</span>
                        </div>
                        <div className="text-slate-500">
                          {log.oldProgress != null && log.newProgress != null && log.oldProgress !== log.newProgress && `${log.oldProgress}% → ${log.newProgress}%  `}
                          {log.oldStatus !== log.newStatus && `${(log.oldStatus || '—').replace(/_/g, ' ')} → ${(log.newStatus || '—').replace(/_/g, ' ')}`}
                        </div>
                        {log.remarks && <div className="text-slate-500 italic mt-0.5">"{log.remarks}"</div>}
                        {log.user?.name && <div className="text-slate-400 mt-0.5">by {log.user.name}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Phases & Rooms modal editors — same card + dialog pattern as the measurement
// Rooms tab (add/edit in a modal, work items in a detail dialog).
// ============================================================================

const PROJECT_ITEM_TYPES = ['WORK','WINDOW','DOOR','WARDROBE','KITCHEN','CURTAIN','PAINTING','FLOORING','ELECTRICAL','PLUMBING','FALSE_CEILING','FURNITURE','CUSTOM'];

function PhaseFormDialog({ open, phase, projectId, onOpenChange, onSaved }: {
  open: boolean; phase: ProjectPhase | null; projectId: number;
  onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<{ name: string; sequence: number; budget: number }>({ name: '', sequence: 1, budget: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: phase?.name || '', sequence: phase?.sequence ?? 1, budget: Number(phase?.budget || 0) });
  }, [open, phase]);

  const save = () => {
    if (!form.name.trim()) { toast.error("Phase name is required"); return; }
    setSaving(true);
    // updatePhase is a full replace — merge onto the existing phase so nothing is wiped.
    const req = phase?.id
      ? projectApi.updatePhase(phase.id, { ...phase, name: form.name.trim(), sequence: form.sequence, budget: form.budget })
      : projectApi.addPhase(projectId, { name: form.name.trim(), sequence: form.sequence, budget: form.budget });
    req.then(() => { toast.success(phase ? "Phase updated" : "Phase added"); onSaved(); })
      .catch(() => toast.error("Failed to save phase"))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{phase ? `Edit ${phase.name}` : "Add Phase"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2"><Label>Phase Name</Label><Input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ground Floor" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Sequence</Label><Input type="number" value={form.sequence} onChange={e => setForm({ ...form, sequence: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Budget</Label><Input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={saving || !form.name.trim()} onClick={save}>{saving ? "Saving..." : phase ? "Save Changes" : "Add Phase"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoomFormDialog({ open, phaseId, room, onOpenChange, onSaved }: {
  open: boolean; phaseId: number | null; room: ProjectRoom | null;
  onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<{ roomName: string; floorName: string; roomType: string }>({ roomName: '', floorName: '', roomType: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ roomName: room?.roomName || '', floorName: room?.floorName || '', roomType: room?.roomType || '' });
  }, [open, room]);

  const save = () => {
    if (!form.roomName.trim()) { toast.error("Room name is required"); return; }
    setSaving(true);
    const payload = { roomName: form.roomName.trim(), floorName: form.floorName.trim() || undefined, roomType: form.roomType.trim() || undefined };
    // updateRoom is a full replace — merge onto the existing room to preserve remarks.
    const req = room?.id
      ? projectApi.updateRoom(room.id, { ...room, ...payload })
      : phaseId != null
        ? projectApi.addRoom(phaseId, payload)
        : Promise.reject(new Error("No phase"));
    req.then(() => { toast.success(room ? "Room updated" : "Room added"); onSaved(); })
      .catch(() => toast.error("Failed to save room"))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{room ? `Edit ${room.roomName}` : "Add Room"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2"><Label>Room Name</Label><Input autoFocus value={form.roomName} onChange={e => setForm({ ...form, roomName: e.target.value })} placeholder="e.g. Master Bedroom" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Floor</Label><Input value={form.floorName} onChange={e => setForm({ ...form, floorName: e.target.value })} placeholder="e.g. Ground Floor" /></div>
            <div className="space-y-2"><Label>Room Type</Label><Input value={form.roomType} onChange={e => setForm({ ...form, roomType: e.target.value })} placeholder="e.g. Bedroom" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={saving || !form.roomName.trim()} onClick={save}>{saving ? "Saving..." : room ? "Save Changes" : "Add Room"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoomDetailDialog({ room, items, loadItems, onClose, onEditItem, onChanged, itemStatusStyle, progressBarColor }: {
  room: ProjectRoom; phaseId: number; items: ProjectRoomItem[];
  loadItems: (roomId: number) => Promise<void>;
  onClose: () => void; onEditItem: (item: ProjectRoomItem) => void; onChanged: () => void;
  itemStatusStyle: (s?: string) => string; progressBarColor: (n: number) => string;
  inr: (n?: number | null) => string;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ itemName: string; itemType: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadItems(room.id!).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  const addItem = () => {
    if (!form?.itemName.trim()) { toast.error("Item name is required"); return; }
    setSaving(true);
    projectApi.addItem(room.id!, { itemName: form.itemName.trim(), itemType: form.itemType, status: 'PENDING', progress: 0 })
      .then(() => { setForm(null); loadItems(room.id!); onChanged(); toast.success("Work item added"); })
      .catch(() => toast.error("Failed to add work item"))
      .finally(() => setSaving(false));
  };

  const removeItem = (item: ProjectRoomItem) => {
    if (item.locked) { toast.error("This item is locked (from the BOQ) and cannot be deleted."); return; }
    if (!window.confirm(`Delete work item "${item.itemName}"?`)) return;
    projectApi.deleteItem(item.id!)
      .then(() => { loadItems(room.id!); onChanged(); toast.success("Work item deleted"); })
      .catch(() => toast.error("Failed to delete work item"));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{room.roomName}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground -mt-2">
          {[room.roomType, room.floorName].filter(Boolean).join(" · ") || "Room"} · {room.completionPercentage || 0}% complete
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Work Items ({items.length})</h4>
            <Button size="sm" variant="outline" onClick={() => setForm({ itemName: '', itemType: 'WORK' })}>
              <Plus className="h-3.5 w-3.5 mr-1"/> Add Item
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading items…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No work items in this room yet. Add the first one above.</p>
          ) : (
            <div className="border rounded-lg divide-y">
              {items.map(item => {
                const pct = item.progress ?? 0;
                return (
                  <div key={item.id} className="flex items-center gap-2 hover:bg-muted/30 group">
                    <button type="button" onClick={() => onEditItem(item)} className="flex-1 min-w-0 flex items-center gap-3 text-sm py-2.5 px-3 text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700 truncate">{item.itemName}</span>
                          {item.locked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                          <span className="text-[10px] text-slate-400 uppercase shrink-0">{item.itemType}</span>
                          {item.assignedResource && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0 truncate max-w-[120px]">{item.assignedResource.name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${progressBarColor(pct)} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 w-9 text-right">{pct}%</span>
                        </div>
                      </div>
                      {item.delayed && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded shrink-0">DELAYED</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${itemStatusStyle(item.status)}`}>{(item.status || '').replace(/_/g, ' ')}</span>
                    </button>
                    {!item.locked && (
                      <button type="button" title="Delete item" onClick={() => removeItem(item)}
                        className="p-2 mr-1 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Trash2 className="w-4 h-4"/></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {form && (
            <div className="p-3 border-2 border-emerald-400/40 rounded-lg bg-muted/30 space-y-3">
              <p className="text-sm font-medium">New work item</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Item Name</Label><Input autoFocus value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })} placeholder="e.g. Wardrobe shutters" /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select value={form.itemType} onChange={e => setForm({ ...form, itemType: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                    {PROJECT_ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
                <Button size="sm" disabled={saving || !form.itemName.trim()} onClick={addItem}>{saving ? "Saving..." : "Add Item"}</Button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">Tip: click a work item to update its progress, status, photos and remarks.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

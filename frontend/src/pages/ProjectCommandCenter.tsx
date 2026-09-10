import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { uploadFile, resolveFileUrl } from "@/lib/uploadFile";
import { projectApi, AvailableQuotation } from "@/api/projectApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { boqApi } from "@/api/boqApi";
import { changeRequestApi } from "@/api/changeRequestApi";
import { inventoryApi } from "@/api/inventoryApi";
import { ProjectPhase, ProjectRoom, ProjectRoomItem, ProjectMaterialRequirement, ProjectProgressDashboard, ProjectItemProgressLog, GenerateFromBoqResult, WORK_ITEM_STATUSES } from "@/types/project";
import { ProjectChangeRequest } from "@/types/changeRequest";
import ProjectPaymentsTab from "@/pages/projectFinance/ProjectPaymentsTab";
import BulkWorkUpdateDialog from "@/pages/projectCommandCenter/BulkWorkUpdateDialog";
import HandoverTab from "@/pages/projectCommandCenter/HandoverTab";
import CameraCaptureButton from "@/components/CameraCaptureButton";
import { format, differenceInDays } from "date-fns";
import {
  ArrowLeft, User, Activity,
  AlertTriangle, CheckCircle2, FileImage,
  TrendingUp, Plus, CheckSquare, Layers, Package, Sparkles,
  ChevronDown, ChevronRight, ShoppingCart, ClipboardCheck,
  Phone, Mail, Play, History, RotateCcw, Lock,
  MoreHorizontal, MapPin, MessageCircle, Wallet, Users,
  Pencil, Check, X,
  Copy, Calendar, Clock, Flag, Building2, FileText, IndianRupee,
  BarChart3, StickyNote, FileBarChart, Home, Settings, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ProjectContractorsTab from "@/pages/contractors/ProjectContractorsTab";
import ApprovalsTab from "@/pages/projectCommandCenter/tabs/ApprovalsTab";
import ChangeRequestsTab from "@/pages/projectCommandCenter/tabs/ChangeRequestsTab";
import DailyLogsTab from "@/pages/projectCommandCenter/tabs/DailyLogsTab";
import FieldProgressTab from "@/pages/projectCommandCenter/tabs/FieldProgressTab";
import EntityDailyReports from "@/components/hr/EntityDailyReports";
import QualityTab from "@/pages/projectCommandCenter/tabs/QualityTab";
import IssuesRisksTab from "@/pages/projectCommandCenter/tabs/IssuesRisksTab";
import DocumentsTab from "@/pages/projectCommandCenter/tabs/DocumentsTab";
import LabourTab from "@/pages/projectCommandCenter/tabs/LabourTab";
import ServiceWarrantyTab from "@/pages/projectCommandCenter/tabs/ServiceWarrantyTab";
import TrackingLinkDialog from "@/components/projects/TrackingLinkDialog";
import ResourceSelect, { ResourceSelection } from "@/components/workforce/ResourceSelect";
import { ResourceType } from "@/types/workforce";
import { useGoBack } from "@/hooks/useGoBack";
import { toast } from "@/components/ui/toast";
import SearchableSelect from "@/components/ui/searchable-select";

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

/** One overview row: label + value (view), or label + editor (edit). Read-only rows omit children. */
function EditRow({ label, editing, view, children, danger }: {
  label: React.ReactNode; editing: boolean; view: React.ReactNode; children?: React.ReactNode; danger?: boolean;
}) {
  const showEdit = editing && !!children;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-100 pb-2">
      <span className="text-xs font-medium text-slate-400 shrink-0 flex items-center gap-1.5">{label}</span>
      {showEdit
        ? <div className="min-w-0 flex-1 pl-3">{children}</div>
        : <span className={`text-sm font-semibold text-right ${danger ? 'text-rose-600' : 'text-slate-700'}`}>{view}</span>}
    </div>
  );
}
const progressBarColor = (pct: number) => pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300';

// The 12 operational sections grouped into 5 task-shaped areas, so the tab bar reads as
// "where in the project am I working" instead of a wall of equal chips. Each section keeps its
// own content block untouched — this is purely how they're navigated.
const TAB_GROUPS: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; sections: [string, string][] }[] = [
  { id: "overview", label: "Overview", icon: ClipboardList, sections: [["overview", "Overview"]] },
  { id: "execution", label: "Execution", icon: Layers, sections: [
    ["phases", "Phases & Rooms"], ["execution", "Daily Logs & Reports"],
    ["fieldProgress", "Tasks"], ["quality", "Quality & Issues"],
  ] },
  { id: "commercial", label: "Commercial", icon: Wallet, sections: [
    ["payments", "Payments & Invoices"], ["approvals", "Approvals"], ["changeRequests", "Change Requests"],
  ] },
  { id: "resources", label: "Resources", icon: Package, sections: [
    ["materials", "Materials"], ["contractors", "Contractors"], ["labour", "Labour"],
  ] },
  { id: "handover", label: "Handover", icon: CheckCircle2, sections: [["handover", "Handover"]] },
  { id: "documents", label: "Documents", icon: FileText, sections: [["media", "Documents"]] },
  // Shown only once the project is COMPLETED (see the tab-strip filter below).
  { id: "service", label: "Service & Warranty", icon: Settings, sections: [["serviceWarranty", "Service & Warranty"]] },
];
const groupOf = (section: string) =>
  TAB_GROUPS.find((g) => g.sections.some(([v]) => v === section)) || TAB_GROUPS[0];

export default function ProjectCommandCenter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack("/projects");
  const projectId = Number(id);
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Phases & Rooms
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [roomsByPhase, setRoomsByPhase] = useState<Record<number, ProjectRoom[]>>({});
  const [expandedRoom, setExpandedRoom] = useState<number | null>(null);
  const [itemsByRoom, setItemsByRoom] = useState<Record<number, ProjectRoomItem[]>>({});
  const [newPhase, setNewPhase] = useState({ name: '', sequence: 1, budget: 0 });
  const [masterBoq, setMasterBoq] = useState<any>(null);
  const [bulkOpen, setBulkOpen] = useState(false); // "Update Work" batch sheet
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
  const [newStage, setNewStage] = useState({ name: '', dueDate: '' });
  const [newIssue, setNewIssue] = useState({ title: '', description: '', priority: 'MEDIUM' });

  // Quick Actions states
  const [quickActionView, setQuickActionView] = useState<'menu'|'create_task'|'assign_employee'|'report_issue'|'purchase_request'>('menu');
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [newTaskState, setNewTaskState] = useState({ taskName: '', description: '', dueDate: format(new Date(), 'yyyy-MM-dd') });
  const [newAssignState, setNewAssignState] = useState<{ taskId: string; resource: ResourceSelection | null }>({ taskId: '', resource: null });
  const [newPurchaseState, setNewPurchaseState] = useState({ itemDesc: '', quantity: 1 });

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
    projectApi.getPhases(projectId).then(setPhases).catch(err => console.error("Failed to fetch phases", err));
    projectApi.getMaterials(projectId).then(setMaterials).catch(err => console.error("Failed to fetch materials", err));
    api.get(`/inventory/products`).then(res => setProducts(res.data.content || [])).catch(() => {});
    inventoryApi.getWarehouses().then(setWarehouses).catch(() => {});
    projectApi.getMaterialTransactions(projectId).then(setMaterialTransactions).catch(() => {});
    projectApi.getMaterialPurchaseSummary(projectId).then(setPurchaseSummary).catch(() => {});
    projectApi.getTaskMaterialUsage(projectId).then(setMaterialUsage).catch(() => {});
    changeRequestApi.getByProject(projectId).then(setChangeRequests).catch(err => console.error("Failed to fetch change requests", err));
    api.get(`/tasks/project/${projectId}`).then(res => setFieldTasks(res.data)).catch(err => console.error("Failed to fetch field tasks", err));
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

  const toggleExpandPhase = (phaseId: number) => {
    if (expandedPhase === phaseId) {
      setExpandedPhase(null);
      return;
    }
    setExpandedPhase(phaseId);
    if (!roomsByPhase[phaseId]) {
      projectApi.getRooms(phaseId).then(rooms => setRoomsByPhase(prev => ({ ...prev, [phaseId]: rooms })));
    }
  };

  const toggleExpandRoom = (roomId: number) => {
    if (expandedRoom === roomId) {
      setExpandedRoom(null);
      return;
    }
    setExpandedRoom(roomId);
    if (!itemsByRoom[roomId]) {
      projectApi.getItems(roomId).then(items => setItemsByRoom(prev => ({ ...prev, [roomId]: items })));
    }
  };

  const handleAddPhase = () => {
    projectApi.addPhase(projectId, newPhase)
      .then(phase => {
        setPhases(prev => [...prev, phase]);
        setNewPhase({ name: '', sequence: 1, budget: 0 });
      })
      .catch(() => toast.error("Failed to add phase"));
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

  const handleAddStage = () => {
    api.post(`/projects/${id}/stages`, newStage)
      .then(() => {
        fetchCore();
        setNewStage({ name: '', dueDate: '' });
      })
      .catch(_err => toast.error("Failed to add stage"));
  };

  const handleCompleteProject = async () => {
    if (!confirm("Mark this project as COMPLETED?")) return;
    try {
      await api.post(`/projects/${id}/complete`, { certificate: "placeholder-cert-data" });
      await fetchProjectData();
      toast.success("Project marked completed");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to complete project";
      // The completion gate rejects with a readiness summary; let an approver override the checklist.
      if (/ready to complete/i.test(msg)) {
        if (confirm(`${msg}\n\nComplete anyway (override the readiness checklist)?`)) {
          try {
            await api.post(`/projects/${id}/complete`, { certificate: "placeholder-cert-data", force: "true" });
            await fetchProjectData();
            toast.success("Project marked completed");
          } catch (e: any) {
            toast.error(e?.response?.data?.message || "Failed to complete project");
          }
        }
      } else {
        toast.error(msg);
      }
    }
  };

  const handleStartExecution = () => {
    api.post(`/projects/${id}/start-execution`)
      .then(() => fetchProjectData())
      .catch((err: any) => toast.error(err?.response?.data?.message || "Failed to start execution"));
  };

  if (loading) return <div className="p-8 text-slate-500">Loading Command Center...</div>;
  if (!data || !data.project) return <div className="p-8 text-red-500">Project not found</div>;

  const { project, stages, dailyLogs, qualityChecks, issues, risks, documents } = data;
  const profitOrLoss = (project.budget || 0) - (project.spentAmount || 0);
  const utilizationPct = project.budget ? Math.round(((project.spentAmount || 0) / project.budget) * 100) : 0;

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
    api.put(`/projects/${id}`, { ...project, ...patch })
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

  // Recent Activity — synthesized from the project's live sub-records, newest first.
  const activityFeed = (() => {
    const items: { date?: string; activity: string; by?: string; details: string }[] = [];
    (dailyLogs || []).forEach((l: any) => items.push({ date: l.logDate, activity: 'Daily Log', by: l.createdBy?.name || l.recordedBy?.name, details: l.workCompleted || `${l.percentageCompleted ?? 0}% completed` }));
    (issues || []).forEach((i: any) => items.push({ date: i.createdAt || i.reportedDate, activity: 'Issue Reported', by: i.reportedBy?.name || i.createdBy?.name, details: i.title || i.description || 'Issue logged' }));
    (stages || []).forEach((s: any) => items.push({ date: s.completedDate || s.dueDate, activity: s.status === 'COMPLETED' ? 'Stage Completed' : 'Stage Updated', by: undefined, details: s.name }));
    (documents || []).forEach((d: any) => items.push({ date: d.createdAt || d.uploadedAt, activity: 'Document Added', by: d.uploadedBy?.name, details: d.fileName || d.documentName || 'Document' }));
    return items
      .filter((x) => x.details)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 6);
  })();

  // Gantt Chart Logic
  const getGanttTimeline = () => {
    if (!project.startDate || !project.endDate || !stages.length) return null;
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    const totalDays = differenceInDays(projectEnd, projectStart) || 1;

    // Real sequential timeline: stages ordered by due date, each bar spans from the previous
    // milestone (or the project start) to its own due date — derived from actual data, not a
    // fixed placeholder width.
    const sortedStages = [...stages]
      .filter((s: any) => s.dueDate)
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return (
      <div className="mt-8 space-y-4">
        <div className="flex text-xs font-semibold text-slate-400 mb-2 border-b pb-2">
          <div className="w-48 shrink-0">Stage</div>
          <div className="flex-1 flex justify-between relative">
            <span>{format(projectStart, 'MMM d')}</span>
            <span>{format(projectEnd, 'MMM d')}</span>
          </div>
        </div>
        
        {sortedStages.map((stage: any, idx: number) => {
          const mEnd = new Date(stage.dueDate);
          // Segment starts where the previous milestone ended (or at the project start for the first).
          const prevDue = idx > 0 ? new Date(sortedStages[idx - 1].dueDate) : projectStart;
          const mStart = prevDue < projectStart ? projectStart : prevDue;

          let leftPercent = (differenceInDays(mStart, projectStart) / totalDays) * 100;
          let widthPercent = (differenceInDays(mEnd, mStart) / totalDays) * 100;
          
          // Constrain
          leftPercent = Math.max(0, Math.min(100, leftPercent));
          widthPercent = Math.max(1, Math.min(100 - leftPercent, widthPercent));

          return (
            <div key={stage.id} className="flex items-center text-sm group">
              <div className="w-48 shrink-0 font-medium text-slate-700 truncate pr-4" title={stage.name}>{stage.name}</div>
              <div className="flex-1 relative h-8 bg-slate-100 rounded-md overflow-hidden flex items-center">
                <div 
                  className={`absolute h-6 rounded-md shadow-sm transition-all flex items-center px-2 text-xs font-bold text-white whitespace-nowrap overflow-hidden
                    ${stage.status === 'COMPLETED' ? 'bg-green-500' : stage.status === 'IN_PROGRESS' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                  style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    Due: {format(mEnd, 'MMM d')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative overflow-hidden">
      {/* Single smooth-scroll surface: the whole top scrolls away, only the tab bar pins. */}
      <div onScroll={(e) => setScrolled((e.target as HTMLDivElement).scrollTop > 120)} className="flex-1 overflow-y-auto scroll-smooth">

      {/* Breadcrumb */}
      <div className="bg-white px-4 sm:px-6 lg:px-8 pt-2.5 shrink-0 z-10">
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <Link to="/" className="hover:text-emerald-600 flex items-center gap-1"><Home className="w-3.5 h-3.5" /></Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/projects" className="hover:text-emerald-600">Projects</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-600 font-medium truncate">{project.customer?.name || project.projectCode}</span>
        </div>
      </div>

      {/* Premium header band */}
      <div className="bg-white px-4 sm:px-6 lg:px-8 pt-2 shrink-0 z-10">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100/70 bg-gradient-to-r from-emerald-50/60 via-white to-amber-50/40 px-4 sm:px-5 py-3">
          {/* Decorative watermark — faint, centered, wide screens only so it never sits under the cards */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center 2xl:flex">
            <p className="font-serif italic text-xl leading-tight text-emerald-900/[0.07] text-center select-none whitespace-nowrap">
              From Concept to Completion<br/>Beautifully Together
            </p>
          </div>

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-2 sm:gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={goBack} title="Back" className="mt-1 h-8 w-8 rounded-full bg-white/70 text-slate-500 hover:text-slate-700 shrink-0 shadow-sm"><ArrowLeft className="h-4 w-4" /></Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-slate-800 truncate">{project.customer?.name || project.projectName}</h1>
                  {project.customer?.city && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-400"><MapPin className="w-3.5 h-3.5 text-emerald-500" />{project.customer.city}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                  <span className="font-mono font-semibold text-slate-500 bg-slate-100 rounded px-2 py-0.5">{project.projectCode}</span>
                  <button type="button" title="Copy project code"
                    onClick={() => { navigator.clipboard?.writeText(project.projectCode || '').then(() => toast.success('Project code copied')).catch(() => {}); }}
                    className="text-slate-300 hover:text-emerald-600"><Copy className="w-3.5 h-3.5" /></button>
                  {project.projectName && <span className="text-slate-400 truncate">{project.projectName}</span>}
                </div>
                <div className="text-slate-400 flex items-center gap-3 sm:gap-4 text-xs sm:text-sm mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1"><User className="w-4 h-4"/> Customer ID: {project.customer?.id ?? '—'}</span>
                  <span className="flex items-center gap-1"><Mail className="w-4 h-4 text-emerald-400"/> {project.customer?.email || 'N/A'}</span>
                  {project.customer?.phone && (
                    <a href={`tel:${project.customer.phone}`} className="flex items-center gap-1 hover:text-emerald-600"><Phone className="w-4 h-4 text-emerald-400"/> {project.customer.phone}</a>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 text-[11px] rounded-full font-semibold uppercase tracking-wide ${
                    project.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-700' :
                    project.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
                  }`}>
                    {project.status.replace(/_/g, ' ')}
                  </span>
                  {(stats?.health === 'WARNING' || stats?.health === 'CRITICAL') && (
                    <span className={`px-2.5 py-0.5 text-[11px] rounded-full font-semibold uppercase tracking-wide ${
                      stats.health === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {stats.health === 'CRITICAL' ? 'Critical' : 'Warning'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <TrackingLinkDialog projectId={Number(projectId)} />
                <Button variant="outline" className="rounded-xl border-slate-200 text-slate-600 bg-white" onClick={() => { setActiveTab('overview'); startEdit('overview'); }}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit Project
                </Button>
                {project.status !== 'COMPLETED' && (
                  <Button onClick={handleCompleteProject} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 mr-2"/> Mark Completed
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-xl border-slate-200 text-slate-500 bg-white"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {['PLANNING', 'PENDING', 'APPROVED'].includes(project.status) && (
                      <>
                        <DropdownMenuItem onSelect={handleStartExecution}><Play className="w-4 h-4 mr-2"/> Start Execution</DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem asChild><Link to={`/tasks?projectId=${projectId}`}>View Tasks</Link></DropdownMenuItem>
                    {project.customer?.id && (
                      <DropdownMenuItem asChild><Link to={`/customers/${project.customer.id}`}>View Customer</Link></DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Date cards */}
              <div className="flex items-stretch gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 shadow-sm">
                  <Calendar className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Start Date</div>
                    <div className="text-sm font-bold text-slate-700 whitespace-nowrap">{shortDate(project.startDate)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 shadow-sm">
                  <Clock className={`w-5 h-5 shrink-0 ${daysRemaining !== null && daysRemaining < 0 ? 'text-rose-500' : 'text-amber-500'}`} />
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Days Remaining</div>
                    <div className={`text-sm font-bold whitespace-nowrap ${daysRemaining !== null && daysRemaining < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{daysRemainingText}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats strip */}
      {stats && (
        <div className="bg-white px-4 sm:px-6 lg:px-8 py-2.5 shrink-0 z-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { label: "Today's Tasks", value: stats.tasks?.inProgress || 0, sub: 'Nothing for today', icon: CheckCircle2, bg: 'bg-emerald-50/70', ring: 'border-emerald-100', chip: 'bg-emerald-100 text-emerald-600', text: 'text-slate-800', tab: 'fieldProgress' },
              { label: 'Delayed Tasks', value: stats.tasks?.delayed || 0, sub: 'Need attention', icon: Clock, bg: 'bg-rose-50/70', ring: 'border-rose-100', chip: 'bg-rose-100 text-rose-600', text: 'text-slate-800', tab: 'fieldProgress' },
              { label: 'Open Issues', value: stats.issues?.open || 0, sub: 'All clear', icon: AlertTriangle, bg: 'bg-orange-50/70', ring: 'border-orange-100', chip: 'bg-orange-100 text-orange-600', text: 'text-slate-800', tab: 'quality' },
              { label: 'Pending Approvals', value: stats.approvals?.pending || 0, sub: 'Awaiting approval', icon: FileText, bg: 'bg-violet-50/70', ring: 'border-violet-100', chip: 'bg-violet-100 text-violet-600', text: 'text-slate-800', tab: 'approvals' },
              { label: 'Employees Working', value: stats.todayManpower || 0, sub: 'Not assigned', icon: Users, bg: 'bg-emerald-50/70', ring: 'border-emerald-100', chip: 'bg-emerald-100 text-emerald-600', text: 'text-slate-800', tab: 'labour' },
              { label: 'Site Visits', value: stats.siteVisitsToday || 0, sub: 'No visits yet', icon: MapPin, bg: 'bg-sky-50/70', ring: 'border-sky-100', chip: 'bg-sky-100 text-sky-600', text: 'text-slate-800', tab: 'execution' },
            ].map((s) => (
              <button key={s.label} type="button" onClick={() => setActiveTab(s.tab)}
                className={`${s.bg} ${s.ring} border rounded-xl px-3 py-2 flex flex-col text-left transition hover:shadow-sm group`}>
                <div className="flex items-center justify-between">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.chip}`}><s.icon className="w-3.5 h-3.5" /></span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400" />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 mt-1.5 truncate">{s.label}</span>
                <span className={`text-xl font-black ${s.text} leading-tight`}>{s.value}</span>
                <span className="text-[10px] font-medium text-slate-400 truncate">{s.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                    <Button size="sm" onClick={handleCompleteProject} className="bg-emerald-500 hover:bg-emerald-600 rounded-lg h-8 shrink-0"><CheckCircle2 className="w-4 h-4 mr-1.5"/> Mark Completed</Button>
                  )}
                </div>
                {/* Primary strip — the areas of work + Generate Report */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="bg-white p-1 border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] rounded-2xl flex flex-wrap gap-1 justify-start">
                    {TAB_GROUPS.filter((g) => g.id !== "service" || project.status === "COMPLETED").map((g) => {
                      const isActive = g.id === active.id;
                      const Icon = g.icon;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setActiveTab(g.sections[0][0])}
                          className={`rounded-xl px-3.5 py-2 text-sm font-medium transition flex items-center gap-2 shrink-0 ${isActive ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
                        >
                          <Icon className="w-4 h-4" />
                          {g.label}
                          {g.id === "execution" && issueCount > 0 && (
                            <span className={`px-1.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white/25 text-white" : "bg-red-100 text-red-600"}`}>{issueCount}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="rounded-xl border-slate-200 text-slate-600 bg-white shrink-0">
                        <FileBarChart className="w-4 h-4 mr-2 text-emerald-600" /> Generate Report <ChevronDown className="w-4 h-4 ml-2" />
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
                  <div className="flex flex-wrap gap-1 px-1">
                    {active.sections.map(([value, label]) => {
                      const isActive = value === activeTab;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setActiveTab(value)}
                          className={`rounded-lg px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 shrink-0 ${isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "text-slate-500 hover:bg-slate-50"}`}
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

          <div className="pb-20">
            
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-3 mt-0 h-full outline-none">
              {/* Band A — key facts · financial+progress · customer/actions, packed in one row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                {/* Project Overview — key facts (inline editable) */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center"><ClipboardCheck className="w-4 h-4 mr-2 text-emerald-600"/> Project Overview</h3>
                    {!editingOverview ? (
                      <button type="button" onClick={() => startEdit('overview')} className="text-slate-400 hover:text-emerald-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={saveOverview} disabled={savingProject} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50" title="Save"><Check className="w-4 h-4" /></button>
                        <button type="button" onClick={() => setEditingOverview(false)} className="text-slate-400 hover:text-rose-500" title="Cancel"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    <EditRow label={<><FileText className="w-3.5 h-3.5 text-slate-300"/> Project Type</>} editing={editingOverview} view={project.projectType || '—'}>
                      <input className={cellInput} value={pform.projectType} onChange={e => setPform({ ...pform, projectType: e.target.value })} placeholder="Residential, Commercial…" />
                    </EditRow>
                    <EditRow label={<><Building2 className="w-3.5 h-3.5 text-slate-300"/> Property Type</>} editing={editingOverview} view={project.projectCategory || '—'}>
                      <input className={cellInput} value={pform.projectCategory} onChange={e => setPform({ ...pform, projectCategory: e.target.value })} placeholder="Apartment, Villa…" />
                    </EditRow>
                    <EditRow label={<><Flag className="w-3.5 h-3.5 text-slate-300"/> Priority</>} editing={editingOverview}
                      view={project.priority ? <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[11px] font-bold uppercase">{project.priority}</span> : '—'}>
                      <select className={cellInput} value={pform.priority} onChange={e => setPform({ ...pform, priority: e.target.value })}>
                        {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </EditRow>
                    <EditRow label={<><User className="w-3.5 h-3.5 text-slate-300"/> Project Manager</>} editing={editingOverview} view={project.projectManager?.name || '—'} />
                    <EditRow label={<><Calendar className="w-3.5 h-3.5 text-slate-300"/> Start Date</>} editing={editingOverview} view={shortDate(project.startDate)}>
                      <input type="date" className={cellInput} value={pform.startDate} onChange={e => setPform({ ...pform, startDate: e.target.value })} />
                    </EditRow>
                    <EditRow label={<><Flag className="w-3.5 h-3.5 text-slate-300"/> Target Completion</>} editing={editingOverview} view={shortDate(project.endDate)}>
                      <input type="date" className={cellInput} value={pform.endDate} onChange={e => setPform({ ...pform, endDate: e.target.value })} />
                    </EditRow>
                    <EditRow label={<><Clock className="w-3.5 h-3.5 text-slate-300"/> Days Remaining</>} editing={editingOverview}
                      view={<span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${daysRemaining !== null && daysRemaining < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{daysRemainingText}</span>} />
                    <EditRow label={<><IndianRupee className="w-3.5 h-3.5 text-slate-300"/> Project Value</>} editing={editingOverview} view={project.estimatedCost ? inr(project.estimatedCost) : (project.budget ? inr(project.budget) : '—')}>
                      <input type="number" min={0} className={cellInput} value={pform.estimatedCost} onChange={e => setPform({ ...pform, estimatedCost: e.target.value })} placeholder="Estimated value" />
                    </EditRow>
                  </div>

                  {/* Description (+ address & requirements when editing) */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> Description</div>
                    {editingOverview
                      ? <textarea className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={pform.projectDescription} onChange={e => setPform({ ...pform, projectDescription: e.target.value })} placeholder="Scope / description of the project" />
                      : <div className="text-sm font-medium text-slate-700 whitespace-pre-line">{project.projectDescription || <span className="text-slate-400 font-normal">No description added yet. Click edit to add project details.</span>}</div>}
                  </div>
                  {editingOverview && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Property Address</div>
                        <textarea className="w-full min-h-[48px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={pform.propertyAddress} onChange={e => setPform({ ...pform, propertyAddress: e.target.value })} placeholder="Site / property address" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Customer Requirements</div>
                        <textarea className="w-full min-h-[48px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={pform.customerNotes} onChange={e => setPform({ ...pform, customerNotes: e.target.value })} placeholder="What the customer asked for" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Project Progress — donut + legend + planning tip */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center"><Activity className="w-4 h-4 mr-2 text-emerald-600"/> Project Progress</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative h-24 w-24 shrink-0">
                      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100" />
                        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" strokeLinecap="round"
                          className={(project.progress || 0) >= 100 ? 'text-emerald-500' : 'text-emerald-600'}
                          stroke="currentColor"
                          strokeDasharray={2 * Math.PI * 42}
                          strokeDashoffset={2 * Math.PI * 42 * (1 - Math.min(100, project.progress || 0) / 100)} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-slate-800 leading-none">{project.progress || 0}%</span>
                        <span className="text-[9px] font-semibold uppercase text-slate-400 mt-0.5">Complete</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-300 shrink-0"/><span className="font-bold text-slate-700">{project.progress || 0}%</span><span className="text-slate-400">Execution</span></div>
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-500 shrink-0"/><span className="font-bold text-slate-700">{stats?.tasks?.completed ?? 0} of {stats?.tasks?.total ?? 0}</span><span className="text-slate-400">Tasks Completed</span></div>
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0"/><span className="font-bold text-slate-700">{stats?.tasks?.delayed ?? 0}</span><span className="text-slate-400">Delayed Tasks</span></div>
                      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0"/><span className="font-bold text-slate-700">{stats?.issues?.open ?? 0}</span><span className="text-slate-400">Open Issues</span></div>
                    </div>
                  </div>
                  {(project.status === 'PLANNING' || (project.progress || 0) === 0) && (
                    <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-100 p-2.5 text-[11px] text-sky-800">
                      <Sparkles className="w-4 h-4 shrink-0 text-sky-500 mt-0.5" />
                      <span>Project is in planning stage. Start adding tasks, resources and documents to track progress effectively.</span>
                    </div>
                  )}
                </div>

                {/* Right column — Financial Summary + Quick Actions */}
                <div className="lg:col-span-3 space-y-3">
                  {/* Financial Summary */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-slate-700 flex items-center"><Wallet className="w-4 h-4 mr-2 text-emerald-600"/> Financial Summary</h3>
                      <button type="button" onClick={() => setActiveTab('payments')} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">View Details</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3">
                        <Wallet className="w-4 h-4 text-emerald-600 mb-1.5" />
                        {editingOverview
                          ? <input type="number" min={0} className={cellInput + " font-bold"} value={pform.budget} onChange={e => setPform({ ...pform, budget: e.target.value })} placeholder="Budget" />
                          : <div className="text-lg font-black text-slate-800 leading-tight truncate">{inr(project.budget)}</div>}
                        <div className="text-[10px] font-medium text-slate-400 mt-0.5">Total Budget</div>
                      </div>
                      <div className="rounded-xl bg-violet-50/70 border border-violet-100 p-3">
                        <BarChart3 className="w-4 h-4 text-violet-600 mb-1.5" />
                        <div className="text-lg font-black text-slate-800 leading-tight truncate">{inr(project.spentAmount)}</div>
                        <div className="text-[10px] font-medium text-slate-400 mt-0.5">Amount Spent</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full transition-all ${profitOrLoss < 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, utilizationPct)}%` }} />
                      </div>
                      <div className="mt-1 text-right text-[11px] font-semibold text-slate-500">{utilizationPct}% Utilization</div>
                    </div>
                    {!project.budget && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-400"><IndianRupee className="w-3.5 h-3.5 shrink-0 mt-0.5"/> Add budget details to track project expenses and profitability.</div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <h3 className="text-sm font-bold text-slate-700 mb-2.5 flex items-center"><Sparkles className="w-4 h-4 mr-2 text-slate-400"/> Quick Actions</h3>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { label: 'Add Task', icon: CheckSquare, color: 'text-emerald-500', onClick: () => { setQuickActionView('create_task'); setQuickActionOpen(true); } },
                        { label: 'Issue', icon: AlertTriangle, color: 'text-amber-500', onClick: () => { setQuickActionView('report_issue'); setQuickActionOpen(true); } },
                        { label: 'Assign', icon: Users, color: 'text-amber-500', onClick: () => { setQuickActionView('assign_employee'); setQuickActionOpen(true); } },
                        { label: 'Site Visit', icon: MapPin, color: 'text-violet-500', onClick: () => setActiveTab('execution') },
                        { label: 'Call', icon: Phone, color: 'text-slate-500', href: project.customer?.phone ? `tel:${project.customer.phone}` : undefined },
                        { label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-500', href: project.customer?.phone ? `https://wa.me/${String(project.customer.phone).replace(/\D/g, '')}` : undefined },
                        { label: 'Purchase', icon: ShoppingCart, color: 'text-violet-500', onClick: () => { setQuickActionView('purchase_request'); setQuickActionOpen(true); } },
                        { label: 'More', icon: MoreHorizontal, color: 'text-slate-500', onClick: () => { setQuickActionView('menu'); setQuickActionOpen(true); } },
                      ] as const).map((a) => {
                        const cls = "flex flex-col items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 px-1 py-2 text-[10px] font-semibold text-slate-600 text-center transition-colors";
                        return ('href' in a)
                          ? <a key={a.label} href={(a as any).href} target={a.label === 'WhatsApp' ? '_blank' : undefined} rel="noreferrer" className={cls}><a.icon className={`w-4 h-4 ${a.color}`} /><span className="truncate w-full">{a.label}</span></a>
                          : <button key={a.label} type="button" onClick={(a as any).onClick} className={cls}><a.icon className={`w-4 h-4 ${a.color}`} /><span className="truncate w-full">{a.label}</span></button>;
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Band B — team · activity · notes */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                {/* Project Team */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center"><Users className="w-4 h-4 mr-2 text-emerald-600"/> Project Team</h3>
                    <Link to={`/tasks?projectId=${projectId}`} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">Assign Team</Link>
                  </div>
                  {(() => {
                    const team = ([['Project Manager', project.projectManager], ['Sales', project.salesExecutive], ['Designer', project.designer], ['Site Engineer', project.siteEngineer]] as [string, any][]).filter(([, u]) => u);
                    return team.length > 0 ? (
                      <div className="space-y-2">
                        {team.map(([role, u]) => (
                          <div key={role} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold shrink-0">{(u.name || '?').charAt(0).toUpperCase()}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-700 truncate">{u.name}</div>
                              <div className="text-[11px] text-slate-400">{role}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-300"><Users className="w-7 h-7" /></span>
                        <div className="text-sm font-semibold text-slate-600 mt-3">No team members assigned yet</div>
                        <div className="text-xs text-slate-400 mt-0.5">Assign team members to collaborate on this project.</div>
                        <Button asChild size="sm" className="mt-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                          <Link to={`/tasks?projectId=${projectId}`}><Plus className="w-4 h-4 mr-1.5"/> Assign Team</Link>
                        </Button>
                      </div>
                    );
                  })()}
                </div>

                {/* Recent Activity — timeline, scroll-capped */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center"><History className="w-4 h-4 mr-2 text-emerald-600"/> Recent Activity</h3>
                    <button type="button" onClick={() => setActiveTab('execution')} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">View All</button>
                  </div>
                  {activityFeed.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {activityFeed.map((a, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1 ${i === 0 ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                            {i < activityFeed.length - 1 && <span className="w-px flex-1 bg-slate-100 my-1" />}
                          </div>
                          <div className="min-w-0 flex-1 -mt-0.5 pb-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-700">{a.activity}</div>
                              {a.date && <div className="text-[10px] text-slate-400 text-right whitespace-nowrap leading-tight">{format(new Date(a.date), 'dd MMM yyyy')}<br/>{format(new Date(a.date), 'hh:mm a')}</div>}
                            </div>
                            {(a.details || a.by) && <div className="text-xs text-slate-400 truncate" title={a.details}>{a.details}{a.by ? ` · ${a.by}` : ''}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-slate-400">No recent activity yet.</div>
                  )}
                </div>

                {/* Notes & Comments */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center"><StickyNote className="w-4 h-4 mr-2 text-emerald-600"/> Notes &amp; Comments</h3>
                    <button type="button" onClick={() => toast.success('Notes & comments are coming soon.')} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">Add Note</button>
                  </div>
                  <div className="py-5 text-center">
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-300"><MessageCircle className="w-5 h-5" /></span>
                    <div className="text-sm font-semibold text-slate-500 mt-2">No notes yet</div>
                    <div className="text-xs text-slate-400 mt-0.5">Add notes, updates or comments about this project.</div>
                  </div>
                </div>
              </div>

              {/* Gantt / Stages */}
              <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-between border-b pb-2.5 mb-1">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center"><TrendingUp className="w-4 h-4 mr-2 text-emerald-600"/> Project Stages &amp; Gantt</h3>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2"/> Add Stage</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Stage</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Stage Name</Label>
                          <Input value={newStage.name} onChange={e => setNewStage({...newStage, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                           <Label>Due Date</Label>
                           <Input type="date" value={newStage.dueDate} onChange={e => setNewStage({...newStage, dueDate: e.target.value})} />
                        </div>
                        <Button className="w-full" onClick={handleAddStage}>Save Stage</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {stages.length > 0 ? getGanttTimeline() : (
                  <div className="py-6 text-center text-sm text-slate-500">
                    No stages added yet. Add stages to generate the Gantt chart.
                  </div>
                )}
              </div>

              {/* Brand banner */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-100/70 bg-gradient-to-r from-emerald-50/70 via-white to-amber-50/50 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Building2 className="w-4 h-4" /></span>
                  <p className="font-serif italic text-sm sm:text-base text-emerald-900/70">“Well Planned Projects Turn Houses into Homes.”</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black tracking-tight text-emerald-800">JB DECOR</div>
                  <div className="text-[11px] text-slate-400">Crafted for Better Living</div>
                </div>
              </div>
            </TabsContent>

            {/* PHASES & ROOMS TAB */}
            <TabsContent value="phases" className="space-y-6 mt-0 h-full outline-none">
              {progressDashboard && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-600 flex items-center"><TrendingUp className="w-4 h-4 mr-2 text-emerald-600"/> Overall Project Progress</span>
                      <span className="text-2xl font-bold text-slate-800">{progressDashboard.overallProgress}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${progressBarColor(progressDashboard.overallProgress)} rounded-full transition-all`} style={{ width: `${progressDashboard.overallProgress}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {([
                      ['Completed Tasks', progressDashboard.completedTasks, 'text-emerald-600'],
                      ['In Progress', progressDashboard.inProgressTasks, 'text-emerald-600'],
                      ['Pending Tasks', progressDashboard.pendingTasks, 'text-slate-600'],
                      ['Delayed Tasks', progressDashboard.delayedTasks, 'text-red-600'],
                      ['Inspection Pending', progressDashboard.inspectionPending, 'text-amber-600'],
                      ['Completed Rooms', `${progressDashboard.completedRooms}/${progressDashboard.totalRooms}`, 'text-emerald-600'],
                      ['Completed Floors', `${progressDashboard.completedFloors}/${progressDashboard.totalFloors}`, 'text-emerald-600'],
                      ['Completed Phases', `${progressDashboard.completedPhases}/${progressDashboard.totalPhases}`, 'text-emerald-600'],
                      ['Delayed Rooms', progressDashboard.delayedRooms, 'text-red-600'],
                      ['Delayed Phases', progressDashboard.delayedPhases, 'text-red-600'],
                    ] as [string, number | string, string][]).map(([label, value, color]) => (
                      <div key={label} className="bg-white border border-slate-100 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-3">
                        <div className={`text-2xl font-bold ${color}`}>{value}</div>
                        <div className="text-[11px] font-medium text-slate-400 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  {progressDashboard.floors.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4">
                      <div className="text-sm font-semibold text-slate-600 mb-3">Floor Progress</div>
                      <div className="space-y-2.5">
                        {progressDashboard.floors.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-sm">
                            <div className="w-40 shrink-0 truncate">
                              <span className="font-medium text-slate-700">{f.floorName}</span>
                              <span className="text-xs text-slate-400 ml-1">· {f.phaseName}</span>
                            </div>
                            <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${progressBarColor(f.progress)} rounded-full`} style={{ width: `${f.progress}%` }} />
                            </div>
                            <span className="w-10 text-right text-xs font-semibold text-slate-500">{f.progress}%</span>
                            {f.completed && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                            {f.delayed && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded shrink-0">DELAYED</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                <div className="flex gap-3">
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
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button><Plus className="w-4 h-4 mr-2"/> Add Phase</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Phase</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2"><Label>Phase Name</Label><Input value={newPhase.name} onChange={e => setNewPhase({ ...newPhase, name: e.target.value })} placeholder="e.g. Ground Floor" /></div>
                        <div className="space-y-2"><Label>Sequence</Label><Input type="number" value={newPhase.sequence} onChange={e => setNewPhase({ ...newPhase, sequence: Number(e.target.value) })} /></div>
                        <div className="space-y-2"><Label>Budget</Label><Input type="number" value={newPhase.budget} onChange={e => setNewPhase({ ...newPhase, budget: Number(e.target.value) })} /></div>
                        <Button className="w-full" onClick={handleAddPhase}>Save Phase</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Batch "Update Work" sheet — record a day's progress across many items at once. */}
              <BulkWorkUpdateDialog
                projectId={projectId}
                open={bulkOpen}
                onOpenChange={setBulkOpen}
                onApplied={() => {
                  fetchProjectData();
                  if (expandedRoom) projectApi.getItems(expandedRoom)
                    .then(items => setItemsByRoom(prev => ({ ...prev, [expandedRoom]: items }))).catch(() => {});
                }}
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

              <div className="space-y-3">
                {phases.map(phase => (
                  <div key={phase.id} className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                    <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50" onClick={() => toggleExpandPhase(phase.id!)}>
                      <div className="flex items-center gap-3">
                        {expandedPhase === phase.id ? <ChevronDown className="w-4 h-4 text-slate-400"/> : <ChevronRight className="w-4 h-4 text-slate-400"/>}
                        <span className="font-bold text-slate-800">{phase.name}</span>
                        <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{phase.status}</span>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-slate-500">
                        <span>Budget: {inr(phase.budget)}</span>
                        <span>{phase.completionPercentage || 0}% complete</span>
                      </div>
                    </button>
                    {expandedPhase === phase.id && (
                      <div className="border-t bg-slate-50/50 p-4 space-y-2">
                        {(roomsByPhase[phase.id!] || []).map(room => (
                          <div key={room.id} className="bg-white border rounded-xl overflow-hidden">
                            <button className="w-full flex items-center justify-between p-3 hover:bg-slate-50" onClick={() => toggleExpandRoom(room.id!)}>
                              <div className="flex items-center gap-2">
                                {expandedRoom === room.id ? <ChevronDown className="w-3.5 h-3.5 text-slate-400"/> : <ChevronRight className="w-3.5 h-3.5 text-slate-400"/>}
                                <span className="font-medium text-slate-700 text-sm">{room.roomName}</span>
                                {room.floorName && <span className="text-xs text-slate-400">({room.floorName})</span>}
                              </div>
                              <span className="text-xs text-slate-500">{room.completionPercentage || 0}%</span>
                            </button>
                            {expandedRoom === room.id && (
                              <div className="border-t p-3 space-y-1.5">
                                {(itemsByRoom[room.id!] || []).map(item => {
                                  const pct = item.progress ?? 0;
                                  return (
                                  <button key={item.id} onClick={() => openItemEditor(item)}
                                    className="w-full flex items-center gap-3 text-sm py-2 px-2 rounded hover:bg-slate-50 text-left">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-700 truncate">{item.itemName}</span>
                                        {item.locked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                                        <span className="text-[10px] text-slate-400 uppercase shrink-0">{item.itemType}</span>
                                        {item.assignedResource && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0 truncate max-w-[120px]">
                                            {item.assignedResource.name}
                                          </span>
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
                                  );
                                })}
                                {(itemsByRoom[room.id!] || []).length === 0 && <p className="text-xs text-slate-400 py-2">No items yet.</p>}
                              </div>
                            )}
                          </div>
                        ))}
                        {(roomsByPhase[phase.id!] || []).length === 0 && <p className="text-sm text-slate-400 py-2">No rooms yet.</p>}
                      </div>
                    )}
                  </div>
                ))}
                {phases.length === 0 && (
                  <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
                    <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No phases yet. Add one manually or generate from the linked BOQ.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* PAYMENTS & INVOICES TAB */}
            <TabsContent value="payments" className="space-y-6 mt-0 h-full outline-none">
              <ProjectPaymentsTab project={project} onChanged={fetchProjectData} />
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
                        <div className="space-y-2"><Label>Unit</Label><Input value={newMaterial.unit} onChange={e => setNewMaterial({ ...newMaterial, unit: e.target.value })} placeholder="e.g. pcs, kg, sqft" /></div>
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
                      <div className="space-y-2"><Label>Unit</Label><Input value={newProduct.unit} onChange={e => setNewProduct(s => ({ ...s, unit: e.target.value }))} placeholder="pcs, kg, bag" /></div>
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

            {/* APPROVALS TAB */}
            <TabsContent value="approvals" className="space-y-4 mt-0 h-full outline-none">
              <ApprovalsTab projectId={projectId} approvals={data.approvals} onChanged={fetchCore} onStatsChanged={fetchStats} />
            </TabsContent>

            {/* CHANGE REQUESTS TAB */}
            <TabsContent value="changeRequests" className="space-y-6 mt-0 h-full outline-none">
              <ChangeRequestsTab projectId={projectId} phases={phases} changeRequests={changeRequests} onChangeRequestsChanged={() => changeRequestApi.getByProject(projectId).then(setChangeRequests)} onFullRefresh={fetchProjectData} />
            </TabsContent>

            {/* DAILY LOGS & REPORTS — the site's execution logs + the employees' submitted daily reports, together */}
            <TabsContent value="execution" className="space-y-8 mt-0 h-full outline-none">
              <DailyLogsTab projectId={projectId} dailyLogs={dailyLogs} onChanged={fetchCore} />
              <div className="border-t border-slate-100 pt-8">
                <EntityDailyReports projectId={projectId} />
              </div>
            </TabsContent>

            {/* FIELD PROGRESS TAB — read-only view into the mobile Employee Task module (manager: live progress + employee timeline) */}
            <TabsContent value="fieldProgress" className="space-y-6 mt-0 h-full outline-none">
              <FieldProgressTab projectId={projectId} fieldTasks={fieldTasks} onChanged={() => api.get(`/tasks/project/${projectId}`).then(res => setFieldTasks(res.data)).catch(() => {})} />
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
            <TabsContent value="quality" className="space-y-8 mt-0 h-full outline-none">
              <QualityTab projectId={projectId} qualityChecks={qualityChecks} onChanged={fetchCore} />
              <div className="border-t border-slate-100 pt-8">
                <IssuesRisksTab projectId={projectId} issues={issues} risks={risks} onChanged={fetchCore} onStatsChanged={fetchStats} />
              </div>
            </TabsContent>

            {/* MEDIA TAB */}
            <TabsContent value="handover" className="mt-0 h-full outline-none">
              <HandoverTab project={project} onChanged={fetchProjectData} />
            </TabsContent>

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
                <input type="range" min={0} max={100} step={5} value={itemForm.progress} disabled={editingItem.locked}
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
                        <input type="file" accept="image/*" className="hidden"
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

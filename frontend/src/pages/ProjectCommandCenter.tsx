import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { uploadFile, resolveFileUrl } from "@/lib/uploadFile";
import { projectApi } from "@/api/projectApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { boqApi } from "@/api/boqApi";
import { changeRequestApi } from "@/api/changeRequestApi";
import { inventoryApi } from "@/api/inventoryApi";
import { ProjectPhase, ProjectRoom, ProjectRoomItem, ProjectMaterialRequirement, ProjectProgress, ProjectProgressDashboard, ProjectItemProgressLog, WORK_ITEM_STATUSES } from "@/types/project";
import { ProjectChangeRequest, ChangeRequestType, CHANGE_REQUEST_TYPE_LABELS, CHANGE_REQUEST_STATUS_STYLES } from "@/types/changeRequest";
import ProjectPaymentsTab from "@/pages/projectFinance/ProjectPaymentsTab";
import CameraCaptureButton from "@/components/CameraCaptureButton";
import { format, differenceInDays } from "date-fns";
import {
  ArrowLeft, Calendar, User, DollarSign, Activity, FileText,
  AlertTriangle, ShieldAlert, CheckCircle2, FileImage, PenTool,
  TrendingUp, Plus, CheckSquare, Layers, Package, Sparkles,
  ChevronDown, ChevronRight, ShoppingCart, ClipboardCheck, FileEdit,
  Phone, Mail, Clock, Sun, File, Play, History, RotateCcw, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ProjectContractorsTab from "@/pages/contractors/ProjectContractorsTab";
import ResourceSelect, { ResourceSelection } from "@/components/workforce/ResourceSelect";
import { ResourceType } from "@/types/workforce";

const ITEM_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  ASSIGNED: 'bg-indigo-100 text-indigo-700',
  MATERIAL_READY: 'bg-cyan-100 text-cyan-700',
  STARTED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  INSPECTION: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  REWORK: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
};
const itemStatusStyle = (status?: string) => ITEM_STATUS_STYLES[(status || 'PENDING').toUpperCase()] || ITEM_STATUS_STYLES.PENDING;
const progressBarColor = (pct: number) => pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300';

export default function ProjectCommandCenter() {
  const { id } = useParams();
  const projectId = Number(id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Phases & Rooms
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [roomsByPhase, setRoomsByPhase] = useState<Record<number, ProjectRoom[]>>({});
  const [expandedRoom, setExpandedRoom] = useState<number | null>(null);
  const [itemsByRoom, setItemsByRoom] = useState<Record<number, ProjectRoomItem[]>>({});
  const [newPhase, setNewPhase] = useState({ name: '', sequence: 1, budget: 0 });
  const [generatingFromBoq, setGeneratingFromBoq] = useState(false);
  const [masterBoq, setMasterBoq] = useState<any>(null);

  // Progress tracking: live dashboard + work-item editor
  const [progressDashboard, setProgressDashboard] = useState<ProjectProgressDashboard | null>(null);
  const [editingItem, setEditingItem] = useState<ProjectRoomItem | null>(null);
  const [itemForm, setItemForm] = useState<{ progress: number; status: string; remarks: string }>({ progress: 0, status: 'PENDING', remarks: '' });
  const [itemPhotos, setItemPhotos] = useState<string[]>([]);
  const [itemTimeline, setItemTimeline] = useState<ProjectItemProgressLog[]>([]);
  const [savingItem, setSavingItem] = useState(false);
  const [itemPhotoUploading, setItemPhotoUploading] = useState(false);

  // Field Progress — read-only view into the mobile Employee Task module's live execution data
  const [fieldTasks, setFieldTasks] = useState<any[]>([]);
  const [expandedFieldTask, setExpandedFieldTask] = useState<number | null>(null);
  const [fieldTaskAssignments, setFieldTaskAssignments] = useState<Record<number, any[]>>({});

  // Materials
  const [materials, setMaterials] = useState<ProjectMaterialRequirement[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [newMaterial, setNewMaterial] = useState({ productId: '', requiredQty: 0, unit: '' });

  // Materials — stock movements, purchase summary, new product
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [materialTransactions, setMaterialTransactions] = useState<any[]>([]);
  const [purchaseSummary, setPurchaseSummary] = useState<any[]>([]);
  const [stockMove, setStockMove] = useState<{ open: boolean; direction: 'IN' | 'OUT'; productId: string; type: string; quantity: number; warehouseId: string; reference: string }>(
    { open: false, direction: 'IN', productId: '', type: 'PURCHASE', quantity: 1, warehouseId: '', reference: '' });
  const [newProduct, setNewProduct] = useState({ open: false, name: '', unit: '', costPrice: '', sellingPrice: '', brand: '' });

  // Change Requests
  const [changeRequests, setChangeRequests] = useState<ProjectChangeRequest[]>([]);
  const [newChangeRequest, setNewChangeRequest] = useState<{ changeType: ChangeRequestType; reason: string; description: string }>({
    changeType: 'CUSTOMER_REQUEST', reason: '', description: '',
  });
  const [changeRequestPhaseActions, setChangeRequestPhaseActions] = useState<Record<string, 'ACTIVATE' | 'DEACTIVATE'>>({});

  // Form states for dialogs
  const [newStage, setNewStage] = useState({ name: '', dueDate: '' });
  const [newDailyLog, setNewDailyLog] = useState({ logDate: format(new Date(), 'yyyy-MM-dd'), percentageCompleted: 0, workCompleted: '', workPending: '', issues: '', weather: '', manpower: 0 });
  const [newIssue, setNewIssue] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [newQualityCheck, setNewQualityCheck] = useState({ checklistCategory: '', itemChecked: '', status: 'APPROVED', remarks: '', inspectionDate: format(new Date(), 'yyyy-MM-dd') });

  // Quick Actions states
  const [quickActionView, setQuickActionView] = useState<'menu'|'create_task'|'assign_employee'|'report_issue'|'purchase_request'>('menu');
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [newTaskState, setNewTaskState] = useState({ taskName: '', description: '', dueDate: format(new Date(), 'yyyy-MM-dd') });
  const [newAssignState, setNewAssignState] = useState<{ taskId: string; resource: ResourceSelection | null }>({ taskId: '', resource: null });
  const [newPurchaseState, setNewPurchaseState] = useState({ itemDesc: '', quantity: 1 });

  // Project document upload (import from device)
  const [docType, setDocType] = useState('Photos');
  const [docUploading, setDocUploading] = useState(false);
  const uploadProjectDocument = async (file: File) => {
    setDocUploading(true);
    try {
      const { fileUrl, fileName } = await uploadFile(file, 'PROJECT');
      await api.post(`/projects/${id}/documents`, { fileName, fileUrl, documentType: docType });
      fetchProjectData();
    } catch (err) {
      console.error('Failed to upload document', err);
      alert('Failed to upload document. Please try again.');
    } finally {
      setDocUploading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const fetchProjectData = () => {
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
    projectApi.getProgress(projectId).then(setProgress).catch(err => console.error("Failed to fetch progress", err));
    projectApi.getProgressDashboard(projectId).then(setProgressDashboard).catch(err => console.error("Failed to fetch progress dashboard", err));
    projectApi.getPhases(projectId).then(setPhases).catch(err => console.error("Failed to fetch phases", err));
    projectApi.getMaterials(projectId).then(setMaterials).catch(err => console.error("Failed to fetch materials", err));
    api.get(`/inventory/products`).then(res => setProducts(res.data.content || [])).catch(() => {});
    inventoryApi.getWarehouses().then(setWarehouses).catch(() => {});
    projectApi.getMaterialTransactions(projectId).then(setMaterialTransactions).catch(() => {});
    projectApi.getMaterialPurchaseSummary(projectId).then(setPurchaseSummary).catch(() => {});
    changeRequestApi.getByProject(projectId).then(setChangeRequests).catch(err => console.error("Failed to fetch change requests", err));
    api.get(`/tasks/project/${projectId}`).then(res => setFieldTasks(res.data)).catch(err => console.error("Failed to fetch field tasks", err));
    api.get(`/projects/${id}/command-center-stats`).then(res => setStats(res.data)).catch(err => console.error("Failed to fetch stats", err));
  };

  const toggleExpandFieldTask = (taskId: number) => {
    if (expandedFieldTask === taskId) {
      setExpandedFieldTask(null);
      return;
    }
    setExpandedFieldTask(taskId);
    if (!fieldTaskAssignments[taskId]) {
      api.get(`/tasks/${taskId}/assignments`).then(res => setFieldTaskAssignments(prev => ({ ...prev, [taskId]: res.data })));
    }
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
       .catch(err => alert(err?.response?.data?.message || 'Failed to assign resource'));
  };
  const handleQuickIssue = () => {
     api.post(`/projects/${projectId}/issues`, newIssue)
       .then(() => { setQuickActionOpen(false); setQuickActionView('menu'); fetchProjectData(); })
       .catch(err => console.error(err));
  };
  const handleQuickPurchase = () => {
     api.post(`/projects/${projectId}/purchases`, newPurchaseState)
       .then(() => { setQuickActionOpen(false); setQuickActionView('menu'); fetchProjectData(); })
       .catch(err => console.error(err));
  };

  const handleCreateChangeRequest = () => {
    if (!newChangeRequest.reason) { alert("Enter a reason for this change request"); return; }
    changeRequestApi.create(projectId, newChangeRequest)
      .then(async (cr) => {
        const entries = Object.entries(changeRequestPhaseActions);
        for (const [phaseId, action] of entries) {
          await changeRequestApi.addPhaseAction(cr.id!, Number(phaseId), action);
        }
        setNewChangeRequest({ changeType: 'CUSTOMER_REQUEST', reason: '', description: '' });
        setChangeRequestPhaseActions({});
        changeRequestApi.getByProject(projectId).then(setChangeRequests);
      })
      .catch(() => alert("Failed to submit change request"));
  };

  const handleApproveChangeRequest = (crId: number) => {
    if (!confirm("Approve and apply this change request now? This will create a new BOQ revision and cascade to tasks/materials/quotation.")) return;
    changeRequestApi.approve(crId)
      .then(() => {
        changeRequestApi.getByProject(projectId).then(setChangeRequests);
        fetchProjectData();
      })
      .catch((err) => alert(err?.response?.data?.message || err?.message || "Failed to approve change request"));
  };

  const handleRejectChangeRequest = (crId: number) => {
    const reason = window.prompt("Reason for rejection (optional):") || undefined;
    changeRequestApi.reject(crId, reason).then(() => changeRequestApi.getByProject(projectId).then(setChangeRequests))
      .catch(() => alert("Failed to reject change request"));
  };

  const handleCompleteChangeRequest = (crId: number) => {
    changeRequestApi.complete(crId).then(() => changeRequestApi.getByProject(projectId).then(setChangeRequests))
      .catch(() => alert("Failed to mark change request completed"));
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
      .catch(() => alert("Failed to add phase"));
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
    projectApi.getProgress(projectId).then(setProgress).catch(() => {});
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
      alert('Failed to upload photo. Please try again.');
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
      .catch(err => alert(err?.response?.data?.message || "Failed to update work item"))
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
      .catch(err => alert(err?.response?.data?.message || "Failed to update assignment"));
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
      .catch(err => alert(err?.response?.data?.message || "Failed to reopen work item"))
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

  const handleGenerateFromBoq = () => {
    setGeneratingFromBoq(true);
    projectApi.generateFromBoq(projectId)
      .then(result => {
        const totalChanges = result.phasesCreated + result.roomsCreated + result.tasksCreated + result.materialsCreated;
        if (totalChanges === 0) {
          alert("Already in sync with the linked BOQ — nothing new to generate. The BOQ has no active items, or its phases/rooms/tasks were generated already.");
        } else {
          alert(`Generated ${result.phasesCreated} phase(s), ${result.roomsCreated} room(s), ${result.tasksCreated} task(s), ${result.materialsCreated} material requirement(s).`);
        }
        projectApi.getPhases(projectId).then(setPhases);
        projectApi.getMaterials(projectId).then(setMaterials);
      })
      .catch((err) => alert(err?.response?.data?.message || err?.message || "Failed to generate from BOQ (does this project have a linked BOQ?)"))
      .finally(() => setGeneratingFromBoq(false));
  };

  const handleAddMaterial = () => {
    if (!newMaterial.productId) { alert("Select a product"); return; }
    projectApi.addMaterial(projectId, {
      product: { id: Number(newMaterial.productId) },
      requiredQty: Number(newMaterial.requiredQty),
      unit: newMaterial.unit,
    })
      .then(m => {
        setMaterials(prev => [...prev, m]);
        setNewMaterial({ productId: '', requiredQty: 0, unit: '' });
      })
      .catch(() => alert("Failed to add material requirement"));
  };

  const handleUpdateMaterialQty = (reqId: number, field: 'reservedQty' | 'issuedQty' | 'returnedQty' | 'consumedQty', value: number) => {
    const material = materials.find(m => m.id === reqId);
    if (!material) return;
    projectApi.updateMaterial(reqId, { ...material, [field]: value })
      .then(updated => setMaterials(prev => prev.map(m => m.id === reqId ? updated : m)))
      .catch(() => alert("Failed to update material"));
  };

  const refreshMaterialData = () => {
    projectApi.getMaterials(projectId).then(setMaterials).catch(() => {});
    projectApi.getMaterialTransactions(projectId).then(setMaterialTransactions).catch(() => {});
    projectApi.getMaterialPurchaseSummary(projectId).then(setPurchaseSummary).catch(() => {});
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
    if (!stockMove.productId) { alert("Select a material"); return; }
    if (!stockMove.warehouseId) { alert("Select a warehouse"); return; }
    if (!stockMove.quantity || stockMove.quantity <= 0) { alert("Quantity must be greater than zero"); return; }
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
      .catch((err) => alert(err?.response?.data?.message || "Failed to record stock movement"));
  };

  const handleCreateProduct = () => {
    if (!newProduct.name.trim()) { alert("Product name is required"); return; }
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
        alert(`Product "${p.name}" created (${p.materialCode || 'new'}).`);
      })
      .catch((err) => alert(err?.response?.data?.message || "Failed to create product"));
  };

  const handleRequestMaterial = (m: ProjectMaterialRequirement) => {
    if (!m.product?.id) return;
    inventoryApi.createMaterialRequest({
      projectId,
      items: [{ productId: m.product.id, quantity: Number(m.remainingQty) || 1 }],
      remarks: `Project material requirement #${m.id}`,
    })
      .then(() => alert("Material request raised — visible under Inventory > Material Requests."))
      .catch((err) => alert(err?.response?.data?.message || "Failed to raise material request"));
  };

  const handleRequestPurchase = (reqId: number) => {
    projectApi.requestPurchase(reqId)
      .then(() => {
        alert("Purchase order created.");
        projectApi.getMaterials(projectId).then(setMaterials);
      })
      .catch((err) => alert(err?.response?.data?.message || err?.message || "Failed to request purchase"));
  };

  const handleDecideApproval = (approvalId: number, approve: boolean) => {
    const action = approve ? projectApi.approveApproval(approvalId) : projectApi.rejectApproval(approvalId);
    action.then(() => fetchProjectData()).catch(() => alert("Failed to update approval"));
  };

  const handleAddStage = () => {
    api.post(`/projects/${id}/stages`, newStage)
      .then(() => {
        fetchProjectData();
        setNewStage({ name: '', dueDate: '' });
      })
      .catch(_err => alert("Failed to add stage"));
  };

  const handleAddDailyLog = () => {
    api.post(`/projects/${id}/daily-logs`, newDailyLog)
      .then(() => {
        fetchProjectData();
        setNewDailyLog({ logDate: format(new Date(), 'yyyy-MM-dd'), percentageCompleted: 0, workCompleted: '', workPending: '', issues: '', weather: '', manpower: 0 });
      })
      .catch(_err => alert("Failed to add log"));
  };

  const handleAddIssue = () => {
    api.post(`/projects/${id}/issues`, newIssue)
      .then(() => {
        fetchProjectData();
        setNewIssue({ title: '', description: '', priority: 'MEDIUM' });
      })
      .catch(_err => alert("Failed to add issue"));
  };

  const handleAddQualityCheck = () => {
    api.post(`/projects/${id}/quality-checks`, newQualityCheck)
      .then(() => {
        fetchProjectData();
        setNewQualityCheck({ checklistCategory: '', itemChecked: '', status: 'APPROVED', remarks: '', inspectionDate: format(new Date(), 'yyyy-MM-dd') });
      })
      .catch(_err => alert("Failed to add check"));
  };
  
  const handleCompleteProject = () => {
    if (confirm("Mark this project as COMPLETED?")) {
      api.post(`/projects/${id}/complete`, { certificate: "placeholder-cert-data" })
        .then(() => fetchProjectData())
        .catch(_err => alert("Failed to complete project"));
    }
  };

  const handleStartExecution = () => {
    api.post(`/projects/${id}/start-execution`)
      .then(() => fetchProjectData())
      .catch((err: any) => alert(err?.response?.data?.message || "Failed to start execution"));
  };

  if (loading) return <div className="p-8 text-slate-500">Loading Command Center...</div>;
  if (!data || !data.project) return <div className="p-8 text-red-500">Project not found</div>;

  const { project, stages, dailyLogs, qualityChecks, issues, risks, documents } = data;
  const profitOrLoss = (project.budget || 0) - (project.spentAmount || 0);

  // Gantt Chart Logic
  const getGanttTimeline = () => {
    if (!project.startDate || !project.endDate || !stages.length) return null;
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    const totalDays = differenceInDays(projectEnd, projectStart) || 1;

    return (
      <div className="mt-8 space-y-4">
        <div className="flex text-xs font-semibold text-slate-400 mb-2 border-b pb-2">
          <div className="w-48 shrink-0">Stage</div>
          <div className="flex-1 flex justify-between relative">
            <span>{format(projectStart, 'MMM d')}</span>
            <span>{format(projectEnd, 'MMM d')}</span>
          </div>
        </div>
        
        {stages.map((stage: any) => {
          if (!stage.dueDate) return null;
          // For visualization, assume stage takes some time leading up to due date
          const mEnd = new Date(stage.dueDate);
          const mStart = new Date(mEnd);
          mStart.setDate(mStart.getDate() - 7); // placeholder 1 week duration for visual
          
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
                    ${stage.status === 'COMPLETED' ? 'bg-green-500' : stage.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-slate-400'}`}
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
    <div className="flex flex-col h-full bg-slate-50/50 relative">

      {/* Enhanced Top Header */}
      <div className="bg-white border-b border-slate-100 px-8 py-6 flex flex-col md:flex-row items-start justify-between shrink-0 z-10 gap-4">
        <div className="flex items-start gap-4">
          <Link to="/projects">
            <Button variant="ghost" size="icon" className="mt-1 text-slate-400 hover:text-slate-600"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-800">{project.projectCode} - {project.projectName}</h1>
              <span className={`px-2.5 py-1 text-[11px] rounded-full font-medium ${
                project.status === 'RUNNING' ? 'bg-sky-50 text-sky-600' :
                project.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                'bg-slate-100 text-slate-500'
              }`}>
                {project.status.replace('_', ' ')}
              </span>
              {stats?.health && (
                <span className={`px-2.5 py-1 text-[11px] rounded-full font-medium ${
                  stats.health === 'EXCELLENT' ? 'bg-emerald-50 text-emerald-600' :
                  stats.health === 'GOOD' ? 'bg-sky-50 text-sky-600' :
                  stats.health === 'WARNING' ? 'bg-amber-50 text-amber-600' :
                  'bg-rose-50 text-rose-600'
                }`}>
                  Health: {stats.health}
                </span>
              )}
            </div>
            <div className="text-slate-400 flex items-center gap-4 text-sm mt-2">
              <span className="flex items-center gap-1"><User className="w-4 h-4"/> {project.customer?.name}</span>
              <span className="flex items-center gap-1"><Phone className="w-4 h-4 text-sky-400 cursor-pointer"/> {project.customer?.phone || 'N/A'}</span>
              <span className="flex items-center gap-1"><Mail className="w-4 h-4 text-sky-400 cursor-pointer"/> {project.customer?.email || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {['PLANNING', 'PENDING', 'APPROVED'].includes(project.status) && (
            <Button onClick={handleStartExecution} className="bg-sky-500 hover:bg-sky-600 rounded-xl">
              <Play className="w-4 h-4 mr-2"/> Start Execution
            </Button>
          )}
          {project.status !== 'COMPLETED' && (
            <Button onClick={handleCompleteProject} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4 mr-2"/> Mark Completed
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats (below header) */}
      {stats && (
        <div className="bg-white border-b border-slate-100 px-8 py-3 flex gap-3 overflow-x-auto whitespace-nowrap hide-scrollbar shrink-0 z-10">
          <div className="px-4 py-2 bg-sky-50 text-sky-600 rounded-xl flex flex-col min-w-[120px]"><span className="text-[11px] text-sky-400 mb-0.5">Today's Tasks</span><span className="text-lg font-semibold">{stats.tasks?.inProgress || 0}</span></div>
          <div className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl flex flex-col min-w-[120px]"><span className="text-[11px] text-rose-400 mb-0.5">Delayed Tasks</span><span className="text-lg font-semibold">{stats.tasks?.delayed || 0}</span></div>
          <div className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl flex flex-col min-w-[120px]"><span className="text-[11px] text-orange-400 mb-0.5">Open Issues</span><span className="text-lg font-semibold">{stats.issues?.open || 0}</span></div>
          <div className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl flex flex-col min-w-[120px]"><span className="text-[11px] text-amber-400 mb-0.5">Pending Approvals</span><span className="text-lg font-semibold">{stats.approvals?.pending || 0}</span></div>
          <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl flex flex-col min-w-[120px]"><span className="text-[11px] text-emerald-400 mb-0.5">Employees Working</span><span className="text-lg font-semibold">{(stats.liveEmployees || []).length}</span></div>
          <div className="px-4 py-2 bg-violet-50 text-violet-600 rounded-xl flex flex-col min-w-[120px]"><span className="text-[11px] text-violet-400 mb-0.5">Active Site Visits</span><span className="text-lg font-semibold">{(stats.visitsToday || []).length}</span></div>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        <div className="flex-1 overflow-hidden flex flex-col p-8">
        <Tabs defaultValue="overview" className="w-full flex flex-col h-full">
          
          <TabsList className="bg-white p-1 border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] rounded-2xl inline-flex w-fit mb-6 flex-wrap h-auto">
            <TabsTrigger value="overview" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Overview & Gantt</TabsTrigger>
            <TabsTrigger value="phases" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Phases & Rooms</TabsTrigger>
            <TabsTrigger value="materials" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Materials</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Payments & Invoices</TabsTrigger>
            <TabsTrigger value="execution" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Daily Logs</TabsTrigger>
            <TabsTrigger value="fieldProgress" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Field Progress</TabsTrigger>
            <TabsTrigger value="contractors" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Contractors</TabsTrigger>
            <TabsTrigger value="quality" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Quality Control</TabsTrigger>
            <TabsTrigger value="approvals" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Approvals</TabsTrigger>
            <TabsTrigger value="changeRequests" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Change Requests</TabsTrigger>
            <TabsTrigger value="issues" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800 flex items-center gap-2">
              Issues & Risks
              {(issues.length > 0 || risks.length > 0) && (
                <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-[10px] font-bold">{issues.length + risks.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="media" className="rounded-xl text-slate-500 data-[state=active]:shadow-sm data-[state=active]:text-slate-800">Documents</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pb-20">
            
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6 mt-0 h-full outline-none">
              <div className="grid grid-cols-4 gap-6">
                
                {/* Financial KPI */}
                <div className="col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <h3 className="text-xs font-semibold text-slate-400 mb-4 flex items-center"><DollarSign className="w-4 h-4 mr-2"/> Financial Health</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-3xl font-bold text-slate-800">${project.budget?.toLocaleString() || 0}</div>
                      <div className="text-sm font-medium text-slate-500">Allocated Budget</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-slate-800">${project.spentAmount?.toLocaleString() || 0}</div>
                      <div className="text-sm font-medium text-slate-500">Spent Amount</div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="flex justify-between text-xs font-semibold mb-2">
                      <span className="text-slate-500">Budget Utilization</span>
                      <span className={profitOrLoss < 0 ? 'text-red-500' : 'text-slate-700'}>
                        {project.budget ? Math.round(((project.spentAmount || 0) / project.budget) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all ${profitOrLoss < 0 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, project.budget ? ((project.spentAmount || 0) / project.budget) * 100 : 0)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Progress KPI */}
                <div className="col-span-1 bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col items-center justify-center relative">
                   <Activity className="absolute top-6 left-6 text-slate-300 w-6 h-6" />
                   <div className="text-5xl font-black text-blue-600 mb-2">{project.progress}%</div>
                   <div className="text-xs font-semibold text-slate-400">Overall Progress</div>
                </div>

                {/* Timeline KPI */}
                <div className="col-span-1 bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-center">
                   <h3 className="text-xs font-semibold text-slate-400 mb-4 flex items-center"><Calendar className="w-4 h-4 mr-2"/> Timeline</h3>
                   <div className="space-y-4">
                     <div>
                       <div className="text-xs font-semibold text-slate-400 mb-1">START DATE</div>
                       <div className="font-bold text-slate-700">{project.startDate ? format(new Date(project.startDate), 'MMMM d, yyyy') : 'Not set'}</div>
                     </div>
                     <div>
                       <div className="text-xs font-semibold text-slate-400 mb-1">TARGET COMPLETION</div>
                       <div className="font-bold text-slate-700">{project.endDate ? format(new Date(project.endDate), 'MMMM d, yyyy') : 'Not set'}</div>
                     </div>
                   </div>
                </div>

              </div>

              {/* Project details carried over from the lead at conversion */}
              {(project.propertyAddress || project.projectType || project.projectCategory ||
                project.projectDescription || project.customerNotes || project.estimatedCost ||
                project.projectManager || project.salesExecutive || project.designer || project.siteEngineer) && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><ClipboardCheck className="w-5 h-5 mr-2 text-blue-600"/> Project Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    {project.propertyAddress && (
                      <div className="md:col-span-2">
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Property Address</div>
                        <div className="text-sm font-medium text-slate-700 whitespace-pre-line">{project.propertyAddress}</div>
                      </div>
                    )}
                    {(project.projectType || project.projectCategory) && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Property Type</div>
                        <div className="text-sm font-medium text-slate-700">{[project.projectType, project.projectCategory].filter(Boolean).join(' · ')}</div>
                      </div>
                    )}
                    {project.estimatedCost && (
                      <div>
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Estimated Value</div>
                        <div className="text-sm font-medium text-slate-700">₹{Number(project.estimatedCost).toLocaleString('en-IN')}</div>
                      </div>
                    )}
                    {project.projectDescription && (
                      <div className="md:col-span-2">
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Description</div>
                        <div className="text-sm font-medium text-slate-700 whitespace-pre-line">{project.projectDescription}</div>
                      </div>
                    )}
                    {project.customerNotes && (
                      <div className="md:col-span-2">
                        <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Customer Requirements</div>
                        <div className="text-sm font-medium text-slate-700 whitespace-pre-line">{project.customerNotes}</div>
                      </div>
                    )}
                    {(project.projectManager || project.salesExecutive || project.designer || project.siteEngineer) && (
                      <div className="md:col-span-2">
                        <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Team</div>
                        <div className="flex flex-wrap gap-2">
                          {([['Project Manager', project.projectManager], ['Sales', project.salesExecutive], ['Designer', project.designer], ['Site Engineer', project.siteEngineer]] as [string, any][])
                            .filter(([, u]) => u)
                            .map(([role, u]) => (
                              <span key={role} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                <User className="w-3 h-3"/> {role}: {u.name}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Progress rollup */}
              {progress && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center mb-4"><Activity className="w-5 h-5 mr-2 text-blue-600"/> Progress Rollup</h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                    {[
                      { label: 'Overall', value: progress.overallPercent },
                      { label: 'Phase', value: progress.phasePercent },
                      { label: 'Room', value: progress.roomPercent },
                      { label: 'Task', value: progress.taskPercent },
                      { label: 'Material', value: progress.materialPercent },
                      { label: 'Financial', value: progress.financialPercent },
                    ].map(p => (
                      <div key={p.label}>
                        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                          <span>{p.label}</span><span>{p.value}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="h-2.5 rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, p.value)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gantt / Stages */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-blue-600"/> Project Stages & Gantt</h3>
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
                  <div className="py-12 text-center text-slate-500">
                    No stages added yet. Add stages to generate the Gantt chart.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* PHASES & ROOMS TAB */}
            <TabsContent value="phases" className="space-y-6 mt-0 h-full outline-none">
              {progressDashboard && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-600 flex items-center"><TrendingUp className="w-4 h-4 mr-2 text-blue-600"/> Overall Project Progress</span>
                      <span className="text-2xl font-bold text-slate-800">{progressDashboard.overallProgress}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${progressBarColor(progressDashboard.overallProgress)} rounded-full transition-all`} style={{ width: `${progressDashboard.overallProgress}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {([
                      ['Completed Tasks', progressDashboard.completedTasks, 'text-emerald-600'],
                      ['In Progress', progressDashboard.inProgressTasks, 'text-blue-600'],
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
                      <Link to={`/boq/${masterBoq.id}`} className="font-semibold text-blue-600 hover:underline">{masterBoq.boqNumber}</Link>
                    ) : <span className="text-slate-400">—</span>}
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Current BOQ Revision</div>
                    <Link to={`/boq/${data.boq.id}`} className="font-semibold text-blue-600 hover:underline">
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
                <h2 className="text-2xl font-bold text-slate-800 flex items-center"><Layers className="w-5 h-5 mr-2 text-blue-600"/> Phases & Rooms</h2>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleGenerateFromBoq} disabled={generatingFromBoq}>
                    <Sparkles className="w-4 h-4 mr-2"/> {generatingFromBoq ? 'Generating...' : 'Generate from BOQ'}
                  </Button>
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
                        <span>Budget: ${(phase.budget || 0).toLocaleString()}</span>
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
                <h2 className="text-2xl font-bold text-slate-800 flex items-center"><Package className="w-5 h-5 mr-2 text-blue-600"/> Materials & Stock</h2>
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
                          <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={newMaterial.productId} onChange={e => setNewMaterial({ ...newMaterial, productId: e.target.value })}>
                            <option value="">Select product...</option>
                            {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
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
                <table className="w-full text-sm">
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
                        <td className="p-3 text-right">
                          <input type="number" className="w-20 text-right border rounded px-1" defaultValue={m.reservedQty}
                            onBlur={e => handleUpdateMaterialQty(m.id!, 'reservedQty', Number(e.target.value))} />
                        </td>
                        <td className="p-3 text-right">
                          <input type="number" className="w-20 text-right border rounded px-1" defaultValue={m.issuedQty}
                            onBlur={e => handleUpdateMaterialQty(m.id!, 'issuedQty', Number(e.target.value))} />
                        </td>
                        <td className="p-3 text-right">
                          <input type="number" className="w-20 text-right border rounded px-1" defaultValue={m.returnedQty}
                            onBlur={e => handleUpdateMaterialQty(m.id!, 'returnedQty', Number(e.target.value))} />
                        </td>
                        <td className="p-3 text-right">
                          <input type="number" className="w-20 text-right border rounded px-1" defaultValue={m.consumedQty}
                            onBlur={e => handleUpdateMaterialQty(m.id!, 'consumedQty', Number(e.target.value))} />
                        </td>
                        <td className={`p-3 text-right font-bold ${(m.remainingQty || 0) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{m.remainingQty}</td>
                        <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
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

              {/* PURCHASE SUMMARY + MOVEMENT HISTORY */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center"><ShoppingCart className="w-4 h-4 mr-2 text-blue-600"/> Purchase Summary</h3>
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
                    <h3 className="font-bold text-slate-800 flex items-center"><History className="w-4 h-4 mr-2 text-blue-600"/> Stock Movement</h3>
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

              {/* STOCK MOVEMENT DIALOG */}
              <Dialog open={stockMove.open} onOpenChange={(o) => setStockMove(s => ({ ...s, open: o }))}>
                <DialogContent>
                  <DialogHeader><DialogTitle>{stockMove.direction === 'IN' ? 'Stock In — Record Received Material' : 'Stock Out — Issue / Consume Material'}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={stockMove.productId} onChange={e => setStockMove(s => ({ ...s, productId: e.target.value }))}>
                        <option value="">Select product...</option>
                        {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
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
            </TabsContent>

            {/* APPROVALS TAB */}
            <TabsContent value="approvals" className="space-y-4 mt-0 h-full outline-none">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center"><ClipboardCheck className="w-5 h-5 mr-2 text-blue-600"/> Customer Approvals</h2>
              <div className="grid grid-cols-2 gap-4">
                {(data.approvals || []).map((a: any) => (
                  <div key={a.id} className={`bg-white p-5 rounded-2xl border border-slate-100 border-l-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${a.status === 'APPROVED' ? 'border-l-green-500' : a.status === 'REJECTED' ? 'border-l-red-500' : 'border-l-orange-500'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-800">{a.approvalType}</h4>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${a.status === 'APPROVED' ? 'bg-green-100 text-green-700' : a.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{a.remarks || '-'}</p>
                    {a.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDecideApproval(a.id, true)}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDecideApproval(a.id, false)}>Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
                {(!data.approvals || data.approvals.length === 0) && <div className="col-span-2 text-slate-500 text-center py-12">No customer approvals recorded yet.</div>}
              </div>
            </TabsContent>

            {/* CHANGE REQUESTS TAB */}
            <TabsContent value="changeRequests" className="space-y-6 mt-0 h-full outline-none">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center"><FileEdit className="w-5 h-5 mr-2 text-blue-600"/> Project Change Requests</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button><Plus className="w-4 h-4 mr-2"/> New Change Request</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Change Request</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
                      <div className="space-y-2">
                        <Label>Change Type</Label>
                        <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={newChangeRequest.changeType}
                          onChange={e => setNewChangeRequest({ ...newChangeRequest, changeType: e.target.value as ChangeRequestType })}>
                          {Object.entries(CHANGE_REQUEST_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Input value={newChangeRequest.reason} onChange={e => setNewChangeRequest({ ...newChangeRequest, reason: e.target.value })} placeholder="e.g. Customer wants to reduce scope to Ground Floor only" />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <textarea className="w-full min-h-[80px] p-2 rounded-md border text-sm" value={newChangeRequest.description}
                          onChange={e => setNewChangeRequest({ ...newChangeRequest, description: e.target.value })} />
                      </div>
                      {phases.length > 0 && (
                        <div className="space-y-2">
                          <Label>Phase Actions (activate/deactivate on approval)</Label>
                          <div className="space-y-1.5 border rounded-md p-2">
                            {phases.map(phase => (
                              <div key={phase.id} className="flex items-center justify-between text-sm">
                                <span>{phase.name}</span>
                                <select className="border rounded px-2 py-1 text-xs"
                                  value={changeRequestPhaseActions[phase.id!] || ''}
                                  onChange={e => setChangeRequestPhaseActions({ ...changeRequestPhaseActions, [phase.id!]: e.target.value as 'ACTIVATE' | 'DEACTIVATE' })}>
                                  <option value="">No change</option>
                                  <option value="ACTIVATE">Activate</option>
                                  <option value="DEACTIVATE">Deactivate</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button className="w-full" onClick={handleCreateChangeRequest}>Submit Change Request</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-3">
                {changeRequests.map(cr => (
                  <div key={cr.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800">{cr.requestNumber}</h4>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${CHANGE_REQUEST_STATUS_STYLES[cr.status || 'PENDING']}`}>{cr.status}</span>
                        </div>
                        <div className="text-sm text-slate-500">{CHANGE_REQUEST_TYPE_LABELS[cr.changeType]} · requested by {cr.requestedBy?.name || '—'}</div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 mb-1">{cr.reason}</p>
                    {cr.description && <p className="text-sm text-slate-500 mb-3">{cr.description}</p>}
                    <div className="flex gap-2">
                      {cr.status === 'PENDING' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveChangeRequest(cr.id!)}>Approve & Apply</Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectChangeRequest(cr.id!)}>Reject</Button>
                        </>
                      )}
                      {cr.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" onClick={() => handleCompleteChangeRequest(cr.id!)}>Mark Completed</Button>
                      )}
                    </div>
                  </div>
                ))}
                {changeRequests.length === 0 && (
                  <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
                    <FileEdit className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No change requests yet.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* EXECUTION LOGS TAB */}
            <TabsContent value="execution" className="space-y-6 mt-0 h-full outline-none">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Daily Execution Logs</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button><PenTool className="w-4 h-4 mr-2"/> New Daily Log</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Daily Log</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
                      <div className="space-y-2"><Label>Date</Label><Input type="date" value={newDailyLog.logDate} onChange={e => setNewDailyLog({...newDailyLog, logDate: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Work Completed</Label><textarea className="w-full min-h-[80px] p-2 rounded-md border text-sm" value={newDailyLog.workCompleted} onChange={e => setNewDailyLog({...newDailyLog, workCompleted: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Work Pending</Label><textarea className="w-full min-h-[80px] p-2 rounded-md border text-sm" value={newDailyLog.workPending} onChange={e => setNewDailyLog({...newDailyLog, workPending: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Issues / Blockers</Label><textarea className="w-full min-h-[60px] p-2 rounded-md border text-sm" value={newDailyLog.issues} onChange={e => setNewDailyLog({...newDailyLog, issues: e.target.value})} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Manpower</Label><Input type="number" value={newDailyLog.manpower} onChange={e => setNewDailyLog({...newDailyLog, manpower: Number(e.target.value)})} /></div>
                        <div className="space-y-2"><Label>Weather</Label><Input value={newDailyLog.weather} onChange={e => setNewDailyLog({...newDailyLog, weather: e.target.value})} /></div>
                      </div>
                      <Button className="w-full" onClick={handleAddDailyLog}>Submit Log</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {dailyLogs.map((log: any) => (
                  <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2 font-semibold text-slate-700">
                        <User className="w-4 h-4 text-slate-400" /> {log.reportedBy?.username || 'User'}
                      </div>
                      <div className="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-700">
                        {format(new Date(log.logDate), 'MMMM d, yyyy')}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Work Completed</span>
                        <p className="text-sm text-slate-700">{log.workCompleted || '-'}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Work Pending</span>
                        <p className="text-sm text-slate-700">{log.workPending || '-'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-50 mt-2">
                       <div><span className="text-xs font-bold text-slate-400 uppercase">Manpower:</span> <span className="text-sm font-semibold ml-2">{log.manpower}</span></div>
                       <div><span className="text-xs font-bold text-slate-400 uppercase">Weather:</span> <span className="text-sm font-semibold ml-2">{log.weather || '-'}</span></div>
                       <div><span className="text-xs font-bold text-slate-400 uppercase">Issues:</span> <span className="text-sm font-semibold ml-2 text-red-500">{log.issues || 'None'}</span></div>
                    </div>
                  </div>
                ))}
                {dailyLogs.length === 0 && <div className="text-slate-500 text-center py-12">No daily logs recorded yet.</div>}
              </div>
            </TabsContent>

            {/* FIELD PROGRESS TAB — read-only view into the mobile Employee Task module (manager: live progress + employee timeline) */}
            <TabsContent value="fieldProgress" className="space-y-6 mt-0 h-full outline-none">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Field Task Execution</h3>
                  <span className="text-xs text-slate-500">
                    {fieldTasks.filter((t: any) => t.status === 'COMPLETED').length} / {fieldTasks.length} completed
                  </span>
                </div>
                <div className="divide-y">
                  {fieldTasks.map((task: any) => (
                    <div key={task.id}>
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                        onClick={() => toggleExpandFieldTask(task.id)}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{task.taskName}</p>
                          <p className="text-xs text-slate-500">{task.room?.roomName || task.phase?.name || 'Unassigned location'}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-bold shrink-0 ml-3">
                          {task.status?.replace('_', ' ')}
                        </span>
                      </div>
                      {expandedFieldTask === task.id && (
                        <div className="px-4 pb-4 bg-slate-50/50">
                          {(fieldTaskAssignments[task.id] || []).length === 0 ? (
                            <p className="text-xs text-slate-500 py-2">No employees assigned yet.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-500 text-left">
                                  <th className="py-1 font-medium">Employee</th>
                                  <th className="py-1 font-medium">Role</th>
                                  <th className="py-1 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fieldTaskAssignments[task.id].map((a: any) => (
                                  <tr key={a.employeeId} className="border-t border-slate-200">
                                    <td className="py-1.5">{a.employeeName}</td>
                                    <td className="py-1.5">{a.role || '-'}</td>
                                    <td className="py-1.5">{a.status?.replace('_', ' ')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {fieldTasks.length === 0 && <div className="text-slate-500 text-center py-12">No field tasks generated for this project yet.</div>}
                </div>
              </div>
            </TabsContent>

            {/* CONTRACTORS TAB — subcontracted scope on this project, as work packages */}
            <TabsContent value="contractors" className="space-y-6 mt-0 h-full outline-none">
              <ProjectContractorsTab projectId={projectId} />
            </TabsContent>

            {/* QUALITY CONTROL TAB */}
            <TabsContent value="quality" className="space-y-6 mt-0 h-full outline-none">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Quality Inspections</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button><CheckSquare className="w-4 h-4 mr-2"/> New Inspection</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Quality Check</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2"><Label>Category</Label><Input value={newQualityCheck.checklistCategory} onChange={e => setNewQualityCheck({...newQualityCheck, checklistCategory: e.target.value})} placeholder="e.g. Electrical, Plumbing" /></div>
                      <div className="space-y-2"><Label>Item Checked</Label><Input value={newQualityCheck.itemChecked} onChange={e => setNewQualityCheck({...newQualityCheck, itemChecked: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Status</Label>
                        <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={newQualityCheck.status} onChange={e => setNewQualityCheck({...newQualityCheck, status: e.target.value})}>
                          <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="REWORK_REQUIRED">Rework Required</option>
                        </select>
                      </div>
                      <div className="space-y-2"><Label>Remarks</Label><textarea className="w-full min-h-[80px] p-2 rounded-md border text-sm" value={newQualityCheck.remarks} onChange={e => setNewQualityCheck({...newQualityCheck, remarks: e.target.value})} /></div>
                      <Button className="w-full" onClick={handleAddQualityCheck}>Submit Inspection</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {qualityChecks.map((qc: any) => (
                  <div key={qc.id} className={`bg-white p-5 rounded-2xl border border-slate-100 border-l-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${qc.status === 'APPROVED' ? 'border-l-green-500' : qc.status === 'REJECTED' ? 'border-l-red-500' : 'border-l-orange-500'}`}>
                    <div className="flex justify-between items-start mb-2">
                       <h4 className="font-bold text-slate-800">{qc.itemChecked}</h4>
                       <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${qc.status === 'APPROVED' ? 'bg-green-100 text-green-700' : qc.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                         {qc.status.replace('_', ' ')}
                       </span>
                    </div>
                    <div className="text-sm font-medium text-slate-500 mb-2">{qc.checklistCategory}</div>
                    <p className="text-sm text-slate-700">{qc.remarks || '-'}</p>
                    <div className="mt-4 pt-3 border-t text-xs font-medium text-slate-400 flex justify-between">
                       <span>Inspector: {qc.inspector?.username || 'Unknown'}</span>
                       <span>{qc.inspectionDate ? format(new Date(qc.inspectionDate), 'MMM d, yyyy') : ''}</span>
                    </div>
                  </div>
                ))}
                {qualityChecks.length === 0 && <div className="col-span-2 text-slate-500 text-center py-12">No quality checks recorded yet.</div>}
              </div>
            </TabsContent>

            {/* ISSUES & RISKS TAB */}
            <TabsContent value="issues" className="space-y-8 mt-0 h-full outline-none">
              <div className="grid grid-cols-2 gap-8">
                
                {/* ISSUES */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center"><AlertTriangle className="w-5 h-5 mr-2 text-red-500"/> Active Issues</h2>
                    <Dialog>
                      <DialogTrigger asChild><Button size="sm" variant="outline">Report Issue</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Report Issue</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-2"><Label>Title</Label><Input value={newIssue.title} onChange={e => setNewIssue({...newIssue, title: e.target.value})} /></div>
                          <div className="space-y-2"><Label>Priority</Label>
                            <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={newIssue.priority} onChange={e => setNewIssue({...newIssue, priority: e.target.value})}>
                              <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                            </select>
                          </div>
                          <div className="space-y-2"><Label>Description</Label>
                            <textarea className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm" value={newIssue.description} onChange={e => setNewIssue({...newIssue, description: e.target.value})} />
                          </div>
                          <Button className="w-full" onClick={handleAddIssue}>Submit Issue</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-3">
                    {issues.map((issue: any) => (
                      <div key={issue.id} className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-red-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-800">{issue.title}</h4>
                          <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded uppercase">{issue.priority}</span>
                        </div>
                        <p className="text-sm text-slate-600">{issue.description}</p>
                      </div>
                    ))}
                    {issues.length === 0 && <div className="text-slate-500 py-4">No active issues.</div>}
                  </div>
                </div>

                {/* RISKS */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center"><ShieldAlert className="w-5 h-5 mr-2 text-orange-500"/> Risk Matrix</h2>
                    <Button size="sm" variant="outline" disabled>Add Risk</Button>
                  </div>
                  <div className="space-y-3">
                    {risks.map((risk: any) => (
                       <div key={risk.id} className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-orange-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                         <div className="flex justify-between items-start mb-2">
                           <h4 className="font-bold text-slate-800">{risk.title}</h4>
                           <span className="text-xs font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded uppercase">{risk.riskLevel}</span>
                         </div>
                         <p className="text-sm text-slate-600 mt-1">{risk.mitigationPlan}</p>
                       </div>
                    ))}
                    {risks.length === 0 && <div className="text-slate-500 py-4">No logged risks.</div>}
                  </div>
                </div>

              </div>
            </TabsContent>

            {/* MEDIA TAB */}
            <TabsContent value="media" className="mt-0 h-full outline-none">
              <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                 <div className="text-center max-w-md mx-auto mb-6">
                   <FileImage className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                   <h3 className="text-lg font-bold text-slate-800 mb-2">Document Storage</h3>
                   <p className="text-slate-500 mb-6">
                     Upload architectural plans, site photos, approvals, and contracts straight from your device.
                   </p>
                   <div className="flex items-center justify-center gap-2">
                     <select
                       className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                       value={docType}
                       onChange={(e) => setDocType(e.target.value)}
                     >
                       {["Photos", "Videos", "Floor Plan", "CAD", "Agreement", "Invoice", "PO", "BOQ", "Approval"].map((t) => (
                         <option key={t} value={t}>{t}</option>
                       ))}
                     </select>
                     <Button asChild disabled={docUploading}>
                       <label className="cursor-pointer">
                         {docUploading ? "Uploading…" : "Upload File"}
                         <input
                           type="file"
                           className="hidden"
                           accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf"
                           onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProjectDocument(f); e.target.value = ''; }}
                         />
                       </label>
                     </Button>
                     <CameraCaptureButton onCapture={uploadProjectDocument} disabled={docUploading} label="Camera"
                       className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-60" />
                   </div>
                 </div>

                 {documents.length > 0 && (
                   <div className="mt-4 text-left grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     {documents.map((doc: any) => (
                       <a key={doc.id} href={resolveFileUrl(doc.fileUrl)} target="_blank" rel="noreferrer"
                          className="p-4 border rounded-xl flex items-center gap-3 hover:border-blue-400 hover:bg-slate-50 transition-colors">
                         <FileText className="w-8 h-8 text-blue-500 shrink-0" />
                         <div className="min-w-0">
                           <div className="font-semibold text-sm truncate">{doc.fileName}</div>
                           <div className="text-xs text-slate-500 uppercase">{doc.documentType}</div>
                         </div>
                       </a>
                     ))}
                   </div>
                 )}
              </div>
            </TabsContent>


          </div>
        </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="w-full md:w-80 bg-white border-l border-slate-100 overflow-y-auto hidden md:block shrink-0">
           <div className="p-6 space-y-8">
              <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center"><User className="w-4 h-4 mr-2 text-slate-400"/> Customer Snapshot</h3>
                <div className="bg-slate-50 border rounded-xl p-4">
                  <div className="font-bold text-slate-700 text-sm mb-1">{project.customer?.name}</div>
                  <div className="text-xs text-slate-500 mb-3">{project.customer?.address || 'No address on file'}</div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="flex-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"><Phone className="w-3.5 h-3.5 mr-1"/> Call</Button>
                    <Button size="sm" variant="outline" className="flex-1 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800">WhatsApp</Button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Clock className="w-4 h-4 mr-2 text-slate-400"/> Upcoming Deadlines</h3>
                <div className="space-y-3">
                  {(stats?.tasks?.delayed > 0) && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                      <div className="text-xs font-bold text-red-600 uppercase mb-1">Overdue Tasks</div>
                      <div className="text-sm font-medium text-red-800">{stats.tasks.delayed} tasks require immediate attention</div>
                    </div>
                  )}
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Target Completion</div>
                    <div className="text-sm font-medium text-slate-800">{project.endDate ? format(new Date(project.endDate), 'MMM d, yyyy') : 'Not set'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Sun className="w-4 h-4 mr-2 text-slate-400"/> Site Weather</h3>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-blue-900">72°F / 22°C</div>
                    <div className="text-xs text-blue-700">Clear Skies</div>
                  </div>
                  <Sun className="w-8 h-8 text-yellow-500" />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center"><File className="w-4 h-4 mr-2 text-slate-400"/> Recent Documents</h3>
                <div className="space-y-2">
                  {(data?.documents || []).slice(0, 3).map((doc: any) => (
                     <a key={doc.id} href={resolveFileUrl(doc.fileUrl)} target="_blank" rel="noreferrer" className="flex items-center p-2 rounded hover:bg-slate-50 text-sm">
                       <FileText className="w-4 h-4 mr-2 text-blue-500" />
                       <span className="truncate text-slate-700 font-medium">{doc.documentName}</span>
                     </a>
                  ))}
                  {(!data?.documents || data.documents.length === 0) && <div className="text-xs text-slate-500 italic">No documents uploaded.</div>}
                </div>
              </div>
           </div>
        </div>
      </div>
      
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 md:right-[340px] z-50">
         <Dialog open={quickActionOpen} onOpenChange={(open) => {
             setQuickActionOpen(open);
             if (!open) setTimeout(() => setQuickActionView('menu'), 200);
          }}>
            <DialogTrigger asChild>
               <Button className="rounded-full w-14 h-14 shadow-lg bg-blue-600 hover:bg-blue-700 border-4 border-white"><Plus className="w-6 h-6 text-white"/></Button>
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
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2" onClick={() => setQuickActionView('create_task')}><CheckSquare className="w-5 h-5 text-blue-500"/> Create Task</Button>
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
                     <select className="w-full p-2 border rounded-md text-sm" value={newAssignState.taskId} onChange={e => setNewAssignState({...newAssignState, taskId: e.target.value})}>
                       <option value="">-- Choose a task --</option>
                       {fieldTasks.map(t => <option key={t.id} value={t.id}>{t.taskName}</option>)}
                     </select>
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
                  className="w-full accent-blue-600 disabled:opacity-50" />
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
                      <label className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 text-slate-400" title="Choose from device">
                        <FileImage className="w-5 h-5" />
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleItemPhotoUpload(f); e.target.value = ''; }} />
                      </label>
                      <CameraCaptureButton onCapture={handleItemPhotoUpload} label=""
                        className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center hover:border-blue-400 text-slate-400" />
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
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
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

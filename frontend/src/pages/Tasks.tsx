import { useState, useEffect } from "react";
import api from "@/lib/api";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, isSameMonth, isSameDay } from "date-fns";
import { Search, Plus, Calendar as CalendarIcon, KanbanSquare, List as ListIcon, Clock, Users } from "lucide-react";
import { workforceApi } from "@/api/workforceApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { WorkforceDashboard } from "@/types/workforce";
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_STYLES } from "@/types/workforce";
import ResourceSelect, { ResourceSelection } from "@/components/workforce/ResourceSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// New Employee Task module (see pages/employeeTasks/) writes richer statuses than this Kanban's
// original 3 columns supported. Bucket them so mobile-originated statuses still show up here
// instead of silently vanishing — desktop layout/columns are unchanged, only the grouping predicate is.
const STATUS_BUCKET: Record<string, string> = {
  PENDING: 'PENDING', ACCEPTED: 'PENDING', REJECTED: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS', PAUSED: 'IN_PROGRESS', WAITING_MATERIAL: 'IN_PROGRESS',
  WAITING_APPROVAL: 'IN_PROGRESS', REWORK: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED', CANCELLED: 'COMPLETED',
};
const statusBucket = (status: string) => STATUS_BUCKET[status] ?? 'PENDING';

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("kanban"); // kanban, list, calendar

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>({});
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceDashboard | null>(null);

  // Task checklist (inside the dialog)
  const [checklists, setChecklists] = useState<any[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [applyingChecklist, setApplyingChecklist] = useState(false);

  // Single-task assignment (inside the dialog)
  const [assignPick, setAssignPick] = useState<ResourceSelection | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Bulk assignment (List view multi-select)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPick, setBulkPick] = useState<ResourceSelection | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [search]);

  useEffect(() => {
    workforceApi.dashboard().then(setWorkforce).catch(() => {});
  }, []);

  const fetchTasks = () => {
    api.get(`/tasks/all`)
      .then(res => {
        setTasks(res.data);
      })
      .catch(err => {
        console.error("Failed to fetch tasks", err);
      });
  };

  const openTask = (task: any) => {
    setCurrentTask(task);
    setIsDialogOpen(true);
    setAssignments([]);
    setAssignPick(null);
    setChecklists([]);
    setNewChecklistItem("");
    if (task.id) {
      loadAssignments(task.id);
      loadChecklist(task.id);
    }
  };

  const loadAssignments = (taskId: number) => {
    api.get(`/tasks/${taskId}/assignments`).then(res => setAssignments(res.data)).catch(() => {});
  };

  const loadChecklist = (taskId: number) => {
    api.get(`/tasks/${taskId}/checklist`).then(res => setChecklists(res.data)).catch(() => {});
  };

  // Seed a basic, trade-aware starter checklist so the assignee knows the work steps.
  const applyStarterChecklist = () => {
    if (!currentTask.id) return;
    setApplyingChecklist(true);
    api.post(`/tasks/${currentTask.id}/checklist/apply`, { template: "AUTO" })
      .then(() => loadChecklist(currentTask.id))
      .catch(() => alert("Failed to add checklist"))
      .finally(() => setApplyingChecklist(false));
  };

  const addChecklistItem = () => {
    if (!currentTask.id || !newChecklistItem.trim()) return;
    api.post(`/tasks/${currentTask.id}/checklist/items`, { content: newChecklistItem.trim() })
      .then(() => { setNewChecklistItem(""); loadChecklist(currentTask.id); })
      .catch(() => alert("Failed to add item"));
  };

  const toggleChecklistItem = (itemId: number) => {
    api.post(`/tasks/checklist-items/${itemId}/toggle`).then(() => loadChecklist(currentTask.id)).catch(() => {});
  };

  // Assign the picked employee/contractor to the currently-open task.
  const assignPicked = () => {
    if (!currentTask.id || !assignPick) return;
    setAssigning(true);
    employeeTaskApi
      .assignResources(currentTask.id, [{ resourceType: assignPick.resourceType, resourceId: assignPick.resourceId }])
      .then(() => {
        setAssignPick(null);
        loadAssignments(currentTask.id);
      })
      .catch(() => alert("Failed to assign"))
      .finally(() => setAssigning(false));
  };

  // Remove an employee assignment from the open task (employee rows only — they carry an employeeId).
  const unassignEmployee = (employeeId: number) => {
    if (!currentTask.id || !employeeId) return;
    employeeTaskApi
      .unassign(currentTask.id, employeeId)
      .then(() => loadAssignments(currentTask.id))
      .catch(() => alert("Failed to remove assignment"));
  };

  // --- Bulk assignment (List view) ---
  const toggleSelected = (id: number) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const bulkAssign = () => {
    if (!bulkPick || selectedIds.length === 0) return;
    setBulkAssigning(true);
    Promise.all(
      selectedIds.map(id =>
        employeeTaskApi.assignResources(id, [{ resourceType: bulkPick.resourceType, resourceId: bulkPick.resourceId }])
      )
    )
      .then(() => {
        setSelectedIds([]);
        setBulkPick(null);
        fetchTasks();
      })
      .catch(() => alert("Failed to assign one or more tasks"))
      .finally(() => setBulkAssigning(false));
  };

  const approveTask = () => {
    api.post(`/employee-tasks/${currentTask.id}/approve`).then(() => {
      setIsDialogOpen(false);
      fetchTasks();
    }).catch(() => alert("Failed to approve task"));
  };

  const rejectTask = () => {
    const remarks = window.prompt("Rework remarks for the team:") || "";
    api.post(`/employee-tasks/${currentTask.id}/reject`, { remarks }).then(() => {
      setIsDialogOpen(false);
      fetchTasks();
    }).catch(() => alert("Failed to send task back"));
  };

  const handleSave = () => {
    const apiCall = currentTask.id 
      ? api.put(`/tasks/${currentTask.id}`, currentTask)
      : api.post(`/tasks`, currentTask);
      
    apiCall.then(() => {
      setIsDialogOpen(false);
      setCurrentTask({});
      fetchTasks();
    }).catch(_err => alert("Failed to save task"));
  };

  // --- Kanban Logic ---
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to prevent the dragged element from turning invisible immediately
    setTimeout(() => {
        const el = document.getElementById(`task-${id}`);
        if(el) el.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (_e: React.DragEvent, id: number) => {
    const el = document.getElementById(`task-${id}`);
    if(el) el.classList.remove('opacity-50');
    setDraggedTaskId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const taskToMove = tasks.find(t => t.id === draggedTaskId);
    if (taskToMove && taskToMove.status !== status) {
        
        // Optimistic UI update
        const updatedTasks = tasks.map(t => {
            if (t.id === draggedTaskId) return { ...t, status };
            return t;
        });
        setTasks(updatedTasks);
        
        // Backend update
        api.put(`/tasks/${draggedTaskId}/status`, { status, orderIndex: 0 })
            .catch(_err => {
                alert("Failed to move task");
                fetchTasks(); // revert
            });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'HIGH': return 'text-red-700 bg-red-100 border-red-200';
      case 'MEDIUM': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'LOW': return 'text-blue-700 bg-blue-100 border-blue-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };
  
  // Tasks shown in the List view (search-filtered) — shared by the table and bulk-select controls.
  const visibleTasks = tasks.filter(t => t.taskName.toLowerCase().includes(search.toLowerCase()));

  // Group tasks for Kanban
  const kanbanColumns = [
      { id: 'PENDING', title: 'To Do', color: 'border-slate-200 bg-slate-50' },
      { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-200 bg-blue-50' },
      { id: 'COMPLETED', title: 'Done', color: 'border-green-200 bg-green-50' }
  ];

  // Calendar logic
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  const startDate = startOfWeek(currentMonthStart);
  
  const calendarDays = [];
  let day = startDate;
  while (day <= startOfWeek(addDays(currentMonthEnd, 6))) {
      calendarDays.push(day);
      day = addDays(day, 1);
  }

  return (
    <div className="p-8 h-full flex flex-col bg-white">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage project execution, workload, and deadlines</p>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border">
                <Button variant={view === 'kanban' ? 'default' : 'ghost'} size="sm" className={view === 'kanban' ? 'shadow-sm' : ''} onClick={() => setView('kanban')}><KanbanSquare className="w-4 h-4 mr-2"/> Kanban</Button>
                <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" className={view === 'list' ? 'shadow-sm' : ''} onClick={() => setView('list')}><ListIcon className="w-4 h-4 mr-2"/> List</Button>
                <Button variant={view === 'calendar' ? 'default' : 'ghost'} size="sm" className={view === 'calendar' ? 'shadow-sm' : ''} onClick={() => setView('calendar')}><CalendarIcon className="w-4 h-4 mr-2"/> Calendar</Button>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setCurrentTask({ status: "PENDING", priority: "MEDIUM" }); setAssignments([]); }}>
                  <Plus className="mr-2 h-4 w-4" /> New Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>{currentTask.id ? 'Edit Task' : 'Create Task'}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="space-y-2">
                    <Label>Task Title</Label>
                    <Input value={currentTask.taskName || ''} onChange={e => setCurrentTask({...currentTask, taskName: e.target.value})} placeholder="e.g. Design homepage wireframes"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <textarea 
                        className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm" 
                        value={currentTask.description || ''} 
                        onChange={e => setCurrentTask({...currentTask, description: e.target.value})} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Status</Label>
                          <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={currentTask.status || 'PENDING'} onChange={e => setCurrentTask({...currentTask, status: e.target.value})}>
                            <option value="PENDING">To Do</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="PAUSED">Paused</option>
                            <option value="WAITING_MATERIAL">Waiting Material</option>
                            <option value="WAITING_APPROVAL">Waiting Approval</option>
                            <option value="COMPLETED">Done</option>
                            <option value="REWORK">Rework</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                      </div>
                      <div className="space-y-2">
                          <Label>Priority</Label>
                          <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={currentTask.priority || 'MEDIUM'} onChange={e => setCurrentTask({...currentTask, priority: e.target.value})}>
                            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                          </select>
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input type="date" value={currentTask.startDate || ''} onChange={e => setCurrentTask({...currentTask, startDate: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input type="date" value={currentTask.dueDate || ''} onChange={e => setCurrentTask({...currentTask, dueDate: e.target.value})} />
                      </div>
                  </div>
                  {currentTask.id && (
                    <div className="space-y-2">
                      <Label>Assigned Team</Label>
                      {assignments.length > 0 ? (
                        <div className="rounded-md border divide-y">
                          {assignments.map((a: any) => (
                            <div key={a.employeeId} className="flex items-center justify-between px-3 py-2 text-sm">
                              <span>{a.employeeName}{a.role ? ` (${a.role})` : ''}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">{a.status?.replace('_', ' ')}</span>
                                {a.employeeId > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => unassignEmployee(a.employeeId)}
                                    className="text-xs font-medium text-red-500 hover:text-red-700"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No one assigned yet.</p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <ResourceSelect value={assignPick} onChange={setAssignPick} className="flex-1" placeholder="Assign an employee…" />
                        <Button type="button" onClick={assignPicked} disabled={!assignPick || assigning}>
                          {assigning ? 'Assigning…' : 'Assign'}
                        </Button>
                      </div>
                    </div>
                  )}
                  {currentTask.id && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Checklist <span className="text-xs font-normal text-slate-400">(what the assignee must do)</span></Label>
                        {(() => {
                          const items = checklists.flatMap((c: any) => c.items || []);
                          const done = items.filter((i: any) => i.isCompleted).length;
                          return items.length > 0
                            ? <span className="text-xs font-semibold text-slate-500">{done}/{items.length} done</span>
                            : null;
                        })()}
                      </div>
                      {checklists.flatMap((c: any) => c.items || []).length === 0 ? (
                        <div className="rounded-md border border-dashed p-4 text-center">
                          <p className="text-xs text-slate-400 mb-2">No checklist yet — add basic work steps so the employee knows what to do.</p>
                          <Button type="button" size="sm" variant="outline" onClick={applyStarterChecklist} disabled={applyingChecklist}>
                            {applyingChecklist ? "Adding…" : "Add starter checklist"}
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-md border divide-y">
                          {checklists.map((c: any) => (
                            <div key={c.id}>
                              {(c.items || []).map((item: any) => (
                                <div key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                                  <button
                                    type="button"
                                    onClick={() => toggleChecklistItem(item.id)}
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${item.isCompleted ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}
                                  >
                                    {item.isCompleted && <span className="text-xs leading-none">✓</span>}
                                  </button>
                                  <span className={item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}>{item.content}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          value={newChecklistItem}
                          onChange={e => setNewChecklistItem(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                          placeholder="Add a checklist step…"
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" onClick={addChecklistItem} disabled={!newChecklistItem.trim()}>Add</Button>
                      </div>
                    </div>
                  )}
                  {currentTask.status === 'WAITING_APPROVAL' && (
                    <div className="flex gap-2">
                      <Button onClick={approveTask} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Approve Completion</Button>
                      <Button onClick={rejectTask} variant="outline" className="flex-1">Send Back for Rework</Button>
                    </div>
                  )}
                  <Button onClick={handleSave} className="w-full">Save Task</Button>
                </div>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* Unified Workforce dashboard — assignments across employees AND contractors */}
      {workforce && (
        <div className="mb-6 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            {([
              ['Total Assigned', workforce.totalAssignments, 'text-slate-700'],
              ['Completed', workforce.completedAssignments, 'text-emerald-600'],
              ['In Progress', workforce.inProgressAssignments, 'text-blue-600'],
              ['Overdue', workforce.overdueAssignments, 'text-red-600'],
              ['Employees', workforce.employeeAssignments, 'text-indigo-600'],
              ['Contractors', workforce.contractorAssignments, 'text-amber-600'],
            ] as [string, number, string][]).map(([label, value, color]) => (
              <div key={label} className="bg-white border border-slate-100 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-3">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {workforce.productivity.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4">
              <div className="text-sm font-semibold text-slate-600 mb-3 flex items-center"><Users className="w-4 h-4 mr-2 text-slate-400" /> Workforce Productivity (employees &amp; contractors)</div>
              <div className="space-y-2">
                {workforce.productivity.slice(0, 8).map(r => (
                  <div key={`${r.resourceType}:${r.resourceId}`} className="flex items-center gap-3 text-sm">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${RESOURCE_TYPE_STYLES[r.resourceType] || 'bg-slate-100 text-slate-600'}`}>
                      {RESOURCE_TYPE_LABELS[r.resourceType] || r.resourceType}
                    </span>
                    <span className="w-40 shrink-0 truncate font-medium text-slate-700">{r.name}</span>
                    <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.completionRate}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-28 text-right shrink-0">{r.completed}/{r.assigned} done{r.overdue > 0 ? ` · ${r.overdue} late` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* Kanban View */}
          {view === 'kanban' && (
              <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
                  {kanbanColumns.map(col => (
                      <div 
                          key={col.id} 
                          className={`w-1/3 min-w-[320px] rounded-2xl border ${col.color} p-4 flex flex-col`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, col.id)}
                      >
                          <div className="flex items-center justify-between mb-4 px-1">
                              <h3 className="font-bold text-slate-700 tracking-tight">{col.title}</h3>
                              <span className="bg-white/60 text-slate-500 text-xs font-bold px-2 py-1 rounded-full border border-slate-200">
                                  {tasks.filter(t => statusBucket(t.status) === col.id).length}
                              </span>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-3">
                              {tasks.filter(t => statusBucket(t.status) === col.id).map(task => (
                                  <div 
                                      key={task.id}
                                      id={`task-${task.id}`}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, task.id)}
                                      onDragEnd={(e) => handleDragEnd(e, task.id)}
                                      onClick={() => { openTask(task); }}
                                      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
                                  >
                                      <div className="flex justify-between items-start mb-2 gap-2">
                                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getPriorityColor(task.priority)}`}>
                                              {task.priority}
                                          </span>
                                          {task.status !== col.id && (
                                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                                  {task.status?.replace('_', ' ')}
                                              </span>
                                          )}
                                      </div>
                                      <h4 className="font-bold text-slate-800 leading-snug">{task.taskName}</h4>
                                      
                                      {task.project && (
                                          <div className="mt-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md inline-block max-w-full truncate">
                                              {task.project.projectName}
                                          </div>
                                      )}
                                      
                                      <div className="mt-4 flex items-center justify-between border-t pt-3">
                                          <div className="flex -space-x-2">
                                              {/* Placeholder avatars */}
                                              <div className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700 ring-1 ring-slate-100">
                                                  {task.assignedEmployee?.name?.substring(0,2).toUpperCase() || 'NA'}
                                              </div>
                                          </div>
                                          <div className="flex gap-3 text-slate-400">
                                              {task.dueDate && (
                                                  <div className="flex items-center text-xs font-medium" title={`Due: ${task.dueDate}`}>
                                                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                                                      {format(new Date(task.dueDate), 'MMM d')}
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {/* List View */}
          {view === 'list' && (
              <div className="flex-1 bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col">
                  <div className="p-4 border-b bg-slate-50 flex gap-4 items-center">
                      <div className="relative flex-1 max-w-md">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <Input
                              placeholder="Filter tasks..."
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                              className="pl-9 bg-white"
                          />
                      </div>
                      {selectedIds.length > 0 && (
                          <div className="flex items-center gap-2 ml-auto bg-white border rounded-lg px-3 py-2 shadow-sm">
                              <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">{selectedIds.length} selected</span>
                              <ResourceSelect value={bulkPick} onChange={setBulkPick} className="w-56" placeholder="Assign an employee…" />
                              <Button type="button" size="sm" onClick={bulkAssign} disabled={!bulkPick || bulkAssigning}>
                                  {bulkAssigning ? 'Assigning…' : `Assign to ${selectedIds.length}`}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button>
                          </div>
                      )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="bg-white border-b sticky top-0 z-10">
                                  <th className="p-4 w-10">
                                      <input
                                          type="checkbox"
                                          className="h-4 w-4 rounded border-slate-300"
                                          checked={visibleTasks.length > 0 && visibleTasks.every(t => selectedIds.includes(t.id))}
                                          onChange={e => setSelectedIds(e.target.checked ? visibleTasks.map(t => t.id) : [])}
                                      />
                                  </th>
                                  <th className="p-4 font-bold text-slate-600 text-sm">Task Name</th>
                                  <th className="p-4 font-bold text-slate-600 text-sm">Project</th>
                                  <th className="p-4 font-bold text-slate-600 text-sm">Status</th>
                                  <th className="p-4 font-bold text-slate-600 text-sm">Priority</th>
                                  <th className="p-4 font-bold text-slate-600 text-sm">Due Date</th>
                                  <th className="p-4 font-bold text-slate-600 text-sm">Time Logged</th>
                              </tr>
                          </thead>
                          <tbody>
                              {visibleTasks.map(task => (
                                  <tr key={task.id} className={`border-b hover:bg-slate-50 cursor-pointer ${selectedIds.includes(task.id) ? 'bg-blue-50' : ''}`} onClick={() => { openTask(task); }}>
                                      <td className="p-4" onClick={e => e.stopPropagation()}>
                                          <input
                                              type="checkbox"
                                              className="h-4 w-4 rounded border-slate-300"
                                              checked={selectedIds.includes(task.id)}
                                              onChange={() => toggleSelected(task.id)}
                                          />
                                      </td>
                                      <td className="p-4 font-semibold text-slate-800">{task.taskName}</td>
                                      <td className="p-4 text-slate-500 font-medium">{task.project?.projectName || '-'}</td>
                                      <td className="p-4">
                                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-bold">
                                              {task.status?.replace('_', ' ')}
                                          </span>
                                      </td>
                                      <td className="p-4">
                                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getPriorityColor(task.priority)}`}>
                                              {task.priority}
                                          </span>
                                      </td>
                                      <td className="p-4 text-slate-500 font-medium">
                                          {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : '-'}
                                      </td>
                                      <td className="p-4 text-slate-500 font-medium flex items-center gap-1.5">
                                          <Clock className="w-4 h-4" />
                                          {task.timeSpentMinutes ? `${Math.floor(task.timeSpentMinutes / 60)}h ${task.timeSpentMinutes % 60}m` : '0m'}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* Calendar View */}
          {view === 'calendar' && (
              <div className="flex-1 bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <h2 className="font-bold text-xl text-slate-800">{format(currentMonthStart, 'MMMM yyyy')}</h2>
                      {/* Simple navigation could go here, omitting for brevity */}
                  </div>
                  <div className="grid grid-cols-7 border-b bg-white">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                          <div key={d} className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{d}</div>
                      ))}
                  </div>
                  <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-slate-100 gap-px">
                      {calendarDays.map((d, i) => {
                          const isCurrentMonth = isSameMonth(d, currentMonthStart);
                          const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), d));
                          
                          return (
                              <div key={i} className={`bg-white min-h-[120px] p-2 flex flex-col ${!isCurrentMonth ? 'opacity-50 bg-slate-50' : ''}`}>
                                  <div className="text-right text-sm font-semibold text-slate-400 mb-2">{format(d, 'd')}</div>
                                  <div className="flex-1 space-y-1 overflow-y-auto">
                                      {dayTasks.map(task => (
                                          <div 
                                              key={task.id} 
                                              onClick={() => { openTask(task); }}
                                              className={`text-[10px] p-1.5 rounded truncate font-bold cursor-pointer border ${getPriorityColor(task.priority)}`}
                                              title={task.taskName}
                                          >
                                              {task.taskName}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          )}

      </div>
    </div>
  );
}

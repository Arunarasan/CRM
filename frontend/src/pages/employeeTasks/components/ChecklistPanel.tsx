import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { Checklist } from '@/types/employeeTask';

export default function ChecklistPanel({ taskId, checklist, onChanged }: { taskId: number; checklist: Checklist[]; onChanged: () => void }) {
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);

  const toggle = (itemId: number) => employeeTaskApi.toggleChecklistItem(itemId).then(onChanged);

  const addItem = async () => {
    if (!newItem.trim()) return;
    setAdding(true);
    try {
      const checklistName = checklist[0]?.name ?? 'Checklist';
      await employeeTaskApi.addChecklistItem(taskId, newItem, checklistName);
      setNewItem('');
      onChanged();
    } finally {
      setAdding(false);
    }
  };

  const allItems = checklist.flatMap((c) => c.items);

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">Checklist</h3>
      {allItems.length === 0 && <p className="text-xs text-muted-foreground">No checklist items yet.</p>}
      <ul className="flex flex-col gap-1.5">
        {allItems.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <button
              onClick={() => toggle(item.id)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${item.isCompleted ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}
            >
              {item.isCompleted && <Check className="h-3.5 w-3.5 text-white" />}
            </button>
            <span className={`text-sm ${item.isCompleted ? 'text-muted-foreground line-through' : ''}`}>{item.content}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add checklist item…"
          className="flex-1 rounded-md border px-2 py-1.5 text-xs"
        />
        <button onClick={addItem} disabled={adding || !newItem.trim()} className="rounded-md bg-primary px-2 text-primary-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

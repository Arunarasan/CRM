import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { Checklist } from '@/types/employeeTask';

export default function ChecklistPanel({ taskId, checklist, onChanged, locked, title = 'Checklist' }: { taskId: number; checklist: Checklist[]; onChanged: () => void; locked?: boolean; title?: string }) {
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

  const doneCount = allItems.filter((i) => i.isCompleted).length;
  return (
    <div className="rounded-2xl border border-[#EDE6D8] bg-white p-4 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[#1A211E]">{title}</h3>
        {allItems.length > 0 && (
          <span className="rounded-full bg-[#F3EEE2] px-2 py-0.5 text-[11px] font-medium text-[#8A6A2E]">{doneCount}/{allItems.length} done</span>
        )}
      </div>
      {allItems.length === 0 && <p className="text-[13px] text-[#9A9E96]">No checklist items yet.</p>}
      <ul className="flex flex-col gap-2.5">
        {allItems.map((item) => (
          <li key={item.id} className="flex items-center gap-2.5">
            <button
              onClick={() => toggle(item.id)}
              disabled={locked}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition disabled:opacity-70 ${item.isCompleted ? 'border-[#0A573B] bg-[#0A573B]' : 'border-[#CDD3CE] bg-white'}`}
            >
              {item.isCompleted && <Check className="h-3.5 w-3.5 text-white" />}
            </button>
            <span className={`text-[14px] ${item.isCompleted ? 'text-[#9A9E96] line-through' : 'text-[#33392F]'}`}>{item.content}</span>
          </li>
        ))}
      </ul>
      {!locked && (
        <div className="mt-3 flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add a step…"
            className="flex-1 rounded-xl border border-[#DDE2DE] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0A573B]"
          />
          <button onClick={addItem} disabled={adding || !newItem.trim()} className="flex items-center justify-center rounded-xl bg-[#0A573B] px-3 text-white active:scale-95 disabled:opacity-50">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

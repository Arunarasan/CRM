import { useEffect, useRef, useState } from 'react';
import { workforceApi } from '@/api/workforceApi';
import { WorkforceResourceView, ResourceType, RESOURCE_TYPE_LABELS, RESOURCE_TYPE_STYLES } from '@/types/workforce';
import { ChevronDown, Search, X, Users } from 'lucide-react';

export interface ResourceSelection {
  resourceType: ResourceType;
  resourceId: number;
  name?: string;
}

interface Props {
  value?: ResourceSelection | null;
  onChange: (value: ResourceSelection | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'EMPLOYEE', label: 'Employees' },
  { key: 'CONTRACTOR', label: 'Contractors' },
];

/**
 * One control to pick either an Employee or a Contractor (extensible to future resource types)
 * from a single list. Emits { resourceType, resourceId } — the unified assignment shape used
 * everywhere in the Project module.
 */
export default function ResourceSelect({ value, onChange, placeholder = 'Assign a resource…', disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [resources, setResources] = useState<WorkforceResourceView[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      workforceApi.listResources({ search: search || undefined, type: typeFilter || undefined })
        .then(setResources)
        .catch(() => setResources([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [open, search, typeFilter]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (r: WorkforceResourceView) => {
    onChange({ resourceType: r.resourceType, resourceId: r.resourceId, name: r.name });
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button type="button" disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50">
        {value ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${RESOURCE_TYPE_STYLES[value.resourceType] || 'bg-slate-100 text-slate-600'}`}>
              {RESOURCE_TYPE_LABELS[value.resourceType] || value.resourceType}
            </span>
            <span className="truncate text-slate-700">{value.name || `#${value.resourceId}`}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-slate-400"><Users className="w-4 h-4" /> {placeholder}</span>
        )}
        <span className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600"
               onClick={(e) => { e.stopPropagation(); onChange(null); }} />
          )}
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b space-y-2">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-md">
              <Search className="w-4 h-4 text-slate-400" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or contact…"
                className="flex-1 bg-transparent text-sm outline-none" />
            </div>
            <div className="flex gap-1">
              {TYPE_FILTERS.map(f => (
                <button key={f.key} type="button" onClick={() => setTypeFilter(f.key)}
                  className={`text-xs px-2 py-1 rounded-md font-medium ${typeFilter === f.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading && <div className="p-3 text-xs text-slate-400">Loading…</div>}
            {!loading && resources.length === 0 && <div className="p-3 text-xs text-slate-400">No resources found.</div>}
            {!loading && resources.map(r => (
              <button key={`${r.resourceType}:${r.resourceId}`} type="button" onClick={() => pick(r)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${RESOURCE_TYPE_STYLES[r.resourceType] || 'bg-slate-100 text-slate-600'}`}>
                  {RESOURCE_TYPE_LABELS[r.resourceType] || r.resourceType}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-700 truncate">{r.name}</span>
                  {r.subtitle && <span className="block text-xs text-slate-400 truncate">{r.subtitle}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

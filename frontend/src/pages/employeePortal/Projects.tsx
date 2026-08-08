import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, UserCog } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { MyProject } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState } from './_shared';

export default function Projects() {
  const [projects, setProjects] = useState<MyProject[]>([]);
  const navigate = useNavigate();

  useEffect(() => { employeePortalApi.projects().then(setProjects).catch(() => setProjects([])); }, []);

  return (
    <div className="flex flex-col">
      <PortalHeader title="My Projects" />
      <div className="flex flex-col gap-3 p-3">
        {projects.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="You're not assigned to any projects yet." /></div>
        ) : (
          projects.map((p) => (
            <button key={p.id} onClick={() => navigate(`/employee/tasks?search=${encodeURIComponent(p.projectName)}`)}
              className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-accent/40">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{p.projectName}</h3>
                <StatusPill status={p.status} />
              </div>
              {p.location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {p.location}</p>
              )}
              {p.projectManager && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><UserCog className="h-3 w-3" /> PM: {p.projectManager}</p>
              )}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Project progress</span><span>{p.progress ?? 0}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress ?? 0}%` }} />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                My tasks: <span className="font-medium text-foreground">{p.myCompletedCount}/{p.myTaskCount}</span> done
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

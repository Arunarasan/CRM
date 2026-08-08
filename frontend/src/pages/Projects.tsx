import { useState, useEffect } from "react";
import api from "@/lib/api";
import { projectApi } from "@/api/projectApi";
import { ProjectModuleDashboard } from "@/types/project";
import { Search, Activity, AlertTriangle, ListChecks, CheckCircle2, LayoutGrid, List, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [dashboard, setDashboard] = useState<ProjectModuleDashboard | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchProjects();
  }, [search, page]);

  useEffect(() => {
    projectApi.dashboard().then(setDashboard).catch(err => console.error("Failed to fetch project dashboard", err));
  }, []);

  const fetchProjects = () => {
    api.get(`/projects?search=${search}&page=${page}&size=10`)
      .then(res => {
        setProjects(res.data.content);
        setTotalPages(res.data.totalPages);
      })
      .catch(err => {
        console.error("Failed to fetch projects", err);
      });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PLANNING': return 'bg-violet-50 text-violet-600';
      case 'RUNNING': return 'bg-sky-50 text-sky-600';
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-600';
      case 'ON_HOLD': return 'bg-amber-50 text-amber-600';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const kpis = [
    { label: 'Running', value: dashboard?.runningProjects ?? 0, icon: Activity, tint: 'bg-sky-50 text-sky-500' },
    { label: 'Completed', value: dashboard?.completedProjects ?? 0, icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-500' },
    { label: 'Delayed', value: dashboard?.delayedProjects ?? 0, icon: AlertTriangle, tint: 'bg-rose-50 text-rose-500' },
    { label: 'Pending Tasks', value: dashboard?.pendingTasks ?? 0, icon: ListChecks, tint: 'bg-amber-50 text-amber-500' },
  ];

  return (
    <div className="p-8 space-y-6 animate-in fade-in bg-slate-50/60 min-h-screen">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Project Portfolio</h1>
        <p className="text-sm text-slate-400 mt-0.5">An overview of your active work</p>
      </div>

      {/* Soft KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center gap-4">
            <div className={`p-3 rounded-xl ${tint}`}><Icon className="h-5 w-5" /></div>
            <div>
              <div className="text-2xl font-semibold text-slate-800">{value}</div>
              <div className="text-xs font-medium text-slate-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white px-3 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex-1">
          <Search className="h-4 w-4 text-slate-300" />
          <Input
            placeholder="Search projects or customers"
            className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={`p-2 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={`p-2 rounded-xl transition-colors ${viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-white border border-slate-100">
          <Activity className="h-9 w-9 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No projects found.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all h-full cursor-pointer">
                <span className={`inline-block px-2.5 py-1 text-[11px] rounded-full font-medium ${getStatusColor(project.status)}`}>
                  {project.status.replace('_', ' ')}
                </span>
                <h3 className="text-base font-semibold text-slate-800 mt-3 line-clamp-1">{project.projectName}</h3>
                <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{project.customer?.name}</p>

                <div className="mt-5">
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Progress</span>
                    <span className="font-medium text-slate-500">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all ${project.progress === 100 ? 'bg-emerald-400' : 'bg-sky-400'}`}
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] divide-y divide-slate-50 overflow-hidden">
          {projects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <div className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/70 transition-colors cursor-pointer group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 text-[11px] rounded-full font-medium ${getStatusColor(project.status)}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{project.projectName}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{project.customer?.name}</p>
                </div>

                <div className="w-40 shrink-0 hidden sm:block">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Progress</span>
                    <span className="font-medium text-slate-500">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all ${project.progress === 100 ? 'bg-emerald-400' : 'bg-sky-400'}`}
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-2.5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-xs font-medium text-slate-400">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

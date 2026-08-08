import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { workforceApi } from "@/api/workforceApi";
import type { WorkforceListRow, WorkforceMeta } from "@/types/workforce";
import {
  RESOURCE_TYPE_LABELS, RESOURCE_TYPE_STYLES, WORKFORCE_STATUSES, WORKFORCE_STATUS_TONE,
} from "@/types/workforce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import AddWorkforceDialog from "./AddWorkforceDialog";

export default function WorkforceDirectoryPage() {
  const [rows, setRows] = useState<WorkforceListRow[]>([]);
  const [meta, setMeta] = useState<WorkforceMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [skill, setSkill] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [company, setCompany] = useState("");

  useEffect(() => { workforceApi.meta().then(setMeta).catch(console.error); }, []);

  const load = useCallback(() => {
    setLoading(true);
    workforceApi.list({
      search: search || undefined, type: type || undefined, skill: skill || undefined,
      status: status || undefined, department: department || undefined, company: company || undefined,
    })
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, type, skill, status, department, company]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name, mobile, email or skill…"
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Filter value={type} onChange={setType} placeholder="All types"
                options={(meta?.types ?? []).map((t) => ({ value: t.value, label: t.label }))} />
        <Filter value={skill} onChange={setSkill} placeholder="All skills"
                options={(meta?.skills ?? []).map((s) => ({ value: s, label: s }))} />
        <Filter value={status} onChange={setStatus} placeholder="All statuses"
                options={WORKFORCE_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} />
        <Filter value={department} onChange={setDepartment} placeholder="All departments"
                options={(meta?.departments ?? []).map((d) => ({ value: d.name, label: d.name }))} />
        <div className="w-full md:w-44">
          <Input placeholder="Company…" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <Button onClick={() => setOpen(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Add Workforce
        </Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Skill</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-center">Active Projects</th>
                <th className="p-3 font-semibold">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No workforce matches these filters.
                </td></tr>
              )}
              {rows.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/workforce/${w.id}`} className="font-bold text-slate-800 hover:text-primary">
                      {w.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {w.companyName || w.department || ""}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge className={RESOURCE_TYPE_STYLES[w.workforceType] ?? "bg-slate-100 text-slate-700"}>
                      {RESOURCE_TYPE_LABELS[w.workforceType] ?? w.workforceType}
                    </Badge>
                  </td>
                  <td className="p-3">{w.primarySkill || "—"}</td>
                  <td className="p-3">
                    <Badge className={WORKFORCE_STATUS_TONE[w.status] ?? "bg-slate-100 text-slate-700"}>
                      {w.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3 text-center font-semibold">{w.activeProjects}</td>
                  <td className="p-3 text-xs">
                    <div>{w.mobile || "—"}</div>
                    <div className="text-muted-foreground">{w.email || ""}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddWorkforceDialog open={open} onOpenChange={setOpen} meta={meta} onSaved={load} />
    </div>
  );
}

function Filter({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select className="h-10 rounded-md border bg-white px-3 text-sm shrink-0"
            value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Leave requests with approve action. Extracted from the old Human Resources "Leaves"
 * tab when HR + Workforce merged into one module.
 */
export default function HrLeavePage() {
  const [leaves, setLeaves] = useState<any[]>([]);

  const fetchData = () => {
    api.get(`/hr/leaves`).then(res => setLeaves(res.data.content || []));
  };

  useEffect(() => { fetchData(); }, []);

  const handleApproveLeave = (id: number) => {
    api.post(`/hr/leaves/${id}/approve?approvedBy=Admin`)
      .then(() => fetchData())
      .catch(_err => alert("Failed to approve leave"));
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 sticky top-0">
              <TableHead>Employee</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.map(l => (
              <TableRow key={l.id}>
                <TableCell>
                  <p className="font-bold text-slate-800">{l.employee?.firstName} {l.employee?.lastName}</p>
                  <p className="text-xs text-slate-500">{l.employee?.department?.name}</p>
                </TableCell>
                <TableCell className="font-semibold text-slate-700">{l.type}</TableCell>
                <TableCell>
                  <p className="text-sm">{format(new Date(l.startDate), 'MMM d, yyyy')}</p>
                  <p className="text-xs text-slate-500">to {format(new Date(l.endDate), 'MMM d, yyyy')}</p>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 text-xs font-bold rounded ${
                    l.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    l.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {l.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {l.status === 'PENDING' && (
                    <Button size="sm" onClick={() => handleApproveLeave(l.id)} className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {leaves.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No leave requests found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

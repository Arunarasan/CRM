import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { Download, PieChart as Activity, TrendingUp, Users, Table as TableIcon, ClipboardCheck, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

export default function ReportsHub() {
  const [dateRange, setDateRange] = useState("this_month");
  const [metrics, setMetrics] = useState<any>({});
  const [salesData, setSalesData] = useState<any[]>([]);
  const [leadStats, setLeadStats] = useState<any>({});
  const [expenses, setExpenses] = useState<any[]>([]);
  const [taskSummary, setTaskSummary] = useState<any>(null);
  const [inventorySummary, setInventorySummary] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  
  const reportRef = useRef<HTMLDivElement>(null);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = () => {
      let start = startOfMonth(new Date());
      let end = endOfMonth(new Date());
      
      if (dateRange === "last_month") {
          start = startOfMonth(subMonths(new Date(), 1));
          end = endOfMonth(subMonths(new Date(), 1));
      } else if (dateRange === "ytd") {
          start = startOfYear(new Date());
          end = endOfYear(new Date());
      }
      
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      api.get(`/reports/dashboard?startDate=${startStr}&endDate=${endStr}`).then(res => setMetrics(res.data));
      api.get(`/reports/sales-chart`).then(res => {
          // Transform month numbers to names
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const formatted = res.data.map((d: any) => ({ name: months[d.month - 1], Revenue: d.revenue }));
          setSalesData(formatted);
      });
      api.get(`/reports/lead-conversion`).then(res => setLeadStats(res.data));
      api.get(`/expenses`).then(res => setExpenses(res.data));
      api.get(`/employee-tasks/reports/summary`).then(res => setTaskSummary(res.data)).catch(() => {});
      api.get(`/reports/inventory/summary`).then(res => setInventorySummary(res.data)).catch(() => {});
      api.get(`/reports/inventory/low-stock`).then(res => setLowStock(res.data || [])).catch(() => {});
  };
  
  const pieData = Object.keys(leadStats).map(key => ({
      name: key,
      value: leadStats[key]
  }));

  const exportPDF = () => {
      const input = reportRef.current;
      if (!input) return;
      html2canvas(input, { scale: 2 }).then((canvas) => {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Analytics_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      });
  };

  const exportExcel = () => {
      // Exporting the Expenses table as an example
      const ws = XLSX.utils.json_to_sheet(expenses.map(e => ({
          Date: e.date,
          Category: e.category,
          Description: e.description,
          Amount: e.amount,
          Payment_Method: e.paymentMethod,
          Ref: e.referenceNumber
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Expenses");
      XLSX.writeFile(wb, `Expenses_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 shrink-0 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Real-time insights across sales, expenses, and operations.</p>
        </div>
        
        <div className="flex items-center gap-4">
            <select 
                className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
            >
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="ytd">Year to Date (YTD)</option>
            </select>
            
            <Button onClick={exportExcel} variant="outline" className="bg-white"><TableIcon className="w-4 h-4 mr-2" /> Export Excel</Button>
            <Button onClick={exportPDF}><Download className="w-4 h-4 mr-2" /> Export PDF</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full pb-12" ref={reportRef}>
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-500 text-sm">Total Revenue</h3>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Activity className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-black text-slate-900">${metrics.totalRevenue?.toFixed(2) || '0.00'}</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-500 text-sm">Total Expenses</h3>
                    <div className="p-2 bg-red-50 text-red-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-black text-slate-900">${metrics.totalExpenses?.toFixed(2) || '0.00'}</p>
                <p className="text-xs font-semibold text-slate-400 mt-1">COGS, Payroll, Overhead</p>
            </div>
            
            <div className="bg-slate-900 p-6 rounded-2xl shadow-md flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Activity className="w-24 h-24 text-white" /></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="font-bold text-slate-400 text-sm">Net Profit</h3>
                </div>
                <p className="text-3xl font-black text-green-400 relative z-10">${metrics.netProfit?.toFixed(2) || '0.00'}</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-500 text-sm">New Acquisitions</h3>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users className="w-5 h-5" /></div>
                </div>
                <div className="flex gap-4">
                    <div>
                        <p className="text-2xl font-black text-slate-900">{metrics.newCustomers || 0}</p>
                        <p className="text-xs text-slate-500 font-bold uppercase">Customers</p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900">{metrics.newProjects || 0}</p>
                        <p className="text-xs text-slate-500 font-bold uppercase">Projects</p>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-white border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 text-lg">Revenue Trend (YTD)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                            <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            <div className="lg:col-span-1 bg-white border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 text-lg">Lead Conversion Pipeline</h3>
                <div className="h-[300px] w-full flex items-center justify-center">
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                    {pieData.map((_entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '20px'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                         <p className="text-slate-400 font-medium">No lead data available.</p>
                    )}
                </div>
            </div>
        </div>
        
        {/* Employee Task & Work Execution */}
        {taskSummary && (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b bg-slate-50 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-lg">Field Task Execution</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 p-6">
                  <div>
                      <p className="text-2xl font-black text-slate-900">{taskSummary.totalTasks}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Total Tasks</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-emerald-600">{taskSummary.completedTasks}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Completed</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-red-600">{taskSummary.delayedTasks}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Delayed</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-amber-600">{taskSummary.reworkTasks}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Rework</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-slate-900">{taskSummary.averageActualHours}h</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Avg. Time / Task</p>
                  </div>
              </div>
              {Object.keys(taskSummary.completedByEmployee || {}).length > 0 && (
                <div className="px-6 pb-6">
                  <h4 className="font-bold text-slate-500 text-xs uppercase mb-2">Employee Productivity (Tasks Completed)</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(taskSummary.completedByEmployee).map(([name, count]) => (
                      <span key={name} className="px-3 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
                        {name}: {count as number}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Inventory & Materials */}
        {inventorySummary && (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b bg-slate-50 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-lg">Inventory & Materials</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-6 p-6">
                  <div>
                      <p className="text-2xl font-black text-slate-900">{inventorySummary.totalMaterials}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Materials</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-slate-900">{inventorySummary.totalAvailableQty}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Available Qty</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-amber-600">{inventorySummary.totalReservedQty}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Reserved Qty</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-red-600">{inventorySummary.totalDamagedQty}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Damaged Qty</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-orange-600">{inventorySummary.lowStockCount}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Low Stock</p>
                  </div>
                  <div>
                      <p className="text-2xl font-black text-red-700">{inventorySummary.outOfStockCount}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase">Out of Stock</p>
                  </div>
              </div>
              {lowStock.length > 0 && (
                <div className="px-6 pb-6">
                  <h4 className="font-bold text-slate-500 text-xs uppercase mb-2">Materials Needing Reorder</h4>
                  <div className="flex flex-wrap gap-2">
                    {lowStock.slice(0, 12).map((item, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-xs font-semibold">
                        {item.productName}: {item.currentQty}/{item.minStockLevel}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Tables */}
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-lg">General Ledger (Expenses)</h3>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {expenses.map(e => (
                        <TableRow key={e.id}>
                            <TableCell className="font-medium">{format(new Date(e.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">{e.category}</span></TableCell>
                            <TableCell className="text-slate-500 text-sm">{e.description}</TableCell>
                            <TableCell className="text-xs text-slate-400">{e.paymentMethod}</TableCell>
                            <TableCell className="text-right font-black text-red-600">-${e.amount?.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                    {expenses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No expenses logged.</TableCell></TableRow>}
                </TableBody>
            </Table>
        </div>

      </div>
    </div>
  );
}

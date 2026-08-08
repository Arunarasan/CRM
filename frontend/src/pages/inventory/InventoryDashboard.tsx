import { useEffect, useState } from "react";
import { inventoryApi } from "@/api/inventoryApi";
import type { InventoryDashboard as Dashboard, InventoryItem } from "@/types/inventory";
import { Package, TrendingUp, Lock, AlertTriangle, XCircle, ShoppingCart, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function Tile({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-black text-slate-800">{value}</div>
      </div>
    </div>
  );
}

export default function InventoryDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);

  useEffect(() => {
    inventoryApi.getDashboard().then(setDashboard).catch(() => {});
    inventoryApi.getLowStockAlerts().then(setAlerts).catch(() => {});
  }, []);

  if (!dashboard) return <div className="text-sm text-muted-foreground">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Total Materials" value={dashboard.totalMaterials} icon={Package} tone="bg-blue-100 text-blue-600" />
        <Tile label="Available Stock Value" value={currency(dashboard.availableStockValue)} icon={TrendingUp} tone="bg-emerald-100 text-emerald-600" />
        <Tile label="Reserved Stock Value" value={currency(dashboard.reservedStockValue)} icon={Lock} tone="bg-amber-100 text-amber-600" />
        <Tile label="Pending Purchase" value={dashboard.pendingPurchaseCount} icon={ShoppingCart} tone="bg-purple-100 text-purple-600" />
        <Tile label="Low Stock" value={dashboard.lowStockCount} icon={AlertTriangle} tone="bg-orange-100 text-orange-600" />
        <Tile label="Out of Stock" value={dashboard.outOfStockCount} icon={XCircle} tone="bg-red-100 text-red-600" />
        <Tile label="Today's Issues" value={dashboard.todaysIssues} icon={ArrowUpCircle} tone="bg-rose-100 text-rose-600" />
        <Tile label="Today's Returns" value={dashboard.todaysReturns} icon={ArrowDownCircle} tone="bg-teal-100 text-teal-600" />
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b bg-red-50/50 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-bold text-slate-800">Items Requiring Reorder</h3>
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {alerts.length === 0 && <div className="p-6 text-center text-sm text-emerald-600 font-semibold">Stock levels look good — no alerts.</div>}
          {alerts.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="font-bold text-slate-800">{item.product?.name}</div>
                <div className="text-xs text-muted-foreground">{item.warehouse?.name}</div>
              </div>
              <div className="text-right">
                <div className="font-black text-red-600">{item.quantity} {item.product?.unit}</div>
                <div className="text-xs text-slate-400">min {item.product?.minStockLevel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

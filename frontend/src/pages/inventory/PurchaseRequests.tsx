import { useEffect, useState } from "react";
import { inventoryApi } from "@/api/inventoryApi";
import type { PurchaseRequest } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShoppingCart } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function PurchaseRequests() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [scanning, setScanning] = useState(false);

  const load = () => inventoryApi.getPurchaseRequests().then(setRequests);

  useEffect(() => { load(); }, []);

  const runScan = () => {
    setScanning(true);
    inventoryApi.triggerPurchaseRequestScan()
      .then((r) => { alert(`Created ${r.created} new purchase request(s).`); load(); })
      .finally(() => setScanning(false));
  };

  const convert = (id: number) => {
    inventoryApi.convertPurchaseRequest(id).then(() => load()).catch((e) => alert(e?.response?.data?.message || "Failed to convert"));
  };
  const reject = (id: number) => {
    inventoryApi.rejectPurchaseRequest(id).then(() => load()).catch(() => alert("Failed to reject"));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">System-flagged low-stock queue. A manager converts each one into a real Purchase Order or rejects it — nothing is auto-ordered.</p>
        <Button variant="outline" onClick={runScan} disabled={scanning}>
          <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? "animate-spin" : ""}`} /> Scan Now
        </Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden divide-y">
        {requests.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center"><ShoppingCart className="w-5 h-5" /></div>
              <div>
                <div className="font-bold text-slate-800 text-sm">{r.product?.name} × {r.quantity} {r.product?.unit}</div>
                <div className="text-xs text-muted-foreground">{r.warehouse?.name} · reorder level {r.reorderLevelSnapshot} · {r.supplier?.name || "no supplier on file"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>
              {r.status === "PENDING" && (
                <>
                  <Button size="sm" onClick={() => convert(r.id)}>Convert to PO</Button>
                  <Button size="sm" variant="outline" onClick={() => reject(r.id)}>Reject</Button>
                </>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No purchase requests — stock levels look good.</div>}
      </div>
    </div>
  );
}

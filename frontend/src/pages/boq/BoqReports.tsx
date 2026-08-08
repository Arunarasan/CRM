import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { boqApi } from "@/api/boqApi";
import type { BoqItem } from "@/types/boq";

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function SimpleTable({ rows, columns }: { rows: any[]; columns: { key: string; label: string; currency?: boolean }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground p-4">No data.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground">
        <tr>{columns.map((c) => <th key={c.key} className="text-left p-2">{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t">
            {columns.map((c) => (
              <td key={c.key} className="p-2">{c.currency ? formatCurrency(row[c.key]) : row[c.key] ?? "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ItemTable({ items }: { items: BoqItem[] }) {
  return (
    <SimpleTable
      rows={items}
      columns={[
        { key: "itemCode", label: "Code" },
        { key: "itemName", label: "Item" },
        { key: "floorName", label: "Floor" },
        { key: "roomName", label: "Room" },
        { key: "amount", label: "Amount", currency: true },
      ]}
    />
  );
}

export default function BoqReports() {
  const { id } = useParams<{ id: string }>();
  const boqId = Number(id);
  const [roomWise, setRoomWise] = useState<any[]>([]);
  const [floorWise, setFloorWise] = useState<any[]>([]);
  const [materialConsumption, setMaterialConsumption] = useState<any[]>([]);
  const [inventoryRequirement, setInventoryRequirement] = useState<any[]>([]);
  const [labourCost, setLabourCost] = useState<any[]>([]);
  const [profit, setProfit] = useState<any>(null);
  const [pendingWork, setPendingWork] = useState<BoqItem[]>([]);
  const [approvedWork, setApprovedWork] = useState<BoqItem[]>([]);

  useEffect(() => {
    boqApi.reportRoomWiseCost(boqId).then(setRoomWise).catch(console.error);
    boqApi.reportFloorWiseCost(boqId).then(setFloorWise).catch(console.error);
    boqApi.reportMaterialConsumption(boqId).then(setMaterialConsumption).catch(console.error);
    boqApi.reportInventoryRequirement(boqId).then(setInventoryRequirement).catch(console.error);
    boqApi.reportLabourCost(boqId).then(setLabourCost).catch(console.error);
    boqApi.reportProfit(boqId).then(setProfit).catch(console.error);
    boqApi.reportPendingWork(boqId).then(setPendingWork).catch(console.error);
    boqApi.reportApprovedWork(boqId).then(setApprovedWork).catch(console.error);
  }, [boqId]);

  return (
    <div className="p-6 lg:p-8 space-y-5 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link to={`/boq/${boqId}`}><Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BOQ Reports</h1>
          <p className="text-sm text-muted-foreground">Room-wise, floor-wise, material, labour, profit, and work-status breakdowns.</p>
        </div>
      </div>

      <div className="border rounded-xl bg-card p-5">
        <Tabs defaultValue="room">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="room">Room-wise Cost</TabsTrigger>
            <TabsTrigger value="floor">Floor-wise Cost</TabsTrigger>
            <TabsTrigger value="material">Material Consumption</TabsTrigger>
            <TabsTrigger value="inventory">Inventory Requirement</TabsTrigger>
            <TabsTrigger value="labour">Labour Cost</TabsTrigger>
            <TabsTrigger value="profit">Profit</TabsTrigger>
            <TabsTrigger value="pending">Pending Work</TabsTrigger>
            <TabsTrigger value="approved">Approved Work</TabsTrigger>
          </TabsList>

          <TabsContent value="room" className="pt-3">
            <SimpleTable rows={roomWise} columns={[{ key: "room", label: "Room" }, { key: "totalCost", label: "Total Cost", currency: true }]} />
          </TabsContent>
          <TabsContent value="floor" className="pt-3">
            <SimpleTable rows={floorWise} columns={[{ key: "floor", label: "Floor" }, { key: "totalCost", label: "Total Cost", currency: true }]} />
          </TabsContent>
          <TabsContent value="material" className="pt-3">
            <SimpleTable rows={materialConsumption} columns={[
              { key: "materialName", label: "Material" }, { key: "totalQuantity", label: "Quantity" },
              { key: "unit", label: "Unit" }, { key: "totalAmount", label: "Total Cost", currency: true },
            ]} />
          </TabsContent>
          <TabsContent value="inventory" className="pt-3">
            <SimpleTable rows={inventoryRequirement} columns={[
              { key: "materialName", label: "Material" }, { key: "requiredQuantity", label: "Required Qty" },
              { key: "availableStock", label: "Available Stock" }, { key: "stockWarning", label: "Warning" },
            ]} />
          </TabsContent>
          <TabsContent value="labour" className="pt-3">
            <SimpleTable rows={labourCost} columns={[{ key: "workType", label: "Work Type" }, { key: "totalCost", label: "Total Cost", currency: true }]} />
          </TabsContent>
          <TabsContent value="profit" className="pt-3">
            {profit ? (
              <div className="grid grid-cols-3 gap-4 max-w-lg">
                <div><span className="text-xs text-muted-foreground block">Cost Total</span><span className="font-semibold">{formatCurrency(profit.costTotal)}</span></div>
                <div><span className="text-xs text-muted-foreground block">Selling Total</span><span className="font-semibold">{formatCurrency(profit.sellingTotal)}</span></div>
                <div><span className="text-xs text-muted-foreground block">Profit</span><span className="font-semibold text-green-600">{formatCurrency(profit.profit)}</span></div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Loading...</p>}
          </TabsContent>
          <TabsContent value="pending" className="pt-3"><ItemTable items={pendingWork} /></TabsContent>
          <TabsContent value="approved" className="pt-3"><ItemTable items={approvedWork} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

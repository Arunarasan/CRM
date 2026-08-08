import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { purchaseApi } from "@/api/purchaseApi";
import type { GoodsReceiptNote, GoodsReceiptNoteItem, GrnPhoto } from "@/types/purchase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PackageCheck, ShieldCheck } from "lucide-react";

const QC_TONE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  PASS: "bg-emerald-100 text-emerald-700",
  PARTIAL_PASS: "bg-amber-100 text-amber-700",
  REJECT: "bg-red-100 text-red-700",
};

export default function GoodsReceiptsPage() {
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
  const [detail, setDetail] = useState<GoodsReceiptNote | null>(null);
  const [items, setItems] = useState<GoodsReceiptNoteItem[]>([]);
  const [photos, setPhotos] = useState<GrnPhoto[]>([]);
  const [qcForm, setQcForm] = useState({ qcStatus: "PASS", reason: "", remarks: "" });

  const load = () => purchaseApi.getAllGrns().then(setGrns).catch(console.error);
  useEffect(() => { load(); }, []);

  const openDetail = (grn: GoodsReceiptNote) => {
    setDetail(grn);
    setQcForm({ qcStatus: grn.qcStatus === "PENDING" ? "PASS" : grn.qcStatus, reason: grn.qcReason || "", remarks: grn.qcRemarks || "" });
    purchaseApi.getGrnItems(grn.id).then(setItems).catch(console.error);
    purchaseApi.getGrnPhotos(grn.id).then(setPhotos).catch(console.error);
  };

  const saveQc = () => {
    if (!detail) return;
    purchaseApi.recordQualityCheck(detail.id, qcForm.qcStatus, qcForm.reason, qcForm.remarks)
      .then((updated) => { setDetail(updated); load(); })
      .catch((e) => alert(e?.response?.data?.message || "Failed to record QC"));
  };

  const approve = (grn: GoodsReceiptNote) => {
    purchaseApi.approveGrn(grn.id)
      .then(() => { alert("GRN approved — accepted stock added to inventory."); setDetail(null); load(); })
      .catch((e) => alert(e?.response?.data?.message || "Failed to approve GRN"));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Goods receipts are created from a purchase order's page ("Receive Goods"). Record the quality check here, then approve to move accepted stock into inventory.
      </p>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden divide-y">
        {grns.map((grn) => (
          <div key={grn.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0"><PackageCheck className="w-5 h-5" /></div>
              <div className="min-w-0">
                <div className="font-bold text-slate-800 text-sm">
                  {grn.grnNumber}
                  {grn.purchaseOrder?.poNumber && (
                    <Link className="text-primary text-xs font-semibold ml-2 hover:underline" to={`/purchases/orders/${grn.purchaseOrder.id}`}>
                      {grn.purchaseOrder.poNumber}
                    </Link>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {format(new Date(grn.date), "MMM d, yyyy HH:mm")} · {grn.warehouse?.name}
                  {grn.receivedByUser?.name ? ` · received by ${grn.receivedByUser.name}` : grn.receivedBy ? ` · ${grn.receivedBy}` : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={QC_TONE[grn.qcStatus] || QC_TONE.PENDING}>QC: {grn.qcStatus}</Badge>
              <Badge className={grn.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}>{grn.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => openDetail(grn)}>Details</Button>
            </div>
          </div>
        ))}
        {grns.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No goods receipts yet.</div>}
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.grnNumber}</DialogTitle></DialogHeader>
              <div className="text-xs text-muted-foreground -mt-2">
                {detail.supplierInvoiceNumber && <>Supplier invoice: <b>{detail.supplierInvoiceNumber}</b> · </>}
                {detail.vehicleNumber && <>Vehicle: <b>{detail.vehicleNumber}</b> · </>}
                Warehouse: <b>{detail.warehouse?.name}</b>
              </div>

              <div className="border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-400 border-b bg-slate-50">
                    <th className="p-2">Material</th><th className="p-2 text-right">Received</th>
                    <th className="p-2 text-right">Accepted</th><th className="p-2 text-right">Rejected</th>
                    <th className="p-2 text-right">Damaged</th><th className="p-2">Remarks</th>
                  </tr></thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="p-2 font-semibold text-slate-700">{it.product?.name}</td>
                        <td className="p-2 text-right">{it.receivedQuantity}</td>
                        <td className="p-2 text-right text-emerald-600 font-bold">{it.acceptedQuantity}</td>
                        <td className="p-2 text-right text-red-600">{it.rejectedQuantity}</td>
                        <td className="p-2 text-right text-amber-600">{it.damagedQuantity}</td>
                        <td className="p-2 text-slate-500">{it.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {photos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {photos.map((p) => (
                    <a key={p.id} href={p.photoUrl} target="_blank" rel="noreferrer">
                      <img src={p.photoUrl} alt={p.caption || "GRN photo"} className="w-20 h-20 object-cover rounded-lg border" />
                    </a>
                  ))}
                </div>
              )}

              {detail.status === "DRAFT" ? (
                <div className="border rounded-xl p-4 space-y-3 bg-slate-50/60">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-700"><ShieldCheck className="w-4 h-4" /> Quality Check</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Verdict</Label>
                      <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={qcForm.qcStatus}
                        onChange={(e) => setQcForm({ ...qcForm, qcStatus: e.target.value })}>
                        <option value="PASS">PASS</option>
                        <option value="PARTIAL_PASS">PARTIAL PASS</option>
                        <option value="REJECT">REJECT</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Reason</Label>
                      <Input value={qcForm.reason} onChange={(e) => setQcForm({ ...qcForm, reason: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Remarks</Label>
                      <Input value={qcForm.remarks} onChange={(e) => setQcForm({ ...qcForm, remarks: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={saveQc}>Save QC Verdict</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approve(detail)}
                      disabled={detail.qcStatus === "REJECT"}>
                      Approve & Add Stock
                    </Button>
                  </div>
                  {detail.qcStatus === "REJECT" && (
                    <p className="text-xs text-red-600">A quality-rejected GRN cannot be approved — raise a purchase return instead.</p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-emerald-700 font-semibold">Approved — stock added to inventory.</div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

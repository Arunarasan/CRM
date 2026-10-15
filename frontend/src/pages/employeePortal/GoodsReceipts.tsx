import { BaseInput } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { uploadFile } from '@/lib/uploadFile';
import { apiError } from '@/lib/apiError';
import { toast } from '@/components/ui/toast';
import { PortalHeader, EmptyState, StatusPill } from './_shared';
import { useT, rich } from '@/i18n';
import type { IncomingReceiptPo, ReceiptWarehouse, MyReceipt } from '@/types/employeePortal';
import { PackageCheck, Truck, ImagePlus, X, Loader2, ChevronRight } from 'lucide-react';

type LineDraft = { received: number; damaged: number };

export default function GoodsReceipts() {
  const { t } = useT();
  const [tab, setTab] = useState<'incoming' | 'mine'>('incoming');
  const [pos, setPos] = useState<IncomingReceiptPo[]>([]);
  const [warehouses, setWarehouses] = useState<ReceiptWarehouse[]>([]);
  const [mine, setMine] = useState<MyReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<IncomingReceiptPo | null>(null);

  const loadIncoming = () => {
    setLoading(true);
    employeePortalApi.incomingReceipts()
      .then(setPos)
      .catch((e) => toast.error(apiError(e, t('pw.grn.loadFailed'))))
      .finally(() => setLoading(false));
  };
  const loadMine = () => {
    setLoading(true);
    employeePortalApi.myReceipts().then(setMine).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    employeePortalApi.receiptWarehouses().then(setWarehouses).catch(() => {});
  }, []);
  useEffect(() => {
    if (tab === 'incoming') loadIncoming(); else loadMine();
  }, [tab]);

  return (
    <div className="flex flex-col pb-6">
      <PortalHeader title={t('pw.grn.title')} />

      <div className="flex gap-1 p-2">
        {(['incoming', 'mine'] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === tb ? 'bg-primary text-white' : 'bg-accent/40 text-slate-600'
            }`}
          >
            {tb === 'incoming' ? t('pw.grn.toReceive') : t('pw.grn.myReceipts')}
          </button>
        ))}
      </div>

      {loading ? (
        <EmptyState message={t('pw.loading')} />
      ) : tab === 'incoming' ? (
        pos.length === 0 ? (
          <EmptyState message={t('pw.grn.noneIncoming')} />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start [&>*]:min-w-0 md:[&>*:only-child]:col-span-2 px-3">
            {pos.map((po) => (
              <button
                key={po.purchaseOrderId}
                onClick={() => setActive(po)}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm active:bg-accent/30"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <Truck className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{po.poNumber}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {po.supplierName ?? t('pw.grn.supplier')} · {t('pw.grn.itemsToReceive', { n: po.items.length })}
                  </span>
                  {po.expectedDeliveryDate && (
                    <span className="block text-[11px] text-muted-foreground">{t('pw.grn.expected', { date: po.expectedDeliveryDate })}</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )
      ) : mine.length === 0 ? (
        <EmptyState message={t('pw.grn.noneMine')} />
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start [&>*]:min-w-0 md:[&>*:only-child]:col-span-2 px-3">
          {mine.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <PackageCheck className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{r.grnNumber}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.purchaseOrder?.poNumber ?? '—'} · {r.warehouse?.name ?? ''}
                </span>
              </span>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}

      {active && (
        <ReceiveSheet
          po={active}
          warehouses={warehouses}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            loadIncoming();
            setTab('mine');
          }}
        />
      )}
    </div>
  );
}

function ReceiveSheet({
  po, warehouses, onClose, onDone,
}: {
  po: IncomingReceiptPo;
  warehouses: ReceiptWarehouse[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(
    () => Object.fromEntries(po.items.map((l) => [l.productId, { received: l.outstanding, damaged: 0 }])),
  );
  const [warehouseId, setWarehouseId] = useState<number | ''>(po.warehouseId ?? '');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [qcStatus, setQcStatus] = useState('PASS');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsWarehouse = po.warehouseId == null;

  const setLine = (productId: number, patch: Partial<LineDraft>) =>
    setDrafts((d) => ({ ...d, [productId]: { ...d[productId], ...patch } }));

  const onPickPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        const { fileUrl } = await uploadFile(f, 'GRN');
        urls.push(fileUrl);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch (e) {
      toast.error(apiError(e, t('pw.grn.uploadFailed')));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (needsWarehouse && !warehouseId) { toast.error(t('pw.grn.chooseWarehouse')); return; }
    const items = po.items
      .map((l) => ({
        productId: l.productId,
        receivedQuantity: Number(drafts[l.productId]?.received) || 0,
        damagedQuantity: Number(drafts[l.productId]?.damaged) || 0,
      }))
      .filter((l) => l.receivedQuantity > 0);
    if (items.length === 0) { toast.error(t('pw.grn.enterQty')); return; }
    setSaving(true);
    try {
      await employeePortalApi.receiveGoods({
        purchaseOrderId: po.purchaseOrderId,
        warehouseId: warehouseId || null,
        supplierInvoiceNumber: supplierInvoice || null,
        vehicleNumber: vehicle || null,
        qcStatus,
        notes: notes || null,
        photoUrls: photos,
        items,
      });
      toast.success(qcStatus === 'REJECT'
        ? t('pw.grn.rejectedOk')
        : t('pw.grn.receivedOk'));
      onDone();
    } catch (e) {
      toast.error(apiError(e, t('pw.grn.submitFailed')));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div className="mt-auto max-h-[92vh] overflow-y-auto rounded-t-2xl bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center gap-2 border-b bg-card px-3 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{t('pw.grn.receive', { po: po.poNumber })}</h2>
            <p className="truncate text-xs text-muted-foreground">{po.supplierName ?? t('pw.grn.supplier')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-3">
          {/* Items */}
          <div className="flex flex-col gap-2">
            {po.items.map((l) => (
              <div key={l.productId} className="rounded-xl border p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{l.productName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t('pw.grn.pending', { n: l.outstanding, unit: l.unit ?? '' })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">
                    <span className="text-muted-foreground">{t('pw.grn.received')}</span>
                    <BaseInput
                      type="number" min={0} max={l.outstanding}
                      value={drafts[l.productId]?.received ?? 0}
                      onChange={(e) => setLine(l.productId, { received: Number(e.target.value) })}
                      className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="text-muted-foreground">{t('pw.grn.damaged')}</span>
                    <BaseInput
                      type="number" min={0}
                      value={drafts[l.productId]?.damaged ?? 0}
                      onChange={(e) => setLine(l.productId, { damaged: Number(e.target.value) })}
                      className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Warehouse */}
          {needsWarehouse ? (
            <label className="text-sm">
              <span className="font-medium">{t('pw.grn.intoWarehouse')}</span>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="">{t('pw.grn.selectWarehouse')}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">{rich(t('pw.grn.receivingInto', { name: po.warehouseName ?? '' }))}</p>
          )}

          {/* QC */}
          <label className="text-sm">
            <span className="font-medium">{t('pw.grn.qcLabel')}</span>
            <select
              value={qcStatus}
              onChange={(e) => setQcStatus(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="PASS">{t('pw.grn.qc.PASS')}</option>
              <option value="PARTIAL_PASS">{t('pw.grn.qc.PARTIAL_PASS')}</option>
              <option value="REJECT">{t('pw.grn.qc.REJECT')}</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="font-medium">{t('pw.grn.invoiceNo')}</span>
              <BaseInput value={supplierInvoice} onChange={(e) => setSupplierInvoice(e.target.value)}
                     className="mt-1 h-10 w-full rounded-md border px-3 text-sm" />
            </label>
            <label className="text-sm">
              <span className="font-medium">{t('pw.grn.vehicleNo')}</span>
              <BaseInput value={vehicle} onChange={(e) => setVehicle(e.target.value)}
                     className="mt-1 h-10 w-full rounded-md border px-3 text-sm" />
            </label>
          </div>

          <label className="text-sm">
            <span className="font-medium">{t('pw.grn.notes')}</span>
            <BaseInput value={notes} onChange={(e) => setNotes(e.target.value)}
                   className="mt-1 h-10 w-full rounded-md border px-3 text-sm" />
          </label>

          {/* Photos */}
          <div>
            <span className="text-sm font-medium">{t('pw.grn.photos')}</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {photos.map((p) => (
                <img key={p} src={p} alt="" className="h-16 w-16 rounded-lg border object-cover" />
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed text-muted-foreground active:bg-accent">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <BaseInput type="file" accept="image/*" capture="environment" multiple hidden
                       onChange={(e) => onPickPhotos(e.target.files)} />
              </label>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t bg-card p-3">
          <button
            onClick={submit}
            disabled={saving}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            {qcStatus === 'REJECT' ? t('pw.grn.recordRejection') : t('pw.grn.receiveApprove')}
          </button>
        </div>
      </div>
    </div>
  );
}

import { BaseInput } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { inventoryApi } from '@/api/inventoryApi';
import { useT } from '@/i18n';

interface Product { id: number; name: string; unit: string; }

export default function MaterialUsageSheet({ taskId, open, onOpenChange, onSaved }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const { t } = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (open && products.length === 0) {
      api.get('/inventory/products').then((res) => setProducts(res.data.content || [])).catch(() => {});
    }
  }, [open, products.length]);

  const submit = async () => {
    if (!productId || !quantity) return;
    setSaving(true);
    try {
      await employeeTaskApi.logMaterialUsage(taskId, Number(productId), Number(quantity), remarks || undefined);
      setQuantity(''); setRemarks('');
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const requestMaterial = async () => {
    if (!productId || !quantity) return;
    setRequesting(true);
    try {
      await inventoryApi.createMaterialRequest({ taskId, items: [{ productId: Number(productId), quantity: Number(quantity) }], remarks });
      alert(t('pw.mu.requested'));
      onOpenChange(false);
    } catch {
      alert(t('pw.mu.requestFailed'));
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('pw.mu.title')}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label>{t('pw.mu.material')}</Label>
            <select value={productId} onChange={(e) => setProductId(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]">
              <option value="">{t('pw.mu.select')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label>{t('pw.mu.qty')}</Label>
            <BaseInput type="number" min={0} step="0.01" value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]" />
          </div>
          <div>
            <Label>{t('pw.prog.remarks')}</Label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]" />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2">
          <Button onClick={submit} disabled={saving || !productId || !quantity} className="w-full bg-[#0A573B] text-white hover:bg-[#06452F]">
            {saving ? t('pw.prog.saving') : t('pw.mu.logUsage')}
          </Button>
          <Button onClick={requestMaterial} disabled={requesting || !productId || !quantity} variant="outline" className="w-full border-[#D7DED8] text-[#0A573B]">
            {requesting ? t('pw.mu.requesting') : t('pw.mu.request')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

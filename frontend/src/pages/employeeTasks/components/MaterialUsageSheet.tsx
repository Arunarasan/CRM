import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { inventoryApi } from '@/api/inventoryApi';

interface Product { id: number; name: string; unit: string; }

export default function MaterialUsageSheet({ taskId, open, onOpenChange, onSaved }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
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
      alert('Material request raised — a manager will approve and issue it.');
      onOpenChange(false);
    } catch {
      alert('Failed to raise material request');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Log Material Used</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Material</Label>
            <select value={productId} onChange={(e) => setProductId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Select material…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Quantity used</Label>
            <input type="number" min={0} step="0.01" value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <Label>Remarks</Label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2">
          <Button onClick={submit} disabled={saving || !productId || !quantity} className="w-full">
            {saving ? 'Saving…' : 'Log Usage'}
          </Button>
          <Button onClick={requestMaterial} disabled={requesting || !productId || !quantity} variant="outline" className="w-full">
            {requesting ? 'Requesting…' : "Not enough on hand? Request Material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

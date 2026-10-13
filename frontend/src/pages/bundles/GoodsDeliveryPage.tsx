import { bundleApi } from '@/api/bundleApi';
import GoodsDeliveryView from '@/components/bundles/GoodsDeliveryView';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/** Orders → Goods Delivery: the office can hand over Completed (or in-process) orders and collect the pending amount. */
export default function GoodsDeliveryPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div>
        <Link to="/bundles" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> Orders
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Goods Delivery</h1>
        <p className="text-sm text-slate-500">Deliver completed orders to the customer and collect the pending amount. An order still in process can be delivered with a remark.</p>
      </div>
      <div className="rounded-2xl border bg-white">
        <GoodsDeliveryView loadOrders={bundleApi.deliveries} deliver={bundleApi.deliver} />
      </div>
    </div>
  );
}

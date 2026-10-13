import { employeePortalApi } from '@/api/employeePortalApi';
import GoodsDeliveryView from '@/components/bundles/GoodsDeliveryView';
import { PortalHeader } from './_shared';

/** Requests → Goods Delivery: the delivery person's view of orders waiting to go to the customer. */
export default function GoodsDelivery() {
  return (
    <div className="flex flex-col">
      <PortalHeader title="Goods Delivery" />
      <GoodsDeliveryView loadOrders={employeePortalApi.deliveries} deliver={employeePortalApi.deliverOrder} />
    </div>
  );
}

import { employeePortalApi } from '@/api/employeePortalApi';
import GoodsDeliveryView from '@/components/bundles/GoodsDeliveryView';
import { PortalHeader } from './_shared';
import { useT } from '@/i18n';

/** Requests → Goods Delivery: the delivery person's view of orders waiting to go to the customer. */
export default function GoodsDelivery() {
  const { t } = useT();
  return (
    <div className="flex flex-col">
      <PortalHeader title={t('pw.goodsDelivery.title')} />
      <GoodsDeliveryView loadOrders={employeePortalApi.deliveries} deliver={employeePortalApi.deliverOrder} />
    </div>
  );
}

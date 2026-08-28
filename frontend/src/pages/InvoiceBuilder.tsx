import { Navigate } from "react-router-dom";

// Legacy /billing/invoices/new deep-link. Invoice creation now lives in the unified Billing &
// Finance module, so forward to the Finance invoice form.
export default function InvoiceBuilder() {
  return <Navigate to="/finance/invoices/new" replace />;
}

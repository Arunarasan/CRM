import { Navigate, useParams } from "react-router-dom";

// Legacy /billing/invoices/:id deep-link. Invoicing now lives in the unified Billing & Finance
// module, so forward to the Finance invoice detail page, preserving the id.
export default function InvoiceProfile() {
  const { id } = useParams();
  return <Navigate to={id ? `/finance/invoices/${id}` : "/finance/invoices"} replace />;
}

import { Navigate } from "react-router-dom";

// Billing is not a standalone module — invoicing, collection and customer balances all live in
// the unified "Billing & Finance" module at /finance. This route is kept alive so old deep-links
// resolve, and simply forwards into Finance.
export default function Billing() {
  return <Navigate to="/finance" replace />;
}

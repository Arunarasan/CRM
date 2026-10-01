import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { boqApi } from "@/api/boqApi";

/**
 * The standalone BOQ pages and the measurement list are admin-only now (kept for revisions, reports
 * and auditing). Everyone else works in the combined "Measurement & Quotation" workspace, so this
 * forwards them there: a BOQ opens its project's (or lead's) workspace, lists go to Leads.
 * Measurement detail pages stay open to everyone — they hold the drawings & photos.
 */
export default function LegacyQuoteGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (isAdmin) return <>{children}</>;
  return <ForwardToWorkspace />;
}

function ForwardToWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const leadId = params.get("leadId");
    if (!id) {
      setTarget(leadId ? `/leads/${leadId}?tab=journey` : "/leads");
      return;
    }
    boqApi.get(id)
      .then((boq: any) => setTarget(
        boq.project?.id ? `/projects/${boq.project.id}?tab=quote`
          : boq.lead?.id ? `/leads/${boq.lead.id}?tab=journey`
            : "/leads"))
      .catch(() => setTarget("/leads"));
  }, [id, params]);

  if (!target) {
    return <div className="p-8 text-sm text-muted-foreground">Opening the quotation workspace…</div>;
  }
  return <Navigate to={target} replace />;
}

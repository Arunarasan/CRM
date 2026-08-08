import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Star, Wallet, CalendarClock, MessageSquare, UserCircle } from "lucide-react";
import type { CustomerOverview } from "@/types/customer360";
import { useAuth } from "@/hooks/useAuth";

function healthColor(score?: number) {
  if (score === undefined) return "text-muted-foreground";
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-b-0 border-border/50">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

export default function CustomerSidebar({ overview, isLoading }: { overview: CustomerOverview | null; isLoading: boolean }) {
  const { hasAuthority } = useAuth();
  const canSeeFinancial = hasAuthority("CUSTOMER_FINANCIAL_READ");

  if (isLoading) {
    return (
      <Card className="shadow-sm rounded-xl">
        <CardHeader><CardTitle className="text-sm">Customer Insights</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm rounded-xl">
      <CardHeader>
        <CardTitle className="text-sm">Customer Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3 bg-muted/50 rounded-lg p-3">
          <div>
            <div className="text-xs text-muted-foreground">Health Score</div>
            <div className={`text-2xl font-bold ${healthColor(overview?.healthScore)}`}>{overview?.healthScore ?? "—"}</div>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${overview?.rating && i < overview.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
              />
            ))}
          </div>
        </div>

        <Row icon={Heart} label="Lead Score / Probability to Convert" value={overview?.leadScore != null ? `${overview.leadScore}%` : "Not tracked"} />
        {canSeeFinancial && (
          <Row
            icon={Wallet}
            label="Outstanding Balance"
            value={overview?.outstandingBalance !== undefined ? `₹${overview.outstandingBalance.toLocaleString("en-IN")}` : "—"}
          />
        )}
        <Row
          icon={CalendarClock}
          label="Next Follow-up"
          value={overview?.nextFollowUpDate ? `${new Date(overview.nextFollowUpDate).toLocaleDateString()}${overview.nextFollowUpPurpose ? ` — ${overview.nextFollowUpPurpose}` : ""}` : "None scheduled"}
        />
        <Row
          icon={MessageSquare}
          label="Last Communication"
          value={overview?.lastCommunicationDate ? `${new Date(overview.lastCommunicationDate).toLocaleDateString()} (${overview.lastCommunicationChannel || "—"})` : "No activity yet"}
        />
        <Row icon={UserCircle} label="Assigned Sales Person" value={overview?.assignedSalesPersonName || "Unassigned"} />
        <Row icon={UserCircle} label="Assigned Project Manager" value={overview?.assignedProjectManagerName || "Unassigned"} />
      </CardContent>
    </Card>
  );
}

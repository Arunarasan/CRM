import { Link } from "react-router-dom";
import {
  ArrowLeft, Pencil, Target, MapPin, Ruler, FileText, Building2,
  Receipt, Wallet, CalendarClock, Upload, MessageCircle, Phone, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CustomerOverview } from "@/types/customer360";
import { useAuth } from "@/hooks/useAuth";
import { useGoBack } from "@/hooks/useGoBack";

function statusVariant(status?: string): "success" | "warning" | "destructive" | "secondary" {
  if (!status) return "secondary";
  const s = status.toLowerCase();
  if (s === "active") return "success";
  if (s === "inactive") return "warning";
  if (s === "blacklisted") return "destructive";
  return "secondary";
}

interface Props {
  overview: CustomerOverview | null;
  isLoading: boolean;
  onEdit: () => void;
  onUploadDocument: () => void;
  onAddFollowUp: () => void;
}

export default function CustomerHeader({ overview, isLoading, onEdit, onUploadDocument, onAddFollowUp }: Props) {
  const { hasAuthority } = useAuth();
  const canWrite = hasAuthority("CUSTOMER_WRITE");
  const goBack = useGoBack("/customers");

  const quickActions = [
    { label: "Edit Customer", icon: Pencil, onClick: onEdit, show: canWrite },
    { label: "Create Lead", icon: Target, as: "link", to: "/leads", show: true },
    { label: "Create Site Visit", icon: MapPin, as: "link", to: "/site-visits", show: true },
    { label: "Add Measurement", icon: Ruler, as: "link", to: "/measurements", show: true },
    { label: "Generate Quotation from BOQ", icon: FileText, as: "link", to: "/boq", show: true },
    { label: "Start Project", icon: Building2, as: "link", to: "/projects", show: true },
    { label: "Create Invoice", icon: Receipt, as: "link", to: "/billing/invoices/new", show: canWrite },
    { label: "Record Payment", icon: Wallet, as: "link", to: "/billing", show: canWrite },
    { label: "Add Follow-up", icon: CalendarClock, onClick: onAddFollowUp, show: canWrite },
    { label: "Upload Document", icon: Upload, onClick: onUploadDocument, show: canWrite },
    {
      label: "Send WhatsApp", icon: MessageCircle, as: "external",
      href: overview?.whatsappNumber || overview?.phone ? `https://wa.me/91${(overview?.whatsappNumber || overview?.phone || "").replace(/\D/g, "")}` : undefined,
      show: !!(overview?.whatsappNumber || overview?.phone),
    },
    { label: "Call Customer", icon: Phone, as: "external", href: overview?.phone ? `tel:${overview.phone}` : undefined, show: !!overview?.phone },
    { label: "Send Email", icon: Mail, as: "external", href: overview?.email ? `mailto:${overview.email}` : undefined, show: !!overview?.email },
  ];

  return (
    <div className="bg-card border-b sticky top-0 z-10">
      <div className="px-4 sm:px-6 py-4">
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden border">
              {overview?.photoUrl ? (
                <img src={overview.photoUrl} alt={overview.name} className="w-full h-full object-cover" />
              ) : (
                (overview?.name || "?").charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              {isLoading ? (
                <div className="h-7 w-48 bg-muted animate-pulse rounded-md" />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight truncate">{overview?.name}</h1>
                  <Badge variant={statusVariant(overview?.status)}>{overview?.status || "Unknown"}</Badge>
                  {overview?.customerType && <Badge variant="outline">{overview.customerType}</Badge>}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {overview?.customerCode && <span>#{overview.customerCode}</span>}
                {overview?.companyName && <span>{overview.companyName}</span>}
                {overview?.phone && <span>{overview.phone}</span>}
                {overview?.email && <span className="truncate">{overview.email}</span>}
                {overview?.assignedEmployeeName && <span>Assigned: {overview.assignedEmployeeName}</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground/80">
                {overview?.customerSince && <span>Customer since {new Date(overview.customerSince).toLocaleDateString()}</span>}
                {overview?.createdAt && <span>Created {new Date(overview.createdAt).toLocaleDateString()}</span>}
                {overview?.updatedAt && <span>Updated {new Date(overview.updatedAt).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 overflow-x-auto pb-1">
          {quickActions.filter((a) => a.show).map((action, i) =>
            action.as === "link" ? (
              <Button key={i} asChild variant="outline" size="sm" className="shrink-0">
                <Link to={action.to!}>
                  <action.icon className="w-3.5 h-3.5" /> {action.label}
                </Link>
              </Button>
            ) : action.as === "external" ? (
              action.href ? (
                <Button key={i} asChild variant="outline" size="sm" className="shrink-0">
                  <a href={action.href} target="_blank" rel="noreferrer">
                    <action.icon className="w-3.5 h-3.5" /> {action.label}
                  </a>
                </Button>
              ) : null
            ) : (
              <Button key={i} variant="outline" size="sm" className="shrink-0" onClick={action.onClick}>
                <action.icon className="w-3.5 h-3.5" /> {action.label}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

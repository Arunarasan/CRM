import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <Icon className="w-10 h-10 mb-3 opacity-40" />
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && <div className="text-xs mt-1 max-w-xs">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

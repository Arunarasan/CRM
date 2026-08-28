import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Filters shouldn't steal width from the content behind them. This overlays them instead:
 * a right-hand drawer on tablet/desktop (sm+) and a bottom sheet on phones. Filters apply
 * live as they change, so the footer is just "Clear all" + "Done".
 */
export default function FilterSheet({
  open, onClose, title = "Filters", activeCount = 0, onClear, children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  activeCount?: number;
  onClear?: () => void;
  children: ReactNode;
}) {
  // Lock body scroll while the sheet is open and allow Esc to close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute bg-card shadow-xl flex flex-col
                   inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl animate-in slide-in-from-bottom
                   sm:inset-y-0 sm:right-0 sm:left-auto sm:w-96 sm:max-w-[90vw] sm:rounded-none sm:slide-in-from-right-8"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-semibold flex items-center gap-2">
            {title}
            {activeCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </h3>
          <button onClick={onClose} aria-label="Close filters" className="p-1.5 -mr-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t shrink-0">
          {onClear && (
            <Button variant="outline" className="flex-1" onClick={onClear} disabled={activeCount === 0}>
              Clear all
            </Button>
          )}
          <Button className="flex-1" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

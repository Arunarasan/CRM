import { useEffect } from "react";
import { create } from "zustand";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * Lightweight app-wide toast system.
 *
 * Built on zustand (already a project dependency) so notifications can be fired
 * from anywhere — inside components or plain async handlers — via the `toast`
 * helper, without threading a context through the tree.
 *
 *   import { toast } from "@/components/ui/toast";
 *   toast.success("Customer saved");
 *   toast.error("Could not save customer. Please try again.");
 *
 * Mount <Toaster /> once near the app root.
 */

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (toast: ToastItem) => void;
  dismiss: (id: number) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let counter = 0;

function show(message: string, variant: ToastVariant, duration = 4000) {
  const id = ++counter;
  const { add, dismiss } = useToastStore.getState();
  add({ id, message, variant, duration });
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
}

export const toast = {
  success: (message: string, duration?: number) => show(message, "success", duration),
  error: (message: string, duration?: number) => show(message, "error", duration ?? 6000),
  info: (message: string, duration?: number) => show(message, "info", duration),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof CheckCircle2; accent: string; iconColor: string }> = {
  success: { icon: CheckCircle2, accent: "border-l-green-500", iconColor: "text-green-600 dark:text-green-400" },
  error: { icon: AlertCircle, accent: "border-l-destructive", iconColor: "text-destructive" },
  info: { icon: Info, accent: "border-l-primary", iconColor: "text-primary" },
};

function ToastCard({ item }: { item: ToastItem }) {
  const { icon: Icon, accent, iconColor } = VARIANT_STYLE[item.variant];
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-3 w-[calc(100vw-2rem)] sm:w-96 rounded-lg border border-l-4 ${accent} bg-card text-card-foreground shadow-lg px-4 py-3 animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 fade-in`}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
      <p className="text-sm leading-snug flex-1 min-w-0 break-words">{item.message}</p>
      <button
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-0.5 p-1 rounded-md hover:bg-accent"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  // Clear everything on unmount so stray timers don't reference a torn-down tree.
  useEffect(() => () => useToastStore.setState({ toasts: [] }), []);

  return (
    <div className="fixed z-[100] bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 flex flex-col items-center sm:items-end gap-2 pointer-events-none">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}

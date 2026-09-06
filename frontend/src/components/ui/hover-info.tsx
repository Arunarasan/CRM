import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Lightweight hover-info card. Renders a fixed, cursor-following popover in a portal so it is
 * never clipped by table `overflow-x-auto`. Attach the returned `bind(content)` to any element's
 * props and drop `portal` once anywhere in the tree.
 *
 *   const info = useHoverInfo();
 *   <tr {...info.bind(<Details .../>)}>…</tr>
 *   {info.portal}
 */
export function useHoverInfo() {
  const [state, setState] = useState<{ x: number; y: number; content: ReactNode } | null>(null);

  const bind = (content: ReactNode) => ({
    onMouseEnter: (e: React.MouseEvent) => setState({ x: e.clientX, y: e.clientY, content }),
    onMouseMove: (e: React.MouseEvent) =>
      setState((s) => (s ? { ...s, x: e.clientX, y: e.clientY } : s)),
    onMouseLeave: () => setState(null),
  });

  const WIDTH = 320;
  const portal = state
    ? createPortal(
        <div
          style={{
            position: "fixed",
            top: Math.min(state.y + 18, window.innerHeight - 20),
            left: Math.min(state.x + 18, window.innerWidth - WIDTH - 12),
            width: WIDTH,
            zIndex: 70,
          }}
          className="pointer-events-none rounded-xl border bg-white p-3.5 text-sm shadow-xl animate-in fade-in-0 zoom-in-95"
        >
          {state.content}
        </div>,
        document.body,
      )
    : null;

  return { bind, portal };
}

/** A label/value row for use inside hover-info cards. */
export function InfoRow({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  if (value === null || value === undefined || value === "" || value === "—") return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="shrink-0 text-xs text-slate-400">{label}</span>
      <span className={`text-right text-xs font-medium ${accent || "text-slate-700"}`}>{value}</span>
    </div>
  );
}

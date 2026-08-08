import { ReactNode, useRef, useState } from 'react';

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  className: string;
  onClick: () => void;
}

/**
 * Minimal swipe-to-reveal wrapper (plain pointer events, no drag-drop library — @hello-pangea/dnd
 * in package.json is for drag-and-drop reordering, not this). Swipe left on the child content to
 * reveal up to 3 action buttons; tapping the content itself (no drag) still fires onTap.
 */
export default function SwipeActions({ children, actions, onTap }: { children: ReactNode; actions: SwipeAction[]; onTap?: () => void }) {
  const [dragX, setDragX] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const dragged = useRef(false);
  const maxReveal = actions.length * 72;

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    dragged.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) dragged.current = true;
    const base = open ? -maxReveal : 0;
    const next = Math.min(0, Math.max(-maxReveal, base + delta));
    setDragX(next);
  };

  const onPointerUp = () => {
    if (startX.current === null) return;
    const shouldOpen = dragX < -maxReveal / 2;
    setOpen(shouldOpen);
    setDragX(shouldOpen ? -maxReveal : 0);
    startX.current = null;
    if (!dragged.current && !open) {
      onTap?.();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {actions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: maxReveal }}>
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => { action.onClick(); setOpen(false); setDragX(0); }}
              className={`flex w-[72px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-white ${action.className}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ transform: `translateX(${dragX}px)`, transition: startX.current === null ? 'transform 150ms ease-out' : 'none' }}
        className="relative bg-transparent touch-pan-y"
      >
        {children}
      </div>
    </div>
  );
}

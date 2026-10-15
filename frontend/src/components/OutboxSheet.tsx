import { CloudUpload, Loader2, RefreshCw, Trash2, X, AlertTriangle } from 'lucide-react';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { flushOutbox, retryItem } from '@/offline/sync';
import { removeOutboxItem } from '@/offline/outbox';

/** Bottom sheet listing what is still waiting to be sent from this phone, with retry / discard. */
export default function OutboxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, isOnline, syncing } = useOfflineQueue();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Waiting to send"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#012B1D]">
            <CloudUpload className="h-5 w-5" /> Waiting to send
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 active:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isOnline && (
          <p className="mb-3 rounded-lg bg-[#F4E5C2] px-3 py-2 text-xs text-[#9D6B10]">
            You are offline. These are saved on your phone and will be sent automatically when you are back online.
          </p>
        )}

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Everything is sent. Nothing is waiting.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.clientId} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{it.description}</p>
                    <p className="text-xs text-gray-500">Saved {new Date(it.queuedAt).toLocaleString()}</p>
                  </div>
                  {it.status === 'failed' ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      <AlertTriangle className="h-3 w-3" /> Needs attention
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Waiting</span>
                  )}
                </div>
                {it.lastError && <p className="mt-1 text-xs text-red-600">{it.lastError}</p>}
                <div className="mt-2 flex gap-2">
                  {it.status === 'failed' && (
                    <button onClick={() => retryItem(it)} className="inline-flex items-center gap-1 rounded-lg bg-[#012B1D] px-3 py-1.5 text-xs font-semibold text-white active:scale-95">
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </button>
                  )}
                  <button
                    onClick={() => { if (window.confirm('Discard this? It will not be sent.')) void removeOutboxItem(it.clientId); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Discard
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <button
            onClick={() => void flushOutbox(true)}
            disabled={!isOnline || syncing}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#012B1D] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            {syncing ? 'Sending…' : 'Send now'}
          </button>
        )}
      </div>
    </div>
  );
}

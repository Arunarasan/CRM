import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X, Download, ExternalLink, Pencil, Loader2 } from "lucide-react";
import ImageEditor from "@/components/ImageEditor";
import { uploadFile, resolveFileUrl } from "@/lib/uploadFile";
import { useAuth } from "@/hooks/useAuth";

/**
 * App-wide in-app image viewer. Two ways it opens:
 *   1. Automatically — a global click interceptor catches any link that points to an uploaded IMAGE
 *      file and shows it here (a modal on the SAME page) instead of navigating to a new browser tab.
 *      These are view/download only.
 *   2. Explicitly — `useImageViewer().openImage({ ..., editable, module, onReplace })` opens the
 *      viewer with an admin Edit button (crop/rotate/compress). On save the edited image is uploaded
 *      and `onReplace` is called so the caller can persist the new URL. Used for documents.
 *
 * Only image files are intercepted; PDFs/CAD/other documents still open normally.
 */

type OpenOpts = {
  src: string;
  fileName?: string;
  /** Show the admin Edit button (also requires the user to be an admin). */
  editable?: boolean;
  /** Upload folder for the edited result. */
  module?: string;
  /** Called with the uploaded edited image so the caller can persist the replacement. */
  onReplace?: (next: { url: string; fileName?: string }) => void;
};

const ImageViewerContext = createContext<{ openImage: (o: OpenOpts) => void } | null>(null);

export function useImageViewer() {
  const ctx = useContext(ImageViewerContext);
  if (!ctx) throw new Error("useImageViewer must be used within <ImageViewerProvider>");
  return ctx;
}

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)(\?|#|$)/i;
function isImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith("data:image/") || IMG_EXT.test(url);
}

export default function ImageViewerProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const [current, setCurrent] = useState<OpenOpts | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const editFileRef = useRef<Blob | null>(null);

  const openImage = useCallback((o: OpenOpts) => {
    setCurrent({ ...o, src: resolveFileUrl(o.src) });
    setEditing(false);
  }, []);

  // "Everywhere" behaviour: intercept plain image-file links so they open in this viewer, not a new
  // tab. Bubble phase + skip when already handled, so an explicit editable opener (which calls
  // stopPropagation) still wins. Modifier-clicks (Ctrl/Cmd/middle) fall through to the browser.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!isImageUrl(href)) return;
      e.preventDefault();
      openImage({ src: href!, fileName: anchor.getAttribute("data-file-name") || undefined });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openImage]);

  const close = () => { setCurrent(null); setEditing(false); };
  const canEdit = !!current?.editable && isAdmin;

  const startEdit = async () => {
    if (!current) return;
    try {
      const blob = await fetch(current.src).then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.blob(); });
      editFileRef.current = blob;
      setEditing(true);
    } catch {
      alert("Couldn't open this image for editing. Try again.");
    }
  };

  const onEditSave = async (edited: File) => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await uploadFile(edited, current.module || "GENERAL");
      current.onReplace?.({ url: res.fileUrl, fileName: res.fileName });
      setCurrent({ ...current, src: resolveFileUrl(res.fileUrl), fileName: res.fileName });
      setEditing(false);
    } catch {
      alert("Failed to save the edited image. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImageViewerContext.Provider value={{ openImage }}>
      {children}

      {current && !editing && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm" onClick={close}>
          <div className="flex items-center justify-between gap-2 p-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="min-w-0 truncate text-sm font-medium" title={current.fileName}>{current.fileName || "Image"}</span>
            <div className="flex items-center gap-1">
              {canEdit && (
                <button onClick={startEdit} disabled={busy} className="flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-white/15 disabled:opacity-60" title="Edit image">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Edit
                </button>
              )}
              <a href={current.src} download className="rounded-md px-2 py-1 hover:bg-white/15" title="Download">
                <Download className="h-4 w-4" />
              </a>
              <a href={current.src} target="_blank" rel="noreferrer" className="rounded-md px-2 py-1 hover:bg-white/15" title="Open in new tab">
                <ExternalLink className="h-4 w-4" />
              </a>
              <button onClick={close} className="rounded-md px-2 py-1 hover:bg-white/15" aria-label="Close viewer">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-4" onClick={close}>
            <img
              src={current.src}
              alt={current.fileName || "image"}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {editing && current && editFileRef.current && (
        <ImageEditor
          file={editFileRef.current}
          fileName={current.fileName || "image"}
          open={editing}
          onCancel={() => setEditing(false)}
          onSave={onEditSave}
        />
      )}
    </ImageViewerContext.Provider>
  );
}

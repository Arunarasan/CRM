import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Crop as CropIcon, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  loadImage, renderToCanvas, processImage, blobToFile, formatBytes,
  type Rotation, type OutputFormat,
} from "@/lib/imageProcessing";

/** A crop rectangle in on-screen (display) pixels. */
interface Box { x: number; y: number; w: number; h: number; }

const STAGE_MAX_W = 560;
const STAGE_MAX_H = 380;
const HANDLE = 12; // px hit target for resize handles

const ASPECTS: { label: string; value: number | null }[] = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
];
const MAX_DIMS = [
  { label: "Original", value: 0 },
  { label: "2560px", value: 2560 },
  { label: "1600px", value: 1600 },
  { label: "1280px", value: 1280 },
  { label: "800px", value: 800 },
];

type DragMode = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

export interface ImageEditorProps {
  file: File | Blob;
  open: boolean;
  onCancel: () => void;
  onSave: (file: File) => void;
  fileName?: string;
  defaultMaxDimension?: number;
  defaultQuality?: number;
  defaultFormat?: OutputFormat;
}

/**
 * Full-screen-ish modal for editing a single image before upload: crop (drag the box),
 * rotate 90°, flip, then choose a max size + quality/format. Shows a live estimate of the
 * output dimensions and byte size, and hands back a compressed File on Save.
 */
export default function ImageEditor({
  file, open, onCancel, onSave, fileName,
  defaultMaxDimension = 1600, defaultQuality = 0.8, defaultFormat = "image/jpeg",
}: ImageEditorProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null);
  const [maxDim, setMaxDim] = useState<number>(defaultMaxDimension);
  const [quality, setQuality] = useState<number>(defaultQuality);
  const [format, setFormat] = useState<OutputFormat>(defaultFormat);

  const [crop, setCrop] = useState<Box | null>(null);
  const [estimate, setEstimate] = useState<{ w: number; h: number; bytes: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; box: Box } | null>(null);

  // Load the source image whenever the modal opens with a (new) file.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadError(null);
    setImg(null);
    loadImage(file)
      .then((image) => { if (alive) setImg(image); })
      .catch(() => { if (alive) setLoadError("Could not read this image."); });
    // Reset edits for a fresh open.
    setRotation(0); setFlipH(false); setFlipV(false); setAspect(null);
    setMaxDim(defaultMaxDimension); setQuality(defaultQuality); setFormat(defaultFormat);
    setCrop(null);
    return () => { alive = false; };
  }, [open, file, defaultMaxDimension, defaultQuality, defaultFormat]);

  // Oriented (post rotation/flip) full-resolution dimensions.
  const oriented = useMemo(() => {
    if (!img) return null;
    const rot = rotation === 90 || rotation === 270;
    return { w: rot ? img.naturalHeight : img.naturalWidth, h: rot ? img.naturalWidth : img.naturalHeight };
  }, [img, rotation]);

  // Fit the oriented image into the stage; dispScale maps display px → oriented full-res px.
  const display = useMemo(() => {
    if (!oriented) return null;
    const scale = Math.min(STAGE_MAX_W / oriented.w, STAGE_MAX_H / oriented.h, 1);
    return { w: Math.round(oriented.w * scale), h: Math.round(oriented.h * scale), scale };
  }, [oriented]);

  // Draw the oriented preview into the visible canvas whenever the orientation changes.
  useEffect(() => {
    if (!img || !display || !canvasRef.current) return;
    const rendered = renderToCanvas(img, {
      rotation, flipH, flipV, maxDimension: Math.max(display.w, display.h),
    });
    const canvas = canvasRef.current;
    canvas.width = display.w;
    canvas.height = display.h;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.clearRect(0, 0, display.w, display.h); ctx.drawImage(rendered, 0, 0, display.w, display.h); }
  }, [img, display, rotation, flipH, flipV]);

  // Default the crop box to the whole (oriented) image on first display / orientation change.
  useEffect(() => {
    if (display) setCrop({ x: 0, y: 0, w: display.w, h: display.h });
  }, [display]);

  const clampBox = useCallback((b: Box): Box => {
    if (!display) return b;
    const w = Math.min(Math.max(b.w, 20), display.w);
    const h = Math.min(Math.max(b.h, 20), display.h);
    const x = Math.min(Math.max(b.x, 0), display.w - w);
    const y = Math.min(Math.max(b.y, 0), display.h - h);
    return { x, y, w, h };
  }, [display]);

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    if (!crop) return;
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, box: crop };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !display) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      let { x, y, w, h } = drag.box;

      if (drag.mode === "move") {
        x += dx; y += dy;
      } else {
        // Adjust edges named in the mode.
        const m = drag.mode!;
        if (m.includes("w")) { x += dx; w -= dx; }
        if (m.includes("e")) { w += dx; }
        if (m.includes("n")) { y += dy; h -= dy; }
        if (m.includes("s")) { h += dy; }
        // Keep a locked aspect ratio driven by width (corner handles only).
        if (aspect) {
          h = w / aspect;
          if (m.includes("n")) y = drag.box.y + drag.box.h - h;
        }
        // Prevent inversion.
        if (w < 20) { w = 20; if (m.includes("w")) x = drag.box.x + drag.box.w - 20; }
        if (h < 20) { h = 20; if (m.includes("n")) y = drag.box.y + drag.box.h - 20; }
      }
      setCrop(clampBox({ x, y, w, h }));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [display, aspect, clampBox]);

  // When an aspect ratio is chosen, snap the current crop to it.
  useEffect(() => {
    if (!aspect || !crop || !display) return;
    const h = crop.w / aspect;
    setCrop(clampBox({ ...crop, h }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  // Convert the on-screen crop box into oriented full-resolution pixels.
  const orientedCrop = useCallback(() => {
    if (!crop || !display) return undefined;
    const s = 1 / display.scale;
    return { x: crop.x * s, y: crop.y * s, width: crop.w * s, height: crop.h * s };
  }, [crop, display]);

  // Debounced live estimate of the exported file.
  useEffect(() => {
    if (!img || !display) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const orientedCanvas = renderToCanvas(img, { rotation, flipH, flipV });
        const result = await processImage(orientedCanvas, {
          crop: orientedCrop(), maxDimension: maxDim || undefined, quality, format,
        });
        if (alive) {
          setEstimate({ w: result.width, h: result.height, bytes: result.bytes });
          URL.revokeObjectURL(result.previewUrl);
        }
      } catch { /* ignore transient estimate errors */ }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [img, display, rotation, flipH, flipV, crop, maxDim, quality, format, orientedCrop]);

  const rotate = (dir: 1 | -1) =>
    setRotation((r) => (((r + dir * 90) % 360) + 360) % 360 as Rotation);

  const handleSave = async () => {
    if (!img) return;
    setSaving(true);
    try {
      const orientedCanvas = renderToCanvas(img, { rotation, flipH, flipV });
      const result = await processImage(orientedCanvas, {
        crop: orientedCrop(), maxDimension: maxDim || undefined, quality, format,
      });
      URL.revokeObjectURL(result.previewUrl);
      onSave(blobToFile(result.blob, fileName));
    } finally {
      setSaving(false);
    }
  };

  const showAllHandles = !aspect;
  const edgeHandles: DragMode[] = ["n", "e", "s", "w"];
  const cornerHandles: DragMode[] = ["nw", "ne", "se", "sw"];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CropIcon className="h-5 w-5" /> Edit image</DialogTitle>
          <DialogDescription>Crop, rotate and compress before uploading.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="py-10 text-center text-sm text-destructive">{loadError}</p>
        ) : !img || !display ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stage */}
            <div className="flex justify-center rounded-lg border bg-muted/30 p-4">
              <div
                ref={stageRef}
                className="relative select-none touch-none"
                style={{ width: display.w, height: display.h }}
              >
                <canvas ref={canvasRef} className="absolute inset-0 rounded" />
                {crop && (
                  <div
                    className="absolute cursor-move border-2 border-primary"
                    style={{
                      left: crop.x, top: crop.y, width: crop.w, height: crop.h,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                    }}
                    onPointerDown={startDrag("move")}
                  >
                    {/* rule-of-thirds guides */}
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                      <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                      <div className="absolute top-1/3 left-0 w-full h-px bg-white/40" />
                      <div className="absolute top-2/3 left-0 w-full h-px bg-white/40" />
                    </div>
                    {cornerHandles.map((h) => (
                      <Handle key={h} pos={h!} onPointerDown={startDrag(h)} />
                    ))}
                    {showAllHandles && edgeHandles.map((h) => (
                      <Handle key={h} pos={h!} onPointerDown={startDrag(h)} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Transform toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => rotate(-1)}><RotateCcw className="h-4 w-4" /> Left</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => rotate(1)}><RotateCw className="h-4 w-4" /> Right</Button>
              <Button type="button" variant={flipH ? "default" : "outline"} size="sm" onClick={() => setFlipH((v) => !v)}><FlipHorizontal className="h-4 w-4" /> Flip H</Button>
              <Button type="button" variant={flipV ? "default" : "outline"} size="sm" onClick={() => setFlipV((v) => !v)}><FlipVertical className="h-4 w-4" /> Flip V</Button>
              <div className="ml-auto flex items-center gap-1">
                {ASPECTS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => setAspect(a.value)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${aspect === a.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
                  >{a.label}</button>
                ))}
              </div>
            </div>

            {/* Compression controls */}
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Max size</span>
                <select value={maxDim} onChange={(e) => setMaxDim(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  {MAX_DIMS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="image/jpeg">JPEG (smallest)</option>
                  <option value="image/webp">WebP</option>
                  <option value="image/png">PNG (lossless)</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">
                  Quality {format === "image/png" ? "—" : `${Math.round(quality * 100)}%`}
                </span>
                <input type="range" min={0.3} max={1} step={0.05} value={quality}
                  disabled={format === "image/png"}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-primary disabled:opacity-40" />
              </label>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span>Output preview</span>
              <span>
                {estimate ? (
                  <><strong className="text-foreground">{estimate.w}×{estimate.h}px</strong> · <strong className="text-foreground">{formatBytes(estimate.bytes)}</strong></>
                ) : "calculating…"}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={!img || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Processing…" : "Save & use"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Resize handle positioned by compass direction over the crop box. */
function Handle({ pos, onPointerDown }: { pos: string; onPointerDown: (e: React.PointerEvent) => void }) {
  const style: React.CSSProperties = { width: HANDLE, height: HANDLE };
  const cursor =
    pos === "n" || pos === "s" ? "ns-resize" :
    pos === "e" || pos === "w" ? "ew-resize" :
    pos === "nw" || pos === "se" ? "nwse-resize" : "nesw-resize";
  const map: Record<string, React.CSSProperties> = {
    nw: { left: -HANDLE / 2, top: -HANDLE / 2 },
    n: { left: `calc(50% - ${HANDLE / 2}px)`, top: -HANDLE / 2 },
    ne: { right: -HANDLE / 2, top: -HANDLE / 2 },
    e: { right: -HANDLE / 2, top: `calc(50% - ${HANDLE / 2}px)` },
    se: { right: -HANDLE / 2, bottom: -HANDLE / 2 },
    s: { left: `calc(50% - ${HANDLE / 2}px)`, bottom: -HANDLE / 2 },
    sw: { left: -HANDLE / 2, bottom: -HANDLE / 2 },
    w: { left: -HANDLE / 2, top: `calc(50% - ${HANDLE / 2}px)` },
  };
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute rounded-sm border border-primary bg-white shadow"
      style={{ ...style, ...map[pos], cursor }}
    />
  );
}

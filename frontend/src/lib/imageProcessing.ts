/**
 * Canvas-based image pipeline — crop, rotate, flip, downscale and re-encode (compress).
 * Pure browser APIs, no dependencies. Used by the ImageEditor / ImageCaptureField so
 * photos are edited and shrunk on the device *before* they hit /api/uploads.
 */

export type Rotation = 0 | 90 | 180 | 270;
export type OutputFormat = "image/jpeg" | "image/webp" | "image/png";

/** Crop rectangle in the image's natural (source) pixel coordinates. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditOptions {
  crop?: CropRect;
  rotation?: Rotation;
  flipH?: boolean;
  flipV?: boolean;
  /** Cap on the longest side, in px. Larger images are scaled down proportionally. */
  maxDimension?: number;
  /** 0..1 encoder quality (ignored for PNG). */
  quality?: number;
  format?: OutputFormat;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  /** Object URL for preview — revoke it when you're done. */
  previewUrl: string;
  bytes: number;
}

/** Anything drawable that also exposes an intrinsic size. */
export type ImageSource = HTMLImageElement | HTMLCanvasElement;

function intrinsicSize(src: ImageSource): { w: number; h: number } {
  return "naturalWidth" in src
    ? { w: src.naturalWidth, h: src.naturalHeight }
    : { w: src.width, h: src.height };
}

/** Load a File/Blob/URL into a decoded <img>. */
export function loadImage(src: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const isObjectUrl = typeof src !== "string";
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    img.onload = () => {
      if (isObjectUrl) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (isObjectUrl) URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
      format,
      format === "image/png" ? undefined : quality
    );
  });
}

/**
 * Apply crop → rotation/flip → downscale onto a fresh canvas and return it (unencoded).
 * `crop` is in the SOURCE image's pixel coordinates and is applied before rotation.
 */
export function renderToCanvas(
  image: ImageSource,
  opts: Omit<EditOptions, "quality" | "format"> & { matte?: string } = {}
): HTMLCanvasElement {
  const { crop, rotation = 0, flipH = false, flipV = false, maxDimension, matte } = opts;
  const size = intrinsicSize(image);

  const cropW = crop?.width ?? size.w;
  const cropH = crop?.height ?? size.h;
  const srcX = crop?.x ?? 0;
  const srcY = crop?.y ?? 0;

  // Rotating 90/270 swaps the visible width/height.
  const rotated = rotation === 90 || rotation === 270;
  const orientedW = rotated ? cropH : cropW;
  const orientedH = rotated ? cropW : cropH;

  const scale =
    maxDimension && Math.max(orientedW, orientedH) > maxDimension
      ? maxDimension / Math.max(orientedW, orientedH)
      : 1;

  const finalW = Math.max(1, Math.round(orientedW * scale));
  const finalH = Math.max(1, Math.round(orientedH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  if (matte) {
    ctx.fillStyle = matte;
    ctx.fillRect(0, 0, finalW, finalH);
  }
  ctx.imageSmoothingQuality = "high";

  ctx.translate(finalW / 2, finalH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  const drawW = cropW * scale;
  const drawH = cropH * scale;
  ctx.drawImage(image, srcX, srcY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH);
  return canvas;
}

/**
 * Apply crop → rotation/flip → downscale → encode, and return the resulting Blob plus its
 * final pixel size and a preview URL. Everything is optional: with no options it just
 * re-encodes at the given quality/format.
 */
export async function processImage(
  image: ImageSource,
  opts: EditOptions = {}
): Promise<ProcessedImage> {
  const { quality = 0.8, format = "image/jpeg", ...rest } = opts;
  // White matte so transparent regions flattened to JPEG don't go black.
  const canvas = renderToCanvas(image, {
    ...rest,
    matte: format === "image/jpeg" ? "#ffffff" : undefined,
  });
  const blob = await canvasToBlob(canvas, format, quality);
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    previewUrl: URL.createObjectURL(blob),
    bytes: blob.size,
  };
}

/**
 * Compress (and optionally downscale) an image File without any editing UI — used for the
 * non-admin path where cropping/rotating is not permitted but keeping uploads small still is.
 * Falls back to the original file if it isn't an image or processing fails.
 */
export async function compressImageFile(
  file: File,
  opts: { maxDimension?: number; quality?: number; format?: OutputFormat } = {}
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const image = await loadImage(file);
    const { maxDimension = 1600, quality = 0.8, format = "image/jpeg" } = opts;
    const result = await processImage(image, { maxDimension, quality, format });
    URL.revokeObjectURL(result.previewUrl);
    // Don't upsize a file that was already smaller than our re-encode.
    if (result.bytes >= file.size) return file;
    return blobToFile(result.blob, file.name);
  } catch {
    return file;
  }
}

/** Turn a processed Blob into an upload-ready File with a sensible name + extension. */
export function blobToFile(blob: Blob, baseName = "image"): File {
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  const stem = baseName.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${stem}-${Date.now()}.${ext}`, { type: blob.type });
}

/** Human-readable byte size, e.g. "842 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

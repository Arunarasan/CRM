import api from "./api";

/**
 * Shared device-upload helper. Sends a real File/Blob picked from the user's
 * device (or recorded) to the generic /api/uploads endpoint and returns an
 * absolute URL that can be linked or embedded anywhere in the app.
 *
 * Before this, most "add media / add document" forms only let you paste an
 * external link. This lets every form import straight from the device instead.
 */

// baseURL is e.g. http://localhost:8080/api — the uploaded files are served from
// the backend root at /uploads/**, so strip the trailing /api to build links.
export const API_ORIGIN = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");

/** Turn a stored relative "/uploads/..." path into an absolute, openable URL. */
export function resolveFileUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("/uploads/")) return API_ORIGIN + url;
  return url; // already absolute, external link, or data: URL
}

export interface UploadedFile {
  /** Absolute URL to the stored file. */
  fileUrl: string;
  /** Original file name as picked from the device. */
  fileName: string;
}

/**
 * Upload a single file to the backend. `module` groups files on disk
 * (e.g. MEASUREMENT, LEAD, PROJECT, CUSTOMER).
 */
export async function uploadFile(file: File | Blob, module = "GENERAL"): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("module", module);
  const res = await api.post<{ fileUrl: string; fileName: string }>("/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const fileName = res.data.fileName || (file instanceof File ? file.name : "file");
  return { fileUrl: resolveFileUrl(res.data.fileUrl), fileName };
}

/** Coarse media type inferred from a File's MIME type, matching the labels the CRM uses. */
export function mediaTypeOf(file: File): "Image" | "Video" | "Audio" | "PDF" | "File" {
  const t = file.type;
  if (t.startsWith("image/")) return "Image";
  if (t.startsWith("video/")) return "Video";
  if (t.startsWith("audio/")) return "Audio";
  if (t === "application/pdf") return "PDF";
  return "File";
}

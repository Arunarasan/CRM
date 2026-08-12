package com.arudra.crm.storage;

import java.io.IOException;

/**
 * Pluggable file storage. Two implementations exist, chosen by the {@code app.storage.type}
 * property: {@link LocalStorageService} (disk, default — dev) and {@link S3StorageService}
 * (AWS S3 or Cloudflare R2 — production). Callers (FileUploadController) never care which.
 */
public interface StorageService {

    /**
     * Persist raw bytes and return a linkable URL.
     *
     * @param bytes            file contents
     * @param contentType      MIME type (may be null)
     * @param module           grouping folder, e.g. "MEASUREMENT" / "PROJECT"
     * @param originalFilename name as picked on the device (used for extension + display)
     */
    StoredFile store(byte[] bytes, String contentType, String module, String originalFilename) throws IOException;
}

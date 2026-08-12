package com.arudra.crm.storage;

/**
 * Result of persisting an uploaded file.
 *
 * @param fileUrl  URL the frontend can link/embed. For local storage this is a relative
 *                 "/uploads/..." path (absolutized client-side); for S3/R2 it is the
 *                 absolute public object URL.
 * @param fileName original file name as picked from the device.
 */
public record StoredFile(String fileUrl, String fileName) {
}

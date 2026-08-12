package com.arudra.crm.storage;

import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/** Shared, sanitized object-key construction so local disk and S3/R2 lay files out identically. */
final class StorageKeys {

    private StorageKeys() {
    }

    static String safeModule(String module) {
        return (module == null ? "GENERAL" : module).replaceAll("[^A-Za-z0-9_-]", "_");
    }

    static String cleanOriginalName(String originalFilename) {
        String name = StringUtils.cleanPath(originalFilename == null ? "file" : originalFilename);
        return name.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    /** e.g. {@code PROJECT/2026/08/<uuid>-photo.jpg} — used verbatim as the S3 key and the disk sub-path. */
    static String objectKey(String module, String originalFilename) {
        String yearMonth = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String storedName = UUID.randomUUID() + "-" + cleanOriginalName(originalFilename);
        return safeModule(module) + "/" + yearMonth + "/" + storedName;
    }
}

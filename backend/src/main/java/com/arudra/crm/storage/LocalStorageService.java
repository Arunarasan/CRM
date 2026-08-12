package com.arudra.crm.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Default storage: writes under {@code app.upload.dir} and returns a relative "/uploads/..." URL
 * served by {@link com.arudra.crm.config.StaticResourceConfig}. Fine for local dev; note that on
 * ephemeral hosts (e.g. Render) this disk is wiped on redeploy — use the S3/R2 backend there.
 */
@Service
@ConditionalOnExpression("!'${app.storage.type:local}'.equalsIgnoreCase('s3') && !'${app.storage.type:local}'.equalsIgnoreCase('r2')")
public class LocalStorageService implements StorageService {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Override
    public StoredFile store(byte[] bytes, String contentType, String module, String originalFilename) throws IOException {
        String key = StorageKeys.objectKey(module, originalFilename);
        Path target = Path.of(uploadDir, key.split("/")).toAbsolutePath().normalize();
        Files.createDirectories(target.getParent());
        Files.write(target, bytes);
        return new StoredFile("/uploads/" + key, StorageKeys.cleanOriginalName(originalFilename));
    }
}

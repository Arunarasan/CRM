package com.arudra.crm.storage;

import com.arudra.crm.entity.User;
import com.arudra.crm.security.CurrentUserService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * The StorageService everyone injects: sensitive modules ({@link PrivateFileStore#PRIVATE_MODULES})
 * go to private storage, everything else (catalogue images, project photos…) to the normal public
 * storage — so every upload path is covered without each caller choosing.
 */
@Service
@Primary
public class PrivacyAwareStorageService implements StorageService {

    private final StorageService publicStorage;
    private final PrivateFileStore privateStore;
    private final CurrentUserService currentUserService;

    public PrivacyAwareStorageService(@Qualifier("backendStorage") StorageService publicStorage,
                                      PrivateFileStore privateStore, CurrentUserService currentUserService) {
        this.publicStorage = publicStorage;
        this.privateStore = privateStore;
        this.currentUserService = currentUserService;
    }

    @Override
    public StoredFile store(byte[] bytes, String contentType, String module, String originalFilename) throws IOException {
        if (PrivateFileStore.isPrivateModule(module)) {
            User uploader = null;
            try {
                uploader = currentUserService.getCurrentUser();
            } catch (RuntimeException ignored) {
                // no request context (kiosk / background) — stored without an owner
            }
            return privateStore.store(bytes, contentType, module, originalFilename, uploader == null ? null : uploader.getId());
        }
        return publicStorage.store(bytes, contentType, module, originalFilename);
    }

    @Override
    public byte[] read(String key) throws IOException {
        return publicStorage.read(key);
    }

    @Override
    public void delete(String key) throws IOException {
        publicStorage.delete(key);
    }

    /** Reads either kind of stored link ("/api/files/private/…" or "/uploads/…"). */
    public byte[] readUrl(String url) throws IOException {
        if (PrivateFileStore.isPrivateUrl(url)) return privateStore.read(PrivateFileStore.keyFromUrl(url));
        return publicStorage.read(url.substring(url.indexOf("/uploads/") + "/uploads/".length()).split("[?#]")[0]);
    }
}

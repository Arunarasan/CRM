package com.arudra.crm.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Binds {@code app.storage.s3.*}. Works for both AWS S3 and Cloudflare R2:
 * <ul>
 *   <li><b>AWS S3</b> — leave {@code endpoint} blank, set {@code region} (e.g. ap-south-1).</li>
 *   <li><b>Cloudflare R2</b> — set {@code endpoint} to
 *       {@code https://<account-id>.r2.cloudflarestorage.com} and {@code region=auto}.</li>
 * </ul>
 * {@code publicBaseUrl} is the origin objects are served from (a public bucket URL, an R2
 * public dev URL, or a custom CDN domain); the object key is appended to it.
 */
@Component
@ConfigurationProperties(prefix = "app.storage.s3")
public class S3StorageProperties {

    private String bucket;
    private String region = "auto";
    /** Override for S3-compatible providers (R2, MinIO). Blank = real AWS S3. */
    private String endpoint;
    private String accessKey;
    private String secretKey;
    /** Public origin for reads, e.g. https://cdn.arudra.com or https://pub-xxxx.r2.dev. No trailing slash. */
    private String publicBaseUrl;
    /** R2 requires path-style access; AWS works with virtual-hosted (false). */
    private boolean pathStyleAccess = true;

    public String getBucket() { return bucket; }
    public void setBucket(String bucket) { this.bucket = bucket; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getAccessKey() { return accessKey; }
    public void setAccessKey(String accessKey) { this.accessKey = accessKey; }

    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey; }

    public String getPublicBaseUrl() { return publicBaseUrl; }
    public void setPublicBaseUrl(String publicBaseUrl) { this.publicBaseUrl = publicBaseUrl; }

    public boolean isPathStyleAccess() { return pathStyleAccess; }
    public void setPathStyleAccess(boolean pathStyleAccess) { this.pathStyleAccess = pathStyleAccess; }
}

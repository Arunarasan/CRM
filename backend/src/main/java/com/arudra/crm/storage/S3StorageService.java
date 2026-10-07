package com.arudra.crm.storage;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;

/**
 * Stores uploads in AWS S3 or Cloudflare R2 (same S3 API). Activated with
 * {@code app.storage.type=s3} or {@code app.storage.type=r2}. Returns an absolute public URL so the frontend links to the
 * object directly (no proxying through the backend). Survives redeploys, unlike local disk.
 *
 * <p>Fallback: when the bucket can't be reached (network outage, bad credentials) an upload is saved
 * on the server disk under the same key instead of failing, and gets a "/uploads/{key}" link. Those
 * links are served disk-first by {@link com.arudra.crm.controller.UploadsController}, and
 * {@link #copyDiskFilesToBucket()} moves the files into the bucket once it is reachable again — the
 * link keeps working throughout because the key never changes.
 */
@Slf4j
@Service
@ConditionalOnExpression("'${app.storage.type:local}'.equalsIgnoreCase('s3') || '${app.storage.type:local}'.equalsIgnoreCase('r2')")
@EnableConfigurationProperties(S3StorageProperties.class)
public class S3StorageService implements StorageService {

    /** Disk files younger than this may still be mid-write; the copy job leaves them for its next run. */
    private static final Duration SETTLE_TIME = Duration.ofMinutes(1);
    private static final String TEMP_PREFIX = ".part-";

    private final S3StorageProperties props;
    private S3Client s3;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    public S3StorageService(S3StorageProperties props) {
        this.props = props;
    }

    @PostConstruct
    void init() {
        if (!StringUtils.hasText(props.getBucket())) {
            throw new IllegalStateException("app.storage.type=s3 but app.storage.s3.bucket is not set");
        }
        var builder = S3Client.builder()
                .region(Region.of(props.getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey())))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(props.isPathStyleAccess())
                        .build())
                // Bound how long an upload waits on an unreachable bucket before falling back to disk.
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallTimeout(Duration.ofSeconds(60))
                        .build());
        if (StringUtils.hasText(props.getEndpoint())) {
            builder.endpointOverride(URI.create(props.getEndpoint()));
        }
        this.s3 = builder.build();
    }

    @Override
    public StoredFile store(byte[] bytes, String contentType, String module, String originalFilename) throws IOException {
        String key = StorageKeys.objectKey(module, originalFilename);
        try {
            put(key, bytes, contentType);
        } catch (SdkException e) {
            writeToDisk(key, bytes);
            log.warn("Storage bucket unavailable ({}); saved {} on the server disk - it is copied to the bucket "
                    + "automatically once the bucket is reachable", e.getMessage(), key);
            return new StoredFile("/uploads/" + key, StorageKeys.cleanOriginalName(originalFilename));
        }

        String base = props.getPublicBaseUrl();
        String fileUrl = StringUtils.hasText(base)
                ? base.replaceAll("/+$", "") + "/" + key
                : "/uploads/" + key; // no public origin configured: fall back to a relative path
        return new StoredFile(fileUrl, StorageKeys.cleanOriginalName(originalFilename));
    }

    @Override
    public byte[] read(String key) throws java.io.IOException {
        Path local = diskCopy(key);
        if (local != null) return Files.readAllBytes(local);
        try (ResponseInputStream<GetObjectResponse> in = open(key, null)) {
            return in.readAllBytes();
        }
    }

    /**
     * The server-disk copy of a key (saved while the bucket was unreachable, or from before the bucket
     * was used), or null when there is none.
     */
    public Path diskCopy(String key) {
        Path root = diskRoot();
        Path file = root.resolve(key).normalize();
        return file.startsWith(root) && Files.isRegularFile(file) ? file : null;
    }

    /**
     * Streams an object, optionally only a byte range (an HTTP {@code Range} header value such as
     * "bytes=0-"), for {@link com.arudra.crm.controller.UploadsController}. Throws
     * {@link java.nio.file.NoSuchFileException} when the bucket has no such key.
     */
    public ResponseInputStream<GetObjectResponse> open(String key, String range) throws java.nio.file.NoSuchFileException {
        try {
            return s3.getObject(GetObjectRequest.builder()
                    .bucket(props.getBucket())
                    .key(key)
                    .range(StringUtils.hasText(range) ? range : null)
                    .build());
        } catch (NoSuchKeyException e) {
            throw new java.nio.file.NoSuchFileException(key);
        }
    }

    /**
     * Moves files sitting on the server disk into the bucket: each is uploaded under its own key, the
     * bucket copy's size is checked, and only then is the disk copy deleted — so its "/uploads/{key}"
     * link keeps working before, during and after. Stops at the first network failure (the bucket is
     * still unreachable) and tries again on the next run.
     */
    @Scheduled(initialDelayString = "${app.storage.disk-sync-initial-delay-ms:120000}",
            fixedDelayString = "${app.storage.disk-sync-interval-ms:600000}")
    public void copyDiskFilesToBucket() {
        Path root = diskRoot();
        if (!Files.isDirectory(root)) return;
        Instant settled = Instant.now().minus(SETTLE_TIME);
        List<Path> files;
        try (Stream<Path> walk = Files.walk(root)) {
            files = walk.filter(Files::isRegularFile)
                    .filter(f -> !f.getFileName().toString().startsWith("."))
                    .filter(f -> {
                        try {
                            return Files.getLastModifiedTime(f).toInstant().isBefore(settled);
                        } catch (IOException e) {
                            return false;
                        }
                    })
                    .toList();
        } catch (IOException e) {
            log.warn("Couldn't list disk uploads to copy to the storage bucket: {}", e.getMessage());
            return;
        }
        if (files.isEmpty()) return;

        int copied = 0;
        for (Path file : files) {
            String key = root.relativize(file).toString().replace('\\', '/');
            try {
                byte[] bytes = Files.readAllBytes(file);
                put(key, bytes, MediaTypeFactory.getMediaType(key).map(MediaType::toString).orElse(null));
                Long stored = s3.headObject(HeadObjectRequest.builder().bucket(props.getBucket()).key(key).build())
                        .contentLength();
                if (stored != null && stored == bytes.length) {
                    Files.delete(file);
                    copied++;
                } else {
                    log.warn("Bucket copy of {} has size {} (expected {}); keeping the disk copy", key, stored, bytes.length);
                }
            } catch (SdkClientException e) {
                log.info("Storage bucket still unreachable ({}); {} disk upload(s) wait for the next try",
                        e.getMessage(), files.size() - copied);
                break;
            } catch (SdkException | IOException e) {
                log.warn("Couldn't copy {} to the storage bucket: {}", key, e.getMessage());
            }
        }
        if (copied > 0) log.info("Copied {} disk upload(s) to the storage bucket", copied);
    }

    private void put(String key, byte[] bytes, String contentType) {
        s3.putObject(PutObjectRequest.builder()
                        .bucket(props.getBucket())
                        .key(key)
                        .contentType(contentType != null ? contentType : "application/octet-stream")
                        .contentLength((long) bytes.length)
                        .build(),
                RequestBody.fromBytes(bytes));
    }

    /** Writes to a temp name first, then renames — the copy job never picks up a half-written file. */
    private void writeToDisk(String key, byte[] bytes) throws IOException {
        Path target = diskRoot().resolve(key).normalize();
        Files.createDirectories(target.getParent());
        Path temp = Files.createTempFile(target.getParent(), TEMP_PREFIX, ".tmp");
        try {
            Files.write(temp, bytes);
            Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    private Path diskRoot() {
        return Path.of(uploadDir).toAbsolutePath().normalize();
    }
}

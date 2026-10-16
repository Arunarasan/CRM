package com.arudra.crm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;

import javax.crypto.Cipher;
import javax.crypto.CipherOutputStream;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Stream;

/**
 * Nightly, encrypted, off-site backup. The same dump the admin can download (database, plus the
 * uploaded files when they live on the server disk) is encrypted with AES-256-GCM and pushed to a
 * separate private S3-compatible bucket (and/or a local directory), then copies older than the
 * retention window are deleted.
 *
 * <p>File format ({@code .crmbk}): ASCII "CRMBK1", a 12-byte random IV, then the GCM ciphertext with
 * its 16-byte tag at the end. Decrypt with {@code scripts/decrypt_backup.py} (see docs/BACKUP_RESTORE.md).
 * Off unless {@code app.backup.offsite.enabled=true}; the encryption key is mandatory when enabled.
 */
@Service
public class OffsiteBackupService {

    private static final Logger log = LoggerFactory.getLogger(OffsiteBackupService.class);
    static final byte[] MAGIC = "CRMBK1".getBytes(StandardCharsets.US_ASCII);
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final BackupService backupService;
    private final NotificationService notificationService;
    private final boolean enabled;
    private final String keyBase64;
    private final String bucket, endpoint, region, accessKey, secretKey, prefix, localDir;
    private final int retentionDays;
    private final SecureRandom random = new SecureRandom();

    private volatile Map<String, Object> lastRun = Map.of("status", "never");

    public OffsiteBackupService(BackupService backupService, NotificationService notificationService,
                                @Value("${app.backup.offsite.enabled:false}") boolean enabled,
                                @Value("${app.backup.offsite.encryption-key:}") String keyBase64,
                                @Value("${app.backup.offsite.bucket:}") String bucket,
                                @Value("${app.backup.offsite.endpoint:}") String endpoint,
                                @Value("${app.backup.offsite.region:auto}") String region,
                                @Value("${app.backup.offsite.access-key:}") String accessKey,
                                @Value("${app.backup.offsite.secret-key:}") String secretKey,
                                @Value("${app.backup.offsite.prefix:crm-backups/}") String prefix,
                                @Value("${app.backup.offsite.local-dir:}") String localDir,
                                @Value("${app.backup.offsite.retention-days:30}") int retentionDays) {
        this.backupService = backupService;
        this.notificationService = notificationService;
        this.enabled = enabled;
        this.keyBase64 = keyBase64;
        this.bucket = bucket;
        this.endpoint = endpoint;
        this.region = region;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.prefix = prefix.endsWith("/") || prefix.isEmpty() ? prefix : prefix + "/";
        this.localDir = localDir;
        this.retentionDays = retentionDays;
        if (enabled) {
            key(); // fail fast on a missing or malformed key
            if (!StringUtils.hasText(bucket) && !StringUtils.hasText(localDir)) {
                throw new IllegalStateException("app.backup.offsite.enabled=true but neither a bucket nor a local-dir is set");
            }
        }
    }

    public Map<String, Object> status() {
        Map<String, Object> m = new LinkedHashMap<>(lastRun);
        m.put("enabled", enabled);
        m.put("retentionDays", retentionDays);
        return m;
    }

    @Scheduled(cron = "${app.backup.offsite.cron:0 30 2 * * *}", zone = "${app.backup.offsite.zone:Asia/Kolkata}")
    public void nightly() {
        if (enabled) runNow();
    }

    /** Runs one backup immediately; returns what was written. Never throws. */
    public synchronized Map<String, Object> runNow() {
        String stamp = LocalDateTime.now().format(STAMP);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("startedAt", Instant.now().toString());
        Path dir = null;
        try {
            dir = Files.createTempDirectory("crm-backup-");
            Path db = dir.resolve("database-" + stamp + ".sql.gz.crmbk");
            try (OutputStream out = encryptingStream(db)) {
                backupService.writeDatabaseDump(out);
            }
            ship(db);
            result.put("database", db.getFileName().toString());
            result.put("databaseBytes", Files.size(db));

            if (backupService.isLocalStorage()) {
                Path files = dir.resolve("files-" + stamp + ".zip.crmbk");
                try (OutputStream out = encryptingStream(files)) {
                    backupService.writeFilesZip(out);
                }
                ship(files);
                result.put("files", files.getFileName().toString());
            }
            result.put("deletedOld", prune());
            result.put("status", "ok");
            log.info("Off-site backup finished: {}", result);
        } catch (Exception e) {
            result.put("status", "failed");
            result.put("error", e.getClass().getSimpleName());
            log.error("Off-site backup FAILED", e);
            try {
                notificationService.dispatchToAdmins("Nightly backup failed",
                        "The encrypted off-site backup did not complete. Check the server log.", "ERROR", null, null);
            } catch (Exception ignored) {
                // notification is best effort
            }
        } finally {
            result.put("finishedAt", Instant.now().toString());
            lastRun = result;
            deleteQuietly(dir);
        }
        return result;
    }

    private OutputStream encryptingStream(Path target) throws Exception {
        byte[] iv = new byte[12];
        random.nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key(), "AES"), new GCMParameterSpec(128, iv));
        OutputStream raw = new BufferedOutputStream(Files.newOutputStream(target), 64 * 1024);
        raw.write(MAGIC);
        raw.write(iv);
        return new CipherOutputStream(raw, cipher);
    }

    private void ship(Path file) throws IOException {
        String name = file.getFileName().toString();
        if (StringUtils.hasText(localDir)) {
            Path dest = Path.of(localDir);
            Files.createDirectories(dest);
            Files.copy(file, dest.resolve(name), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        if (StringUtils.hasText(bucket)) {
            try (S3Client s3 = client()) {
                s3.putObject(PutObjectRequest.builder().bucket(bucket).key(prefix + name)
                        .contentType("application/octet-stream").build(), RequestBody.fromFile(file));
            }
        }
    }

    /** Deletes backups older than the retention window from every target; returns how many. */
    private int prune() throws IOException {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        int deleted = 0;
        if (StringUtils.hasText(localDir) && Files.isDirectory(Path.of(localDir))) {
            try (Stream<Path> files = Files.list(Path.of(localDir))) {
                for (Path p : (Iterable<Path>) files::iterator) {
                    if (p.toString().endsWith(".crmbk") && Files.getLastModifiedTime(p).toInstant().isBefore(cutoff)) {
                        Files.deleteIfExists(p);
                        deleted++;
                    }
                }
            }
        }
        if (StringUtils.hasText(bucket)) {
            try (S3Client s3 = client()) {
                for (S3Object o : s3.listObjectsV2Paginator(ListObjectsV2Request.builder()
                        .bucket(bucket).prefix(prefix).build()).contents()) {
                    if (o.key().endsWith(".crmbk") && o.lastModified().isBefore(cutoff)) {
                        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(o.key()).build());
                        deleted++;
                    }
                }
            }
        }
        return deleted;
    }

    private S3Client client() {
        var builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        if (StringUtils.hasText(endpoint)) builder.endpointOverride(URI.create(endpoint));
        return builder.build();
    }

    private byte[] key() {
        if (!StringUtils.hasText(keyBase64)) {
            throw new IllegalStateException("BACKUP_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
        }
        byte[] k = Base64.getDecoder().decode(keyBase64.trim());
        if (k.length != 32) throw new IllegalStateException("BACKUP_ENCRYPTION_KEY must be 32 bytes (base64 of 32 random bytes)");
        return k;
    }

    private static void deleteQuietly(Path dir) {
        if (dir == null) return;
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) {
            // temp dir cleanup is best effort
        }
    }
}

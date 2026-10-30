package com.arudra.crm.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Storage for sensitive uploads — call recordings, kiosk selfies, employee/HR documents, payment
 * proofs, expense bills, customer documents. These are never on the public bucket or under the
 * public /uploads path: they live in a private bucket ({@code app.storage.private.bucket}, same S3/R2
 * credentials as the main storage) or, without one, in a server directory outside /uploads, and are
 * served only through the authenticated {@code /api/files/private/**} endpoint.
 *
 * <p>Key layout: {@code MODULE/yyyy/MM/<uuid>-u<uploaderUserId>-<name>} — the module and uploader
 * drive who may read it (PrivateFileController).
 */
@Component
public class PrivateFileStore {

    public static final Set<String> PRIVATE_MODULES = Set.of(
            "CALL_RECORDING", "KIOSK", "EMPLOYEE_DOC", "HR_DOCUMENT", "PAYMENT", "FINANCE", "CUSTOMER");
    public static final String URL_PREFIX = "/api/files/private/";
    private static final Pattern OWNER = Pattern.compile("^[0-9a-f-]{36}-u(\\d+)-");

    private final String bucket;
    private final Path dir;
    private final String endpoint, region, accessKey, secretKey;
    private volatile S3Client s3;

    public PrivateFileStore(@Value("${app.storage.private.bucket:}") String bucket,
                            @Value("${app.storage.private.dir:./private-uploads}") String dir,
                            @Value("${app.storage.s3.endpoint:}") String endpoint,
                            @Value("${app.storage.s3.region:auto}") String region,
                            @Value("${app.storage.s3.access-key:}") String accessKey,
                            @Value("${app.storage.s3.secret-key:}") String secretKey) {
        this.bucket = bucket;
        this.dir = Path.of(dir).toAbsolutePath().normalize();
        this.endpoint = endpoint;
        this.region = region;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
    }

    public static boolean isPrivateModule(String module) {
        return module != null && PRIVATE_MODULES.contains(module.toUpperCase());
    }

    /** True for a link this store issued. */
    public static boolean isPrivateUrl(String url) {
        return url != null && url.contains(URL_PREFIX);
    }

    public static String keyFromUrl(String url) {
        return url.substring(url.indexOf(URL_PREFIX) + URL_PREFIX.length()).split("[?#]")[0];
    }

    public static String moduleOf(String key) {
        int slash = key.indexOf('/');
        return slash < 0 ? "" : key.substring(0, slash);
    }

    /** The uploader's user id embedded in the key, or null (system uploads, migrated files). */
    public static Long ownerOf(String key) {
        Matcher m = OWNER.matcher(key.substring(key.lastIndexOf('/') + 1));
        return m.find() ? Long.valueOf(m.group(1)) : null;
    }

    public StoredFile store(byte[] bytes, String contentType, String module, String originalFilename, Long ownerUserId)
            throws IOException {
        String name = StorageKeys.cleanOriginalName(originalFilename);
        String key = StorageKeys.safeModule(module.toUpperCase()) + "/"
                + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM")) + "/"
                + UUID.randomUUID() + "-u" + (ownerUserId == null ? 0 : ownerUserId) + "-" + name;
        put(key, bytes, contentType);
        return new StoredFile(URL_PREFIX + key, name);
    }

    /** Writes under an explicit key (used when moving an existing public file here). */
    public void put(String key, byte[] bytes, String contentType) throws IOException {
        if (usesBucket()) {
            client().putObject(PutObjectRequest.builder().bucket(bucket).key(key)
                    .contentType(contentType == null ? "application/octet-stream" : contentType).build(),
                    RequestBody.fromBytes(bytes));
        } else {
            Path target = resolve(key);
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        }
    }

    public byte[] read(String key) throws IOException {
        if (usesBucket()) {
            try {
                return client().getObject(GetObjectRequest.builder().bucket(bucket).key(key).build()).readAllBytes();
            } catch (NoSuchKeyException e) {
                throw new NoSuchFileException(key);
            }
        }
        Path file = resolve(key);
        if (!Files.isRegularFile(file)) throw new NoSuchFileException(key);
        return Files.readAllBytes(file);
    }

    /** Deletes a stored file; a file that is already gone is not an error. */
    public void delete(String key) throws IOException {
        if (usesBucket()) {
            client().deleteObject(software.amazon.awssdk.services.s3.model.DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } else {
            Files.deleteIfExists(resolve(key));
        }
    }

    /** Where local private files live (for backups); null when a bucket is used. */
    public Path localDir() {
        return usesBucket() ? null : dir;
    }

    private boolean usesBucket() {
        return StringUtils.hasText(bucket);
    }

    private Path resolve(String key) throws NoSuchFileException {
        Path file = dir.resolve(key).normalize();
        if (!file.startsWith(dir)) throw new NoSuchFileException(key);
        return file;
    }

    private S3Client client() {
        if (s3 == null) {
            synchronized (this) {
                if (s3 == null) {
                    var b = S3Client.builder()
                            .region(Region.of(region))
                            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
                    if (StringUtils.hasText(endpoint)) b.endpointOverride(URI.create(endpoint));
                    s3 = b.build();
                }
            }
        }
        return s3;
    }
}

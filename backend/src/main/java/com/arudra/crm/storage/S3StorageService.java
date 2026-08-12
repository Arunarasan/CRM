package com.arudra.crm.storage;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;

/**
 * Stores uploads in AWS S3 or Cloudflare R2 (same S3 API). Activated with
 * {@code app.storage.type=s3} or {@code app.storage.type=r2}. Returns an absolute public URL so the frontend links to the
 * object directly (no proxying through the backend). Survives redeploys, unlike local disk.
 */
@Service
@ConditionalOnExpression("'${app.storage.type:local}'.equalsIgnoreCase('s3') || '${app.storage.type:local}'.equalsIgnoreCase('r2')")
@EnableConfigurationProperties(S3StorageProperties.class)
public class S3StorageService implements StorageService {

    private final S3StorageProperties props;
    private S3Client s3;

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
                        .build());
        if (StringUtils.hasText(props.getEndpoint())) {
            builder.endpointOverride(URI.create(props.getEndpoint()));
        }
        this.s3 = builder.build();
    }

    @Override
    public StoredFile store(byte[] bytes, String contentType, String module, String originalFilename) {
        String key = StorageKeys.objectKey(module, originalFilename);
        s3.putObject(PutObjectRequest.builder()
                        .bucket(props.getBucket())
                        .key(key)
                        .contentType(contentType != null ? contentType : "application/octet-stream")
                        .contentLength((long) bytes.length)
                        .build(),
                RequestBody.fromBytes(bytes));

        String base = props.getPublicBaseUrl();
        String fileUrl = StringUtils.hasText(base)
                ? base.replaceAll("/+$", "") + "/" + key
                : "/uploads/" + key; // no public origin configured: fall back to a relative path
        return new StoredFile(fileUrl, StorageKeys.cleanOriginalName(originalFilename));
    }
}

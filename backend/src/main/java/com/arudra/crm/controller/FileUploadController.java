package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.storage.StorageService;
import com.arudra.crm.storage.StoredFile;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

/**
 * Generic multipart upload endpoint. Validates size/type here, then hands the bytes to the
 * active {@link StorageService} (local disk in dev, S3/R2 in prod — selected by
 * {@code app.storage.type}). The response shape is unchanged: {@code { fileUrl, fileName }}.
 */
@RestController
@RequestMapping("/api/uploads")
@CrossOrigin(origins = "*")
public class FileUploadController {

    private static final Set<String> ALLOWED_PREFIXES = Set.of("image/", "video/", "audio/");
    // Documents (PDF / Office / text / archives / CAD) that don't fall under the media prefixes above.
    private static final Set<String> ALLOWED_DOC_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain", "text/csv",
            "application/zip", "application/x-zip-compressed",
            "application/octet-stream" // CAD (.dwg/.dxf) and similar often report this
    );
    // Fallback allow-list by extension for files browsers report with an unhelpful content type.
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "dwg", "dxf",
            "mp3", "m4a", "aac", "amr", "3gp", "3ga", "awb", "wav", "ogg", "opus", "webm", "wma", "flac");
    private static final long MAX_SIZE_BYTES = 25L * 1024 * 1024;

    private static final long MAX_IMAGE_PROXY_BYTES = 10L * 1024 * 1024;

    private final StorageService storageService;
    private final com.arudra.crm.storage.AudioTranscoder audioTranscoder;

    /** Public origin of stored files on S3 / R2 (blank when files are stored on local disk). */
    @org.springframework.beans.factory.annotation.Value("${app.storage.s3.public-base-url:}")
    private String publicBaseUrl;

    /**
     * Extra image hosts the proxy may read from besides {@code publicBaseUrl} — e.g. the R2 bucket the
     * product catalog photos were loaded into directly (those links aren't produced by our uploads).
     */
    @org.springframework.beans.factory.annotation.Value("${app.storage.image-proxy-hosts:pub-a71206d0d22147c19f60595314aec002.r2.dev}")
    private java.util.List<String> imageProxyHosts;

    @org.springframework.beans.factory.annotation.Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    private final java.net.http.HttpClient http = java.net.http.HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(10))
            .followRedirects(java.net.http.HttpClient.Redirect.NEVER)
            .build();

    public FileUploadController(StorageService storageService, com.arudra.crm.storage.AudioTranscoder audioTranscoder) {
        this.storageService = storageService;
        this.audioTranscoder = audioTranscoder;
    }

    /**
     * Hands back one of OUR stored images through the API, for pages that must read the pixels (the
     * quotation PDF draws line photos onto a canvas) — the storage bucket doesn't send CORS headers, so
     * the browser can't read the image directly. Only files from our own storage (the configured public
     * bucket URL, or the local /uploads folder) and only images are served; anything else is refused.
     */
    @GetMapping("/image")
    public ResponseEntity<byte[]> image(@RequestParam String url) throws IOException, InterruptedException {
        String localPrefix = "/uploads/";
        int at = url.indexOf(localPrefix);
        boolean local = url.startsWith(localPrefix)
                || (at > 0 && url.substring(0, at).matches("https?://[^/]+"));
        byte[] bytes;
        String contentType;
        if (isTrustedRemote(url)) {
            java.net.http.HttpResponse<byte[]> res;
            try {
                res = http.send(
                        java.net.http.HttpRequest.newBuilder(java.net.URI.create(url.replace(" ", "%20")))
                                .timeout(java.time.Duration.ofSeconds(20)).GET().build(),
                        java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            } catch (IOException | IllegalArgumentException e) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_GATEWAY).build();
            }
            if (res.statusCode() != 200) return ResponseEntity.notFound().build();
            bytes = res.body();
            contentType = res.headers().firstValue("Content-Type").orElse("");
        } else if (local) {
            String key = url.substring(at < 0 ? 0 : at).substring(localPrefix.length()).split("[?#]")[0];
            java.nio.file.Path root = java.nio.file.Path.of(uploadDir).toAbsolutePath().normalize();
            java.nio.file.Path file = root.resolve(key).normalize();
            if (!file.startsWith(root) || !java.nio.file.Files.isRegularFile(file)) return ResponseEntity.notFound().build();
            bytes = java.nio.file.Files.readAllBytes(file);
            contentType = java.nio.file.Files.probeContentType(file);
        } else {
            return ResponseEntity.badRequest().build();
        }
        if (contentType == null || !contentType.startsWith("image/") || bytes.length > MAX_IMAGE_PROXY_BYTES) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                .cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofHours(1)).cachePrivate())
                .body(bytes);
    }

    /** True for an https/http link on our public storage origin or one of the extra trusted image hosts. */
    private boolean isTrustedRemote(String url) {
        java.net.URI uri;
        try {
            uri = java.net.URI.create(url.replace(" ", "%20"));
        } catch (IllegalArgumentException e) {
            return false;
        }
        String host = uri.getHost();
        if (host == null || !("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))) {
            return false;
        }
        if (StringUtils.hasText(publicBaseUrl)) {
            String base = publicBaseUrl.trim();
            String baseHost = java.net.URI.create(base.contains("://") ? base : "https://" + base).getHost();
            if (host.equalsIgnoreCase(baseHost)) return true;
        }
        return imageProxyHosts.stream().map(String::trim).anyMatch(host::equalsIgnoreCase);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "GENERAL") String module) throws IOException {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("File is empty"));
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            return ResponseEntity.badRequest().body(ApiResponse.error("File exceeds 25MB limit"));
        }
        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename());
        String extension = originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase()
                : "";
        String contentType = file.getContentType();
        boolean allowed = (contentType != null && (ALLOWED_PREFIXES.stream().anyMatch(contentType::startsWith)
                || ALLOWED_DOC_TYPES.contains(contentType)))
                || ALLOWED_EXTENSIONS.contains(extension);
        if (!allowed) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Unsupported file type: " + contentType));
        }

        byte[] bytes = file.getBytes();
        String storedType = contentType;
        String storedName = originalName;
        // Phone call recordings (.amr/.3gp…) and browser webm clips don't play (or show no length) in
        // every browser — store a universal .m4a instead when ffmpeg can convert it.
        if (audioTranscoder.needsTranscode(contentType, originalName)) {
            com.arudra.crm.storage.AudioTranscoder.Result converted = audioTranscoder.toM4a(bytes, originalName);
            if (converted != null) {
                bytes = converted.bytes();
                storedType = converted.contentType();
                storedName = converted.fileName();
            }
        }

        StoredFile stored = storageService.store(bytes, storedType, module, storedName);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "fileUrl", stored.fileUrl(),
                "fileName", stored.fileName()
        )));
    }
}

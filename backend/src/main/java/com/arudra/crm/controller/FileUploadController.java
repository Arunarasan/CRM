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
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "dwg", "dxf");
    private static final long MAX_SIZE_BYTES = 25L * 1024 * 1024;

    private static final long MAX_IMAGE_PROXY_BYTES = 10L * 1024 * 1024;

    private final StorageService storageService;

    /** Public origin of stored files on S3 / R2 (blank when files are stored on local disk). */
    @org.springframework.beans.factory.annotation.Value("${app.storage.s3.public-base-url:}")
    private String publicBaseUrl;

    @org.springframework.beans.factory.annotation.Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    private final java.net.http.HttpClient http = java.net.http.HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(10))
            .followRedirects(java.net.http.HttpClient.Redirect.NEVER)
            .build();

    public FileUploadController(StorageService storageService) {
        this.storageService = storageService;
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
        if (StringUtils.hasText(publicBaseUrl) && url.startsWith(publicBaseUrl.replaceAll("/+$", "") + "/")) {
            java.net.http.HttpResponse<byte[]> res = http.send(
                    java.net.http.HttpRequest.newBuilder(java.net.URI.create(url))
                            .timeout(java.time.Duration.ofSeconds(20)).GET().build(),
                    java.net.http.HttpResponse.BodyHandlers.ofByteArray());
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

        StoredFile stored = storageService.store(file.getBytes(), contentType, module, originalName);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "fileUrl", stored.fileUrl(),
                "fileName", stored.fileName()
        )));
    }
}

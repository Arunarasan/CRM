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

    private final StorageService storageService;

    public FileUploadController(StorageService storageService) {
        this.storageService = storageService;
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

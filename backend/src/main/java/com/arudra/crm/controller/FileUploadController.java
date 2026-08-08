package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Generic multipart upload endpoint. Nothing in this codebase accepted real file uploads before —
 * every other "document"/"attachment" entity was populated by pasting an external URL. This stores
 * to local disk under app.upload.dir and returns a fileUrl served by StaticResourceConfig at /uploads/**.
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

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

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

        String safeModule = module.replaceAll("[^A-Za-z0-9_-]", "_");
        String yearMonth = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String storedName = UUID.randomUUID() + "-" + originalName.replaceAll("[^A-Za-z0-9._-]", "_");

        Path dir = Path.of(uploadDir, safeModule, yearMonth).toAbsolutePath().normalize();
        Files.createDirectories(dir);
        Path target = dir.resolve(storedName);
        file.transferTo(target.toFile());

        String fileUrl = "/uploads/" + safeModule + "/" + yearMonth + "/" + storedName;
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "fileUrl", fileUrl,
                "fileName", originalName
        )));
    }
}

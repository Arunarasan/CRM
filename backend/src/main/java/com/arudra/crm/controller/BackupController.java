package com.arudra.crm.controller;

import com.arudra.crm.service.BackupService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/** Admin-only "download a backup to my own computer". Streams; nothing is stored on the server. */
@Slf4j
@RestController
@RequestMapping("/api/admin/backup")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class BackupController {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");

    private final BackupService backups;

    public BackupController(BackupService backups) {
        this.backups = backups;
    }

    @GetMapping("/info")
    public Map<String, Object> info() throws SQLException {
        return backups.info();
    }

    @GetMapping("/database")
    public ResponseEntity<StreamingResponseBody> database(Authentication auth) {
        String file = "arudra-crm-db-" + LocalDateTime.now().format(STAMP) + ".sql.gz";
        log.info("Database backup downloaded by {}", auth == null ? "?" : auth.getName());
        StreamingResponseBody body = out -> {
            try {
                backups.writeDatabaseDump(out);
            } catch (SQLException e) {
                log.error("Database backup failed", e);
                throw new java.io.IOException("Database backup failed", e);
            }
        };
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.parseMediaType("application/gzip"))
                .body(body);
    }

    @GetMapping("/files")
    public ResponseEntity<StreamingResponseBody> files(Authentication auth) {
        String file = "arudra-crm-files-" + LocalDateTime.now().format(STAMP) + ".zip";
        log.info("Uploads backup downloaded by {}", auth == null ? "?" : auth.getName());
        StreamingResponseBody body = backups::writeFilesZip;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(body);
    }
}

package com.arudra.crm.controller;

import com.arudra.crm.service.BackupService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * Admin-only "download a backup to my own computer". Streams; nothing is stored on the server.
 *
 * A plain browser download cannot send the login header, and holding a multi-GB file in the page's memory
 * would crash it. So the admin first asks for a short-lived single-use ticket (this class, admin only), then
 * the browser downloads {@code /api/admin/backup/download/{kind}?ticket=...} natively, straight to disk.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/backup")
public class BackupController {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");

    private final BackupService backups;
    private final com.arudra.crm.service.OffsiteBackupService offsite;
    @org.springframework.beans.factory.annotation.Autowired
    private com.arudra.crm.service.PrivateFileMigrationService privateFileMigration;

    public BackupController(BackupService backups, com.arudra.crm.service.OffsiteBackupService offsite) {
        this.offsite = offsite;
        this.backups = backups;
    }

    @GetMapping("/info")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public Map<String, Object> info() throws SQLException {
        return backups.info();
    }

    /** Last nightly encrypted off-site backup (status, file names, sizes). */
    @GetMapping("/offsite")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> offsiteStatus() {
        return ResponseEntity.ok(offsite.status());
    }

    /** Runs the encrypted off-site backup now (also how to test the setup). */
    @PostMapping("/offsite/run")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> offsiteRunNow() {
        if (!Boolean.TRUE.equals(offsite.status().get("enabled"))) {
            return ResponseEntity.badRequest().body(java.util.Map.of("success", false,
                    "message", "Off-site backup is not configured (BACKUP_ENABLED)."));
        }
        return ResponseEntity.ok(offsite.runNow());
    }

    /**
     * One-time move of sensitive files uploaded before private storage existed (call recordings,
     * kiosk selfies, employee/HR documents, payment proofs…) off the public bucket. Safe to re-run.
     */
    @PostMapping("/make-files-private")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> makeFilesPrivate() {
        return ResponseEntity.ok(privateFileMigration.run());
    }

    @PostMapping("/ticket")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public Map<String, String> ticket(@RequestParam String kind, Authentication auth) {
        if (!kind.equals("database") && !kind.equals("files")) {
            throw new IllegalArgumentException("kind must be database or files");
        }
        log.info("Backup '{}' requested by {}", kind, auth == null ? "?" : auth.getName());
        return Map.of("ticket", backups.issueTicket(kind));
    }

    /** Authorised by the single-use ticket, not by login (see class comment); permitted in SecurityConfig. */
    @GetMapping("/download/{kind}")
    public ResponseEntity<?> download(@PathVariable String kind, @RequestParam(required = false) String ticket) {
        if (!backups.redeemTicket(ticket, kind)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("This download link has expired. Go back and click the button again.");
        }
        String stamp = LocalDateTime.now().format(STAMP);
        if (kind.equals("database")) {
            StreamingResponseBody body = out -> {
                try {
                    backups.writeDatabaseDump(out);
                } catch (SQLException e) {
                    log.error("Database backup failed", e);
                    throw new java.io.IOException("Database backup failed", e);
                }
            };
            return stream("arudra-crm-db-" + stamp + ".sql.gz", "application/gzip", body);
        }
        return stream("arudra-crm-files-" + stamp + ".zip", "application/zip", backups::writeFilesZip);
    }

    private static ResponseEntity<StreamingResponseBody> stream(String file, String type, StreamingResponseBody body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.parseMediaType(type))
                .body(body);
    }
}

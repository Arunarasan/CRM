package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.website.SiteContentDto.*;
import com.arudra.crm.service.WebsiteContentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRM-side management of site settings + page content. Same {@code /api/website} surface and
 * WEBSITE_READ / WEBSITE_WRITE gating as the rest of the CMS. Writes land in the same tables the
 * public {@code /api/public/settings} + {@code /api/public/content/{page}} read, so edits are live
 * on the site on its next fetch.
 */
@RestController
@RequestMapping("/api/website")
public class WebsiteContentController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_WRITE')";

    private final WebsiteContentService svc;

    public WebsiteContentController(WebsiteContentService svc) {
        this.svc = svc;
    }

    // ---- Settings ----
    @GetMapping("/settings") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<SettingDto>>> settings() {
        return ResponseEntity.ok(ApiResponse.success(svc.listSettings()));
    }

    @PutMapping("/settings") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<List<SettingDto>>> saveSettings(@RequestBody SettingsSaveRequest body) {
        return ResponseEntity.ok(ApiResponse.success(svc.saveSettings(body.settings()), "Settings saved."));
    }

    // ---- Content blocks ----
    @GetMapping("/content") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ContentBlockDto>>> content() {
        return ResponseEntity.ok(ApiResponse.success(svc.listContent()));
    }

    @PostMapping("/content") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ContentBlockDto>> create(@RequestBody ContentBlockDto d) {
        return ResponseEntity.ok(ApiResponse.success(svc.createContent(d), "Content block created."));
    }

    @PutMapping("/content/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ContentBlockDto>> update(@PathVariable Long id, @RequestBody ContentBlockDto d) {
        return ResponseEntity.ok(ApiResponse.success(svc.updateContent(id, d), "Content block updated."));
    }

    @DeleteMapping("/content/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        svc.deleteContent(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Content block removed."));
    }

    @PatchMapping("/content/{id}/toggle") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ContentBlockDto>> toggle(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(svc.toggleContent(id)));
    }
}

package com.arudra.crm.controller;

import com.arudra.crm.service.KioskService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** HR management of office kiosks (register, rename, switch off, re-pair, remove). */
@RestController
@RequestMapping("/api/hr/attendance/kiosks")
@CrossOrigin(origins = "*")
public class KioskAdminController {

    private static final String HR_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    private final KioskService kioskService;

    public KioskAdminController(KioskService kioskService) {
        this.kioskService = kioskService;
    }

    @GetMapping
    @PreAuthorize(HR_READ)
    public ResponseEntity<List<Map<String, Object>>> list() {
        return ResponseEntity.ok(kioskService.list());
    }

    @PostMapping
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(kioskService.create(str(body.get("name")), num(body.get("officeLocationId"))));
    }

    @PutMapping("/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Boolean active = body.get("active") == null ? null : Boolean.valueOf(String.valueOf(body.get("active")));
        return ResponseEntity.ok(kioskService.update(id, str(body.get("name")), num(body.get("officeLocationId")), active));
    }

    @PostMapping("/{id}/repair")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Map<String, Object>> repair(@PathVariable Long id) {
        return ResponseEntity.ok(kioskService.repair(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        kioskService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Long num(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : Long.valueOf(String.valueOf(o));
    }
}

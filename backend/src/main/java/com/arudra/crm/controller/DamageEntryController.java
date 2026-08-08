package com.arudra.crm.controller;

import com.arudra.crm.entity.DamageEntry;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.DamageEntryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory/damage-entries")
@CrossOrigin(origins = "*")
public class DamageEntryController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('DAMAGE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('DAMAGE_WRITE')";

    private final DamageEntryService damageEntryService;
    private final CurrentUserService currentUserService;

    public DamageEntryController(DamageEntryService damageEntryService, CurrentUserService currentUserService) {
        this.damageEntryService = damageEntryService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<List<DamageEntry>> getAll() {
        return ResponseEntity.ok(damageEntryService.getAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<DamageEntry> get(@PathVariable Long id) {
        return ResponseEntity.ok(damageEntryService.get(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<DamageEntry> report(@RequestBody Map<String, Object> request) {
        Long productId = Long.valueOf(String.valueOf(request.get("productId")));
        Long warehouseId = Long.valueOf(String.valueOf(request.get("warehouseId")));
        int quantity = Integer.parseInt(String.valueOf(request.get("quantity")));
        String reason = (String) request.get("reason");
        String photoUrl = (String) request.get("photoUrl");
        Long responsiblePersonId = request.get("responsiblePersonId") != null
                ? Long.valueOf(String.valueOf(request.get("responsiblePersonId"))) : null;
        return ResponseEntity.ok(damageEntryService.report(
                productId, warehouseId, quantity, reason, photoUrl, responsiblePersonId, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/write-off")
    @PreAuthorize(WRITE)
    public ResponseEntity<DamageEntry> writeOff(@PathVariable Long id) {
        return ResponseEntity.ok(damageEntryService.writeOff(id));
    }
}

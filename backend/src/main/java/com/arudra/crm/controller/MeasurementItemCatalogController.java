package com.arudra.crm.controller;

import com.arudra.crm.entity.MeasurementItemCatalog;
import com.arudra.crm.service.MeasurementItemCatalogService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Measurement item catalog. Listing is open to anyone who can read measurements (the employee
 * measurement picker uses it); managing entries is admin-only — "admin adds the items, employee uses
 * the same items".
 */
@RestController
@RequestMapping("/api/measurement-item-catalog")
@CrossOrigin(origins = "*")
public class MeasurementItemCatalogController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('MEASUREMENT_READ')";
    private static final String MANAGE = "hasAuthority('ROLE_ADMIN')";

    private final MeasurementItemCatalogService service;

    public MeasurementItemCatalogController(MeasurementItemCatalogService service) {
        this.service = service;
    }

    /** Active catalog items — for the employee measurement picker. */
    @GetMapping
    @PreAuthorize(READ)
    public List<MeasurementItemCatalog> listActive() {
        return service.listActive();
    }

    /** All catalog items (incl. inactive) — for the admin management page. */
    @GetMapping("/all")
    @PreAuthorize(MANAGE)
    public List<MeasurementItemCatalog> listAll() {
        return service.listAll();
    }

    @PostMapping
    @PreAuthorize(MANAGE)
    public MeasurementItemCatalog create(@RequestBody MeasurementItemCatalog item) {
        return service.create(item);
    }

    @PutMapping("/{id}")
    @PreAuthorize(MANAGE)
    public MeasurementItemCatalog update(@PathVariable Long id, @RequestBody MeasurementItemCatalog item) {
        return service.update(id, item);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(MANAGE)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}

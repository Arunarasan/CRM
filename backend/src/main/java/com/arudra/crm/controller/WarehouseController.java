package com.arudra.crm.controller;

import com.arudra.crm.entity.Warehouse;
import com.arudra.crm.service.WarehouseService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory/warehouses")
@CrossOrigin(origins = "*")
public class WarehouseController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WAREHOUSE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WAREHOUSE_WRITE')";

    private final WarehouseService warehouseService;

    public WarehouseController(WarehouseService warehouseService) {
        this.warehouseService = warehouseService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<List<Warehouse>> getAll() {
        return ResponseEntity.ok(warehouseService.getAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Warehouse> get(@PathVariable Long id) {
        return ResponseEntity.ok(warehouseService.get(id));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<Warehouse> create(@RequestBody Warehouse warehouse) {
        return ResponseEntity.ok(warehouseService.create(warehouse));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Warehouse> update(@PathVariable Long id, @RequestBody Warehouse warehouse) {
        return ResponseEntity.ok(warehouseService.update(id, warehouse));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        warehouseService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/stock-summary")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getStockSummary(@PathVariable Long id) {
        return ResponseEntity.ok(warehouseService.getStockSummary(id));
    }
}

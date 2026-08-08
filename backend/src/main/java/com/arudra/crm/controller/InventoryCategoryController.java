package com.arudra.crm.controller;

import com.arudra.crm.entity.InventoryCategory;
import com.arudra.crm.service.InventoryCategoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory/categories")
@CrossOrigin(origins = "*")
public class InventoryCategoryController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_WRITE')";

    private final InventoryCategoryService categoryService;

    public InventoryCategoryController(InventoryCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<List<InventoryCategory>> getAll() {
        return ResponseEntity.ok(categoryService.getAll());
    }

    @GetMapping("/roots")
    @PreAuthorize(READ)
    public ResponseEntity<List<InventoryCategory>> getRootCategories() {
        return ResponseEntity.ok(categoryService.getRootCategories());
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<InventoryCategory> create(@RequestBody InventoryCategory category) {
        return ResponseEntity.ok(categoryService.create(category));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<InventoryCategory> update(@PathVariable Long id, @RequestBody InventoryCategory category) {
        return ResponseEntity.ok(categoryService.update(id, category));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

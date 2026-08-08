package com.arudra.crm.controller;

import com.arudra.crm.entity.*;
import com.arudra.crm.service.InventoryService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@CrossOrigin(origins = "*")
public class InventoryController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_WRITE')";

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping("/products")
    @PreAuthorize(READ)
    public ResponseEntity<Page<Product>> getProducts(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(inventoryService.getProducts(search, page, size));
    }

    @PostMapping("/products")
    @PreAuthorize(WRITE)
    public ResponseEntity<Product> createProduct(@RequestBody Product product) {
        return ResponseEntity.ok(inventoryService.createProduct(product));
    }

    @GetMapping("/products/{id}/availability")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getAvailability(@PathVariable Long id) {
        return ResponseEntity.ok(inventoryService.getAvailability(id));
    }

    @PutMapping("/products/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Product> updateProduct(@PathVariable Long id, @RequestBody Product product) {
        return ResponseEntity.ok(inventoryService.updateProduct(id, product));
    }

    @PostMapping("/products/{id}/deactivate")
    @PreAuthorize(WRITE)
    public ResponseEntity<Product> deactivateProduct(@PathVariable Long id) {
        return ResponseEntity.ok(inventoryService.deactivateProduct(id));
    }

    @GetMapping("/products/barcode/{code}")
    @PreAuthorize(READ)
    public ResponseEntity<Product> findByBarcode(@PathVariable String code) {
        return ResponseEntity.ok(inventoryService.findByBarcode(code));
    }

    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getDashboard() {
        return ResponseEntity.ok(inventoryService.getDashboard());
    }

    // Warehouse and category listing moved to WarehouseController/InventoryCategoryController
    // (which now also handle CRUD) to avoid duplicate route mappings on the same paths.

    @GetMapping("/stock")
    @PreAuthorize(READ)
    public ResponseEntity<List<InventoryItem>> getAllStock() {
        return ResponseEntity.ok(inventoryService.getAllStock());
    }

    @GetMapping("/alerts/low-stock")
    @PreAuthorize(READ)
    public ResponseEntity<List<InventoryItem>> getLowStockAlerts() {
        return ResponseEntity.ok(inventoryService.getLowStockAlerts());
    }

    @GetMapping("/transactions")
    @PreAuthorize(READ)
    public ResponseEntity<List<InventoryTransaction>> getRecentTransactions() {
        return ResponseEntity.ok(inventoryService.getRecentTransactions());
    }

    @PostMapping("/transactions")
    @PreAuthorize(WRITE)
    public ResponseEntity<InventoryTransaction> processTransaction(@RequestBody InventoryTransaction transaction) {
        return ResponseEntity.ok(inventoryService.processTransaction(transaction));
    }
}

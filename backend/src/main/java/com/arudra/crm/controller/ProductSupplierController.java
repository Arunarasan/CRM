package com.arudra.crm.controller;

import com.arudra.crm.entity.ProductSupplier;
import com.arudra.crm.service.ProductSupplierService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory/products/{productId}/suppliers")
@CrossOrigin(origins = "*")
public class ProductSupplierController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_WRITE')";

    private final ProductSupplierService productSupplierService;

    public ProductSupplierController(ProductSupplierService productSupplierService) {
        this.productSupplierService = productSupplierService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<List<ProductSupplier>> getForProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(productSupplierService.getForProduct(productId));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<ProductSupplier> add(@PathVariable Long productId,
                                                @RequestParam Long supplierId,
                                                @RequestBody ProductSupplier details) {
        return ResponseEntity.ok(productSupplierService.add(productId, supplierId, details));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ProductSupplier> update(@PathVariable Long productId, @PathVariable Long id,
                                                   @RequestBody ProductSupplier details) {
        return ResponseEntity.ok(productSupplierService.update(id, details));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Void> delete(@PathVariable Long productId, @PathVariable Long id) {
        productSupplierService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

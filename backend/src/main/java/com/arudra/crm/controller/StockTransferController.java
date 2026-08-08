package com.arudra.crm.controller;

import com.arudra.crm.entity.StockTransfer;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.StockTransferService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory/transfers")
@CrossOrigin(origins = "*")
public class StockTransferController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('STOCK_TRANSFER_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('STOCK_TRANSFER_WRITE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('STOCK_TRANSFER_APPROVE')";

    private final StockTransferService stockTransferService;
    private final CurrentUserService currentUserService;

    public StockTransferController(StockTransferService stockTransferService, CurrentUserService currentUserService) {
        this.stockTransferService = stockTransferService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<List<StockTransfer>> getAll(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(status != null ? stockTransferService.getByStatus(status) : stockTransferService.getAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<StockTransfer> get(@PathVariable Long id) {
        return ResponseEntity.ok(stockTransferService.get(id));
    }

    @SuppressWarnings("unchecked")
    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<StockTransfer> create(@RequestBody Map<String, Object> request) {
        Long sourceWarehouseId = Long.valueOf(String.valueOf(request.get("sourceWarehouseId")));
        Long destinationWarehouseId = Long.valueOf(String.valueOf(request.get("destinationWarehouseId")));
        List<Map<String, Object>> items = (List<Map<String, Object>>) request.get("items");
        String notes = (String) request.get("notes");
        return ResponseEntity.ok(stockTransferService.create(
                sourceWarehouseId, destinationWarehouseId, items, notes, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<StockTransfer> approve(@PathVariable Long id) {
        return ResponseEntity.ok(stockTransferService.approve(id, currentUserService.getCurrentUser()));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(APPROVE)
    public ResponseEntity<StockTransfer> reject(@PathVariable Long id) {
        return ResponseEntity.ok(stockTransferService.reject(id));
    }

    @PostMapping("/{id}/in-transit")
    @PreAuthorize(WRITE)
    public ResponseEntity<StockTransfer> markInTransit(@PathVariable Long id) {
        return ResponseEntity.ok(stockTransferService.markInTransit(id));
    }

    @PostMapping("/{id}/receive")
    @PreAuthorize(WRITE)
    public ResponseEntity<StockTransfer> receive(@PathVariable Long id) {
        return ResponseEntity.ok(stockTransferService.receive(id));
    }
}

package com.arudra.crm.controller;

import com.arudra.crm.entity.InventoryTransaction;
import com.arudra.crm.service.InventoryReportService;
import com.arudra.crm.service.PurchaseReportService;
import com.arudra.crm.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "*")
public class ReportController {

    private static final String INVENTORY_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('INVENTORY_READ')";
    private static final String PURCHASE_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('PURCHASE_READ')";

    @Autowired
    private ReportService reportService;

    @Autowired
    private InventoryReportService inventoryReportService;

    @Autowired
    private PurchaseReportService purchaseReportService;

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardMetrics(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : LocalDate.now().withDayOfMonth(1);
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
        
        return ResponseEntity.ok(reportService.getDashboardMetrics(start, end));
    }

    @GetMapping("/sales-chart")
    public ResponseEntity<List<Map<String, Object>>> getSalesChartData(
            @RequestParam(required = false) Integer year) {
        int targetYear = year != null ? year : LocalDate.now().getYear();
        return ResponseEntity.ok(reportService.getSalesChartData(targetYear));
    }

    @GetMapping("/lead-conversion")
    public ResponseEntity<Map<String, Long>> getLeadConversionStats() {
        return ResponseEntity.ok(reportService.getLeadConversionStats());
    }

    // --- Inventory & Materials reports ---

    @GetMapping("/inventory/summary")
    @PreAuthorize(INVENTORY_READ)
    public ResponseEntity<Map<String, Object>> getInventorySummary() {
        return ResponseEntity.ok(inventoryReportService.inventorySummary());
    }

    @GetMapping("/inventory/valuation")
    @PreAuthorize(INVENTORY_READ)
    public ResponseEntity<List<Map<String, Object>>> getStockValuation() {
        return ResponseEntity.ok(inventoryReportService.stockValuation());
    }

    @GetMapping("/inventory/low-stock")
    @PreAuthorize(INVENTORY_READ)
    public ResponseEntity<List<Map<String, Object>>> getLowStockReport() {
        return ResponseEntity.ok(inventoryReportService.lowStockReport());
    }

    @GetMapping("/inventory/movement")
    @PreAuthorize(INVENTORY_READ)
    public ResponseEntity<List<InventoryTransaction>> getMaterialMovement(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        LocalDateTime fromDate = from != null ? LocalDateTime.parse(from) : null;
        LocalDateTime toDate = to != null ? LocalDateTime.parse(to) : null;
        return ResponseEntity.ok(inventoryReportService.materialMovement(fromDate, toDate));
    }

    @GetMapping("/project-material-cost/{projectId}")
    @PreAuthorize(INVENTORY_READ)
    public ResponseEntity<Map<String, Object>> getProjectMaterialCost(@PathVariable Long projectId) {
        return ResponseEntity.ok(inventoryReportService.projectMaterialCost(projectId));
    }

    // --- Purchase / procurement reports ---

    @GetMapping("/purchases/summary")
    @PreAuthorize(PURCHASE_READ)
    public ResponseEntity<Map<String, Object>> getPurchaseSummary(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return ResponseEntity.ok(purchaseReportService.purchaseSummary(
                from != null ? LocalDate.parse(from) : null,
                to != null ? LocalDate.parse(to) : null));
    }

    @GetMapping("/purchases/supplier-performance")
    @PreAuthorize(PURCHASE_READ)
    public ResponseEntity<List<Map<String, Object>>> getSupplierPerformance() {
        return ResponseEntity.ok(purchaseReportService.supplierPerformance());
    }

    @GetMapping("/purchases/pending-deliveries")
    @PreAuthorize(PURCHASE_READ)
    public ResponseEntity<List<Map<String, Object>>> getPendingDeliveries() {
        return ResponseEntity.ok(purchaseReportService.pendingDeliveries());
    }

    @GetMapping("/purchases/outstanding-payments")
    @PreAuthorize(PURCHASE_READ)
    public ResponseEntity<List<Map<String, Object>>> getOutstandingPayments() {
        return ResponseEntity.ok(purchaseReportService.outstandingPayments());
    }

    @GetMapping("/purchases/trends")
    @PreAuthorize(PURCHASE_READ)
    public ResponseEntity<List<Map<String, Object>>> getPurchaseTrends() {
        return ResponseEntity.ok(purchaseReportService.purchaseTrends());
    }

    @GetMapping("/purchases/material-cost")
    @PreAuthorize(PURCHASE_READ)
    public ResponseEntity<List<Map<String, Object>>> getMaterialCostAnalysis() {
        return ResponseEntity.ok(purchaseReportService.materialCostAnalysis());
    }

    @GetMapping("/purchases/project/{projectId}")
    @PreAuthorize(PURCHASE_READ)
    public ResponseEntity<Map<String, Object>> getProjectPurchaseReport(@PathVariable Long projectId) {
        return ResponseEntity.ok(purchaseReportService.projectPurchaseReport(projectId));
    }
}

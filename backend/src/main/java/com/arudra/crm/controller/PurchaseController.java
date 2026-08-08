package com.arudra.crm.controller;

import com.arudra.crm.entity.*;
import com.arudra.crm.service.PurchaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/purchases")
@CrossOrigin(origins = "*")
public class PurchaseController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('PURCHASE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PURCHASE_WRITE')";
    private static final String APPROVE = "hasAuthority('ROLE_ADMIN') or hasAuthority('PURCHASE_APPROVE')";

    @Autowired
    private PurchaseService purchaseService;

    // --- Dashboard ---
    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getDashboard() {
        return ResponseEntity.ok(purchaseService.getDashboard());
    }

    // --- Suppliers ---
    @GetMapping("/suppliers")
    @PreAuthorize(READ)
    public ResponseEntity<List<Supplier>> getSuppliers(@RequestParam(required = false) String search) {
        return ResponseEntity.ok(purchaseService.searchSuppliers(search));
    }

    @GetMapping("/suppliers/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<Supplier> getSupplier(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getSupplier(id));
    }

    @GetMapping("/suppliers/{id}/profile")
    @PreAuthorize(READ)
    public ResponseEntity<Map<String, Object>> getSupplierProfile(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getSupplierProfile(id));
    }

    @PostMapping("/suppliers")
    @PreAuthorize(WRITE)
    public ResponseEntity<Supplier> createSupplier(@RequestBody Supplier supplier) {
        return ResponseEntity.ok(purchaseService.createSupplier(supplier));
    }

    @PutMapping("/suppliers/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<Supplier> updateSupplier(@PathVariable Long id, @RequestBody Supplier supplier) {
        return ResponseEntity.ok(purchaseService.updateSupplier(id, supplier));
    }

    // --- Price comparison ---
    @GetMapping("/price-comparison/{productId}")
    @PreAuthorize(READ)
    public ResponseEntity<List<Map<String, Object>>> comparePrices(@PathVariable Long productId) {
        return ResponseEntity.ok(purchaseService.comparePrices(productId));
    }

    // --- Purchase Orders ---
    @GetMapping("/orders")
    @PreAuthorize(READ)
    public ResponseEntity<Page<PurchaseOrder>> getPurchaseOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String search) {
        boolean filtered = status != null || supplierId != null || projectId != null || warehouseId != null
                || from != null || to != null || (search != null && !search.isBlank());
        if (!filtered) {
            return ResponseEntity.ok(purchaseService.getPurchaseOrders(page, size));
        }
        return ResponseEntity.ok(purchaseService.searchPurchaseOrders(status, supplierId, projectId, warehouseId,
                from != null ? LocalDate.parse(from) : null,
                to != null ? LocalDate.parse(to) : null,
                search, page, size));
    }

    @GetMapping("/orders/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<PurchaseOrder> getPurchaseOrder(@PathVariable Long id) {
        return purchaseService.getPurchaseOrder(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/orders/{id}/items")
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchaseOrderItem>> getPurchaseOrderItems(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getPurchaseOrderItems(id));
    }

    @PostMapping("/orders/{id}/status")
    @PreAuthorize(WRITE)
    public ResponseEntity<PurchaseOrder> updateOrderStatus(@PathVariable Long id, @RequestParam String status) {
        return ResponseEntity.ok(purchaseService.updatePurchaseOrderStatus(id, status));
    }

    // DTO for creating/updating PO with Items
    public static class CreatePoRequest {
        public PurchaseOrder po;
        public List<PurchaseOrderItem> items;
    }

    @PostMapping("/orders")
    @PreAuthorize(WRITE)
    public ResponseEntity<PurchaseOrder> createPurchaseOrder(@RequestBody CreatePoRequest request) {
        return ResponseEntity.ok(purchaseService.createPurchaseOrder(request.po, request.items));
    }

    @PutMapping("/orders/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<PurchaseOrder> updatePurchaseOrder(@PathVariable Long id, @RequestBody CreatePoRequest request) {
        return ResponseEntity.ok(purchaseService.updatePurchaseOrder(id, request.po, request.items));
    }

    // --- GRN ---
    @GetMapping("/grns")
    @PreAuthorize(READ)
    public ResponseEntity<List<GoodsReceiptNote>> getAllGrns() {
        return ResponseEntity.ok(purchaseService.getAllGrns());
    }

    @GetMapping("/orders/{id}/grns")
    @PreAuthorize(READ)
    public ResponseEntity<List<GoodsReceiptNote>> getGrnsForPo(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getGrnsForPo(id));
    }

    @GetMapping("/grns/{id}/items")
    @PreAuthorize(READ)
    public ResponseEntity<List<GoodsReceiptNoteItem>> getGrnItems(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getGrnItems(id));
    }

    @GetMapping("/grns/{id}/photos")
    @PreAuthorize(READ)
    public ResponseEntity<List<GrnPhoto>> getGrnPhotos(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getGrnPhotos(id));
    }

    // DTO for GRN
    public static class CreateGrnRequest {
        public GoodsReceiptNote grn;
        public List<GoodsReceiptNoteItem> items;
        public List<String> photoUrls;
    }

    @PostMapping("/grns")
    @PreAuthorize(WRITE)
    public ResponseEntity<GoodsReceiptNote> createGrn(@RequestBody CreateGrnRequest request) {
        return ResponseEntity.ok(purchaseService.createGrn(request.grn, request.items, request.photoUrls));
    }

    public static class QcRequest {
        public String qcStatus;
        public String reason;
        public String remarks;
    }

    @PostMapping("/grns/{id}/quality-check")
    @PreAuthorize(WRITE)
    public ResponseEntity<GoodsReceiptNote> recordQualityCheck(@PathVariable Long id, @RequestBody QcRequest request) {
        return ResponseEntity.ok(purchaseService.recordQualityCheck(id, request.qcStatus, request.reason, request.remarks));
    }

    @PostMapping("/grns/{id}/approve")
    @PreAuthorize(APPROVE)
    public ResponseEntity<GoodsReceiptNote> approveGrn(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.approveGrn(id));
    }

    // --- Bills & Payments ---
    @GetMapping("/bills")
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchaseBill>> getAllBills() {
        return ResponseEntity.ok(purchaseService.getAllBills());
    }

    @GetMapping("/orders/{id}/bills")
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchaseBill>> getBillsForPo(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getBillsForPo(id));
    }

    @PostMapping("/bills")
    @PreAuthorize(WRITE)
    public ResponseEntity<PurchaseBill> createBill(@RequestBody PurchaseBill bill) {
        return ResponseEntity.ok(purchaseService.createBill(bill));
    }

    @GetMapping("/payments")
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchasePayment>> getAllPayments() {
        return ResponseEntity.ok(purchaseService.getAllPayments());
    }

    @GetMapping("/bills/{id}/payments")
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchasePayment>> getPaymentsForBill(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getPaymentsForBill(id));
    }

    @PostMapping("/payments")
    @PreAuthorize(WRITE)
    public ResponseEntity<PurchasePayment> addPayment(@RequestBody PurchasePayment payment) {
        return ResponseEntity.ok(purchaseService.addPayment(payment));
    }

    // --- Purchase Returns ---
    @GetMapping("/returns")
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchaseReturn>> getAllReturns() {
        return ResponseEntity.ok(purchaseService.getAllReturns());
    }

    @GetMapping("/returns/{id}/items")
    @PreAuthorize(READ)
    public ResponseEntity<List<PurchaseReturnItem>> getReturnItems(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.getReturnItems(id));
    }

    public static class CreateReturnRequest {
        public PurchaseReturn purchaseReturn;
        public List<PurchaseReturnItem> items;
    }

    @PostMapping("/returns")
    @PreAuthorize(WRITE)
    public ResponseEntity<PurchaseReturn> createReturn(@RequestBody CreateReturnRequest request) {
        return ResponseEntity.ok(purchaseService.createReturn(request.purchaseReturn, request.items));
    }

    @PostMapping("/returns/{id}/confirm")
    @PreAuthorize(APPROVE)
    public ResponseEntity<PurchaseReturn> confirmReturn(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseService.confirmReturn(id));
    }
}

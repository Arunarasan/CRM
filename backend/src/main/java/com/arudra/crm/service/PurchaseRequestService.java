package com.arudra.crm.service;

import com.arudra.crm.dto.CreatePrItem;
import com.arudra.crm.dto.CreatePrPayload;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import com.arudra.crm.security.CurrentUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Purchase Request lifecycle.
 *
 * Two entry points create PRs:
 * 1) The scheduled low-stock scan (legacy, single product+warehouse per PR, SYSTEM triggered).
 * 2) Manual multi-line requests from managers/site engineers/store keepers, optionally linked
 *    to a Project/BOQ, with a multi-level approval chain that must fully approve before the
 *    PR can be converted into purchase orders (one PO per supplier).
 */
@Service
public class PurchaseRequestService {

    @Autowired private PurchaseRequestRepository purchaseRequestRepository;
    @Autowired private PurchaseRequestItemRepository purchaseRequestItemRepository;
    @Autowired private PurchaseRequestApprovalRepository approvalRepository;
    @Autowired private InventoryItemRepository itemRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private BoqRepository boqRepository;
    @Autowired private WarehouseRepository warehouseRepository;
    @Autowired private ProductSupplierService productSupplierService;
    @Autowired private ProductSupplierRepository productSupplierRepository;
    @Autowired private PurchaseOrderRepository purchaseOrderRepository;
    @Autowired private PurchaseOrderItemRepository purchaseOrderItemRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private UserRepository userRepository;
    @Autowired private CurrentUserService currentUserService;
    @Autowired private PurchaseService purchaseService;

    public List<PurchaseRequest> getAll() {
        return purchaseRequestRepository.findAllByOrderByIdDesc();
    }

    public List<PurchaseRequest> getByStatus(String status) {
        return purchaseRequestRepository.findByStatusOrderByIdDesc(status);
    }

    public List<PurchaseRequest> getMine() {
        User user = currentUserService.getCurrentUser();
        if (user == null) return List.of();
        return purchaseRequestRepository.findByRequestedByIdOrderByIdDesc(user.getId());
    }

    public PurchaseRequest get(Long id) {
        return purchaseRequestRepository.findById(id).orElseThrow();
    }

    // =====================================================================
    // Manual purchase requests
    // =====================================================================

    @Transactional
    public PurchaseRequest createManual(CreatePrPayload payload) {
        if (payload.items == null || payload.items.isEmpty()) {
            throw new IllegalArgumentException("A purchase request needs at least one item");
        }
        PurchaseRequest request = new PurchaseRequest();
        request.setRequestNumber(nextPrNumber());
        request.setStatus("PENDING");
        request.setTriggeredBy("MANUAL");
        request.setSource(payload.source != null ? payload.source : "INVENTORY");
        request.setPriority(payload.priority != null ? payload.priority : "MEDIUM");
        request.setReason(payload.reason);
        if (payload.requiredDate != null && !payload.requiredDate.isBlank()) {
            request.setRequiredDate(java.time.LocalDate.parse(payload.requiredDate));
        }
        if (payload.projectId != null) {
            request.setProject(projectRepository.findById(payload.projectId).orElseThrow());
        }
        if (payload.boqId != null) {
            request.setBoq(boqRepository.findById(payload.boqId).orElseThrow());
        }
        if (payload.warehouseId != null) {
            request.setWarehouse(warehouseRepository.findById(payload.warehouseId).orElseThrow());
        }
        request.setRequestedBy(currentUserService.getCurrentUser());

        int levels = payload.approvalLevels != null && payload.approvalLevels > 0 ? payload.approvalLevels : 1;
        request.setApprovalLevels(levels);
        request.setCurrentLevel(0);

        for (CreatePrItem line : payload.items) {
            PurchaseRequestItem item = new PurchaseRequestItem();
            item.setPurchaseRequest(request);
            item.setProduct(productRepository.findById(line.productId).orElseThrow());
            item.setQuantity(line.quantity);
            item.setEstimatedUnitPrice(line.estimatedUnitPrice);
            item.setNotes(line.notes);
            request.getItems().add(item);
        }
        for (int level = 1; level <= levels; level++) {
            PurchaseRequestApproval approval = new PurchaseRequestApproval();
            approval.setPurchaseRequest(request);
            approval.setLevel(level);
            approval.setStatus("PENDING");
            request.getApprovals().add(approval);
        }
        PurchaseRequest saved = purchaseRequestRepository.save(request);

        purchaseService.notifyRoles("Approval Required: Purchase Request",
                saved.getRequestNumber() + " raised" + (saved.getProject() != null
                        ? " for project " + saved.getProject().getId() : "") + " — level 1 approval pending",
                "PURCHASE_REQUEST", "/purchases/requests");
        return saved;
    }

    /** Approves the next pending level; the final level flips the PR to APPROVED. */
    @Transactional
    public PurchaseRequest approve(Long id, String comments) {
        PurchaseRequest request = get(id);
        if (!"PENDING".equals(request.getStatus())) {
            throw new IllegalStateException("Only a PENDING purchase request can be approved");
        }
        User user = currentUserService.getCurrentUser();

        PurchaseRequestApproval approval = approvalRepository
                .findFirstByPurchaseRequestIdAndStatusOrderByLevelAsc(id, "PENDING")
                .orElse(null);
        if (approval == null) {
            // Legacy/system PR without an approval chain — single implicit level.
            approval = new PurchaseRequestApproval();
            approval.setPurchaseRequest(request);
            approval.setLevel(1);
        }
        approval.setStatus("APPROVED");
        approval.setApprover(user);
        approval.setComments(comments);
        approval.setActedAt(LocalDateTime.now());
        approvalRepository.save(approval);

        request.setCurrentLevel(approval.getLevel());
        boolean fullyApproved = approval.getLevel() >= (request.getApprovalLevels() != null ? request.getApprovalLevels() : 1);
        if (fullyApproved) {
            request.setStatus("APPROVED");
            request.setApprovedBy(user);
            request.setDecidedAt(LocalDateTime.now());
            if (request.getRequestedBy() != null) {
                notificationService.dispatch("Purchase Request Approved",
                        request.getRequestNumber() + " is approved and ready for PO conversion",
                        "PURCHASE_REQUEST", request.getRequestedBy().getId(), "/purchases/requests");
            }
        } else {
            purchaseService.notifyRoles("Approval Required: Purchase Request",
                    request.getRequestNumber() + " — level " + (approval.getLevel() + 1) + " approval pending",
                    "PURCHASE_REQUEST", "/purchases/requests");
        }
        return purchaseRequestRepository.save(request);
    }

    @Transactional
    public PurchaseRequest reject(Long id, String reason) {
        PurchaseRequest request = get(id);
        if (!"PENDING".equals(request.getStatus())) {
            throw new IllegalStateException("Only a PENDING purchase request can be rejected");
        }
        User user = currentUserService.getCurrentUser();
        approvalRepository.findFirstByPurchaseRequestIdAndStatusOrderByLevelAsc(id, "PENDING")
                .ifPresent(approval -> {
                    approval.setStatus("REJECTED");
                    approval.setApprover(user);
                    approval.setComments(reason);
                    approval.setActedAt(LocalDateTime.now());
                    approvalRepository.save(approval);
                });
        request.setStatus("REJECTED");
        request.setDecidedAt(LocalDateTime.now());
        request.setNotes((request.getNotes() != null ? request.getNotes() + " | " : "") + "Rejected: " + reason);
        if (request.getRequestedBy() != null) {
            notificationService.dispatch("Purchase Request Rejected",
                    request.getRequestNumber() + (reason != null && !reason.isBlank() ? ": " + reason : ""),
                    "PURCHASE_REQUEST", request.getRequestedBy().getId(), "/purchases/requests");
        }
        return purchaseRequestRepository.save(request);
    }

    // =====================================================================
    // Conversion to purchase orders
    // =====================================================================

    /**
     * Converts an approved PR into purchase orders — items are grouped by preferred supplier,
     * one PO per supplier. Legacy single-product PENDING system PRs convert directly (their
     * approval is the conversion decision itself).
     */
    @Transactional
    public List<PurchaseOrder> convertToPurchaseOrders(Long id) {
        PurchaseRequest request = get(id);
        List<PurchaseRequestItem> items = purchaseRequestItemRepository.findByPurchaseRequestId(id);

        boolean legacyShape = items.isEmpty() && request.getProduct() != null;
        if (legacyShape) {
            if (!"PENDING".equals(request.getStatus()) && !"APPROVED".equals(request.getStatus())) {
                throw new IllegalStateException("This purchase request was already " + request.getStatus().toLowerCase());
            }
        } else if (!"APPROVED".equals(request.getStatus())) {
            throw new IllegalStateException("Only an APPROVED purchase request can be converted");
        }

        List<PurchaseOrder> orders;
        if (legacyShape) {
            orders = List.of(convertLegacySingleProduct(request));
        } else {
            orders = convertMultiItem(request, items);
        }
        request.setStatus("CONVERTED");
        request.setConvertedPurchaseOrder(orders.get(0));
        purchaseRequestRepository.save(request);
        return orders;
    }

    private PurchaseOrder convertLegacySingleProduct(PurchaseRequest request) {
        Supplier supplier = request.getSupplier();
        if (supplier == null) {
            supplier = productSupplierService.getPreferredSupplier(request.getProduct().getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "No supplier on file for " + request.getProduct().getName() + "; set one before converting"));
        }
        BigDecimal unitPrice = resolveUnitPrice(request.getProduct(), supplier, null);
        PurchaseOrder order = newOrderShell(request, supplier);

        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setPurchaseOrder(order);
        item.setProduct(request.getProduct());
        item.setQuantity(request.getQuantity());
        item.setUnitPrice(unitPrice);
        item.setTotalPrice(unitPrice.multiply(BigDecimal.valueOf(request.getQuantity())));
        order.setSubtotal(item.getTotalPrice());
        order.setTotalAmount(item.getTotalPrice());
        order = purchaseOrderRepository.save(order);
        item.setPurchaseOrder(order);
        purchaseOrderItemRepository.save(item);
        return order;
    }

    private List<PurchaseOrder> convertMultiItem(PurchaseRequest request, List<PurchaseRequestItem> items) {
        // Group lines by supplier: PR-level supplier override wins, else per-product preferred supplier.
        Map<Long, Supplier> supplierById = new LinkedHashMap<>();
        Map<Long, List<PurchaseRequestItem>> linesBySupplier = new LinkedHashMap<>();
        for (PurchaseRequestItem line : items) {
            Supplier supplier = request.getSupplier() != null ? request.getSupplier()
                    : productSupplierService.getPreferredSupplier(line.getProduct().getId())
                        .orElseThrow(() -> new IllegalStateException(
                                "No supplier on file for " + line.getProduct().getName() + "; set one before converting"));
            supplierById.putIfAbsent(supplier.getId(), supplier);
            linesBySupplier.computeIfAbsent(supplier.getId(), k -> new ArrayList<>()).add(line);
        }

        List<PurchaseOrder> orders = new ArrayList<>();
        for (Map.Entry<Long, List<PurchaseRequestItem>> entry : linesBySupplier.entrySet()) {
            Supplier supplier = supplierById.get(entry.getKey());
            PurchaseOrder order = newOrderShell(request, supplier);
            BigDecimal subtotal = BigDecimal.ZERO;

            List<PurchaseOrderItem> poItems = new ArrayList<>();
            for (PurchaseRequestItem line : entry.getValue()) {
                BigDecimal unitPrice = resolveUnitPrice(line.getProduct(), supplier, line.getEstimatedUnitPrice());
                PurchaseOrderItem item = new PurchaseOrderItem();
                item.setProduct(line.getProduct());
                item.setQuantity(line.getQuantity());
                item.setUnitPrice(unitPrice);
                item.setTotalPrice(unitPrice.multiply(BigDecimal.valueOf(line.getQuantity())));
                subtotal = subtotal.add(item.getTotalPrice());
                poItems.add(item);
            }
            order.setSubtotal(subtotal);
            order.setTotalAmount(subtotal);
            order = purchaseOrderRepository.save(order);
            for (PurchaseOrderItem item : poItems) {
                item.setPurchaseOrder(order);
                purchaseOrderItemRepository.save(item);
            }
            orders.add(order);
        }
        return orders;
    }

    private PurchaseOrder newOrderShell(PurchaseRequest request, Supplier supplier) {
        PurchaseOrder order = new PurchaseOrder();
        order.setPoNumber(purchaseService.nextPoNumber());
        order.setSupplier(supplier);
        order.setDate(java.time.LocalDate.now());
        order.setStatus("DRAFT");
        order.setWarehouse(request.getWarehouse());
        order.setProject(request.getProject());
        order.setBoq(request.getBoq());
        order.setPurchaseRequest(request);
        order.setPaymentTerms(supplier.getPaymentTerms());
        if (request.getRequiredDate() != null) {
            order.setExpectedDeliveryDate(request.getRequiredDate());
        } else if (supplier.getLeadTimeDays() != null) {
            order.setExpectedDeliveryDate(java.time.LocalDate.now().plusDays(supplier.getLeadTimeDays()));
        }
        order.setNotes("Auto-generated from purchase request " + request.getRequestNumber());
        return order;
    }

    /** Supplier-specific catalog price, else the PR's estimate, else the product cost price. */
    private BigDecimal resolveUnitPrice(Product product, Supplier supplier, BigDecimal estimate) {
        Optional<BigDecimal> supplierPrice = productSupplierRepository.findByProductId(product.getId()).stream()
                .filter(link -> link.getSupplier().getId().equals(supplier.getId()))
                .map(ProductSupplier::getPurchasePrice)
                .filter(Objects::nonNull)
                .findFirst();
        if (supplierPrice.isPresent()) return supplierPrice.get();
        if (estimate != null) return estimate;
        if (product.getPurchasePrice() != null) return product.getPurchasePrice();
        return product.getCostPrice() != null ? product.getCostPrice() : BigDecimal.ZERO;
    }

    // =====================================================================
    // Low-stock scan (legacy behavior preserved)
    // =====================================================================

    // @Transactional here too: the scheduler enters through this method, so runScan()'s own
    // annotation never applies (self-invocation) and lazy Product proxies would explode.
    // Daily reorder scan (was every 30 min — far more often than reorder decisions actually change,
    // which just churned notifications). A PENDING purchase request already blocks re-drafting.
    @Scheduled(cron = "0 15 8 * * *")
    @Transactional
    public void scanLowStock() {
        runScan();
    }

    /** Runs the same scan on demand (manual trigger endpoint), so the pipeline is testable without waiting for the schedule. */
    @Transactional
    public int runScan() {
        int created = 0;
        for (InventoryItem item : itemRepository.findAll()) {
            Product product = item.getProduct();
            Integer reorderLevel = product.getReorderLevel();
            if (reorderLevel == null || reorderLevel <= 0) {
                continue;
            }
            if (item.getAvailableQuantity() > reorderLevel) {
                continue;
            }
            Optional<PurchaseRequest> existing = purchaseRequestRepository
                    .findFirstByProductIdAndWarehouseIdAndStatus(product.getId(), item.getWarehouse().getId(), "PENDING");
            if (existing.isPresent()) {
                continue;
            }

            int target = product.getMaxStockLevel() != null ? product.getMaxStockLevel() : reorderLevel * 2;
            int quantity = Math.max(target - item.getAvailableQuantity(), 1);

            PurchaseRequest request = new PurchaseRequest();
            request.setRequestNumber(nextPrNumber());
            request.setProduct(product);
            request.setWarehouse(item.getWarehouse());
            request.setQuantity(quantity);
            request.setReorderLevelSnapshot(reorderLevel);
            request.setStatus("PENDING");
            request.setTriggeredBy("SYSTEM");
            request.setSource("INVENTORY");
            request.setReason("Low stock: available " + item.getAvailableQuantity() + " <= reorder level " + reorderLevel);
            productSupplierService.getPreferredSupplier(product.getId()).ifPresent(request::setSupplier);
            purchaseRequestRepository.save(request);
            created++;

            for (User recipient : userRepository.findByRoleNames(InventoryService.INVENTORY_ALERT_ROLES)) {
                notificationService.dispatch("Low Stock: Purchase Request Drafted",
                        request.getRequestNumber() + " for " + product.getName() + " (qty " + quantity + ")",
                        "PURCHASE_REQUEST", recipient.getId(), "/purchases/requests");
            }
        }
        return created;
    }

    private String nextPrNumber() {
        String candidate = String.format("PR-%06d", purchaseRequestRepository.count() + 1);
        while (purchaseRequestRepository.existsByRequestNumber(candidate)) {
            candidate = "PR-" + System.currentTimeMillis() + "-" + (int) (Math.random() * 1000);
        }
        return candidate;
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import com.arudra.crm.security.CurrentUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class PurchaseService {

    /** Roles that get procurement alerts (approvals required, deliveries, invoices due). */
    static final List<String> PURCHASE_ALERT_ROLES =
            List.of("ROLE_ADMIN", "ROLE_MANAGER", "ROLE_INVENTORY_MANAGER");

    /** PO statuses that still expect a delivery. */
    static final List<String> OPEN_PO_STATUSES =
            List.of("APPROVED", "SENT", "CONFIRMED", "PARTIAL");

    @Autowired private SupplierRepository supplierRepository;
    @Autowired private PurchaseOrderRepository poRepository;
    @Autowired private PurchaseOrderItemRepository poiRepository;
    @Autowired private GoodsReceiptNoteRepository grnRepository;
    @Autowired private GoodsReceiptNoteItemRepository grniRepository;
    @Autowired private GrnPhotoRepository grnPhotoRepository;
    @Autowired private PurchaseBillRepository billRepository;
    @Autowired private PurchasePaymentRepository paymentRepository;
    @Autowired private PurchaseReturnRepository returnRepository;
    @Autowired private PurchaseReturnItemRepository returnItemRepository;
    @Autowired private PurchaseRequestRepository purchaseRequestRepository;
    @Autowired private ProductSupplierRepository productSupplierRepository;
    @Autowired private ProjectMaterialRequirementRepository projectMaterialRequirementRepository;
    @Autowired private InventoryService inventoryService;
    @Autowired private NotificationService notificationService;
    @Autowired private UserRepository userRepository;
    @Autowired private CurrentUserService currentUserService;
    @Autowired @org.springframework.context.annotation.Lazy private ProjectFinanceService projectFinanceService;

    // =====================================================================
    // Suppliers
    // =====================================================================

    public List<Supplier> getAllSuppliers() {
        return supplierRepository.findAllByOrderByNameAsc();
    }

    public List<Supplier> searchSuppliers(String search) {
        if (search == null || search.isBlank()) {
            return getAllSuppliers();
        }
        return supplierRepository.findByNameContainingIgnoreCaseOrderByNameAsc(search.trim());
    }

    public Supplier getSupplier(Long id) {
        return supplierRepository.findById(id).orElseThrow();
    }

    public Supplier createSupplier(Supplier supplier) {
        return supplierRepository.save(supplier);
    }

    public Supplier updateSupplier(Long id, Supplier details) {
        Supplier supplier = supplierRepository.findById(id).orElseThrow();
        supplier.setName(details.getName());
        supplier.setContactPerson(details.getContactPerson());
        supplier.setEmail(details.getEmail());
        supplier.setPhone(details.getPhone());
        supplier.setAddress(details.getAddress());
        supplier.setCity(details.getCity());
        supplier.setState(details.getState());
        supplier.setPincode(details.getPincode());
        supplier.setTaxId(details.getTaxId());
        supplier.setGstin(details.getGstin());
        supplier.setPan(details.getPan());
        supplier.setBankName(details.getBankName());
        supplier.setBankAccountNumber(details.getBankAccountNumber());
        supplier.setBankIfsc(details.getBankIfsc());
        supplier.setCreditLimit(details.getCreditLimit());
        supplier.setPaymentTerms(details.getPaymentTerms());
        supplier.setLeadTimeDays(details.getLeadTimeDays());
        if (details.getPerformanceRating() != null) {
            supplier.setPerformanceRating(details.getPerformanceRating());
        }
        if (details.getStatus() != null) {
            supplier.setStatus(details.getStatus());
        }
        return supplierRepository.save(supplier);
    }

    /** Supplier 360: outstanding balance, past purchases, delivery performance. */
    public Map<String, Object> getSupplierProfile(Long id) {
        Supplier supplier = getSupplier(id);
        List<PurchaseOrder> orders = poRepository.findBySupplierIdOrderByIdDesc(id);
        List<PurchaseBill> bills = billRepository.findBySupplierId(id);
        List<PurchasePayment> payments = paymentRepository.findBySupplierIdOrderByPaymentDateDesc(id);

        BigDecimal totalBilled = bills.stream()
                .map(PurchaseBill::getTotalAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPaid = payments.stream()
                .map(PurchasePayment::getAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalOrdered = orders.stream()
                .filter(po -> !"CANCELLED".equals(po.getStatus()) && !"REJECTED".equals(po.getStatus()))
                .map(PurchaseOrder::getTotalAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // On-time delivery: completed POs whose first GRN landed on/before the expected date.
        int completed = 0, onTime = 0;
        for (PurchaseOrder po : orders) {
            if (!"COMPLETED".equals(po.getStatus()) || po.getExpectedDeliveryDate() == null) continue;
            completed++;
            List<GoodsReceiptNote> grns = grnRepository.findByPurchaseOrderId(po.getId());
            Optional<LocalDateTime> firstReceipt = grns.stream()
                    .map(GoodsReceiptNote::getDate).filter(Objects::nonNull).min(Comparator.naturalOrder());
            if (firstReceipt.isPresent() && !firstReceipt.get().toLocalDate().isAfter(po.getExpectedDeliveryDate())) {
                onTime++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("supplier", supplier);
        result.put("totalOrders", orders.size());
        result.put("totalOrderedValue", totalOrdered);
        result.put("totalBilled", totalBilled);
        result.put("totalPaid", totalPaid);
        result.put("outstandingBalance", totalBilled.subtract(totalPaid));
        result.put("creditLimit", supplier.getCreditLimit());
        result.put("onTimeDeliveryPercent", completed > 0 ? Math.round(onTime * 100.0 / completed) : null);
        result.put("completedOrders", completed);
        result.put("pastPurchases", orders.stream().limit(25).toList());
        result.put("recentPayments", payments.stream().limit(10).toList());
        return result;
    }

    // =====================================================================
    // Purchase Orders
    // =====================================================================

    public Page<PurchaseOrder> getPurchaseOrders(int page, int size) {
        return poRepository.findAllByOrderByDateDesc(PageRequest.of(page, size));
    }

    public Page<PurchaseOrder> searchPurchaseOrders(String status, Long supplierId, Long projectId, Long warehouseId,
                                                    LocalDate from, LocalDate to, String search, int page, int size) {
        String term = (search == null || search.isBlank()) ? null : search.trim();
        return poRepository.search(status, supplierId, projectId, warehouseId, from, to, term, PageRequest.of(page, size));
    }

    public Optional<PurchaseOrder> getPurchaseOrder(Long id) {
        return poRepository.findById(id);
    }

    @Transactional
    public PurchaseOrder createPurchaseOrder(PurchaseOrder po, List<PurchaseOrderItem> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("A purchase order needs at least one line item");
        }
        po.setDate(LocalDate.now());
        po.setStatus("DRAFT");
        if (po.getPoNumber() == null || po.getPoNumber().isBlank()) {
            po.setPoNumber(nextPoNumber());
        }
        applyTotals(po, items);

        PurchaseOrder savedPo = poRepository.save(po);
        for (PurchaseOrderItem item : items) {
            item.setPurchaseOrder(savedPo);
            poiRepository.save(item);
        }
        return savedPo;
    }

    /** Editable while still DRAFT/PENDING_APPROVAL: header terms and full line-item replacement. */
    @Transactional
    public PurchaseOrder updatePurchaseOrder(Long id, PurchaseOrder details, List<PurchaseOrderItem> items) {
        PurchaseOrder po = poRepository.findById(id).orElseThrow();
        if (!"DRAFT".equals(po.getStatus()) && !"PENDING_APPROVAL".equals(po.getStatus())) {
            throw new IllegalStateException("Only a DRAFT or PENDING_APPROVAL purchase order can be edited");
        }
        po.setSupplier(details.getSupplier() != null ? details.getSupplier() : po.getSupplier());
        po.setWarehouse(details.getWarehouse());
        po.setProject(details.getProject());
        po.setBoq(details.getBoq());
        po.setPhase(details.getPhase());
        po.setRoom(details.getRoom());
        po.setTask(details.getTask());
        po.setExpectedDeliveryDate(details.getExpectedDeliveryDate());
        po.setDeliveryAddress(details.getDeliveryAddress());
        po.setPaymentTerms(details.getPaymentTerms());
        po.setTaxPercent(details.getTaxPercent());
        po.setDiscountAmount(details.getDiscountAmount());
        po.setTransportationCost(details.getTransportationCost());
        po.setNotes(details.getNotes());

        if (items != null && !items.isEmpty()) {
            List<PurchaseOrderItem> existing = poiRepository.findByPurchaseOrderId(id);
            poiRepository.deleteAll(existing);
            for (PurchaseOrderItem item : items) {
                item.setPurchaseOrder(po);
            }
            applyTotals(po, items);
            poiRepository.saveAll(items);
        } else {
            applyTotals(po, poiRepository.findByPurchaseOrderId(id));
        }
        return poRepository.save(po);
    }

    /** Computes line totals, subtotal, tax, and the grand total onto the PO. */
    private void applyTotals(PurchaseOrder po, List<PurchaseOrderItem> items) {
        BigDecimal subtotal = BigDecimal.ZERO;
        for (PurchaseOrderItem item : items) {
            BigDecimal lineTotal = item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            item.setTotalPrice(lineTotal);
            subtotal = subtotal.add(lineTotal);
        }
        po.setSubtotal(subtotal);
        BigDecimal tax = po.getTaxAmount();
        if (po.getTaxPercent() != null) {
            tax = subtotal.multiply(po.getTaxPercent()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        }
        po.setTaxAmount(tax);
        BigDecimal total = subtotal
                .add(tax != null ? tax : BigDecimal.ZERO)
                .add(po.getTransportationCost() != null ? po.getTransportationCost() : BigDecimal.ZERO)
                .subtract(po.getDiscountAmount() != null ? po.getDiscountAmount() : BigDecimal.ZERO);
        po.setTotalAmount(total);
    }

    public List<PurchaseOrderItem> getPurchaseOrderItems(Long poId) {
        return poiRepository.findByPurchaseOrderId(poId);
    }

    private static final Map<String, Set<String>> PO_TRANSITIONS = Map.of(
            "DRAFT", Set.of("PENDING_APPROVAL", "APPROVED", "CANCELLED"),
            "PENDING_APPROVAL", Set.of("APPROVED", "REJECTED", "CANCELLED"),
            "APPROVED", Set.of("SENT", "CANCELLED"),
            "REJECTED", Set.of("DRAFT"),
            "SENT", Set.of("CONFIRMED", "PARTIAL", "COMPLETED", "CANCELLED"),
            "CONFIRMED", Set.of("PARTIAL", "COMPLETED", "CANCELLED"),
            "PARTIAL", Set.of("COMPLETED", "CANCELLED")
    );

    @Transactional
    public PurchaseOrder updatePurchaseOrderStatus(Long poId, String status) {
        PurchaseOrder po = poRepository.findById(poId).orElseThrow();
        Set<String> allowed = PO_TRANSITIONS.getOrDefault(po.getStatus(), Set.of());
        if (!allowed.contains(status)) {
            throw new IllegalStateException("Cannot move purchase order from " + po.getStatus() + " to " + status);
        }
        po.setStatus(status);
        if ("SENT".equals(status)) {
            po.setSentAt(LocalDateTime.now());
            notifyRoles("PO Sent to Supplier",
                    po.getPoNumber() + " sent to " + po.getSupplier().getName(),
                    "PURCHASE_ORDER", "/purchases/orders/" + po.getId());
        } else if ("CONFIRMED".equals(status)) {
            po.setConfirmedAt(LocalDateTime.now());
        } else if ("PENDING_APPROVAL".equals(status)) {
            notifyRoles("PO Approval Required",
                    po.getPoNumber() + " (" + po.getSupplier().getName() + ") awaits approval",
                    "PURCHASE_ORDER", "/purchases/orders/" + po.getId());
        }
        return poRepository.save(po);
    }

    // =====================================================================
    // Goods Receipt Notes (GRN) + Quality Check
    // =====================================================================

    public List<GoodsReceiptNote> getGrnsForPo(Long poId) {
        return grnRepository.findByPurchaseOrderId(poId);
    }

    public List<GoodsReceiptNote> getAllGrns() {
        return grnRepository.findAllByOrderByIdDesc();
    }

    public List<GoodsReceiptNoteItem> getGrnItems(Long grnId) {
        return grniRepository.findByGrnId(grnId);
    }

    @Transactional
    public GoodsReceiptNote createGrn(GoodsReceiptNote grn, List<GoodsReceiptNoteItem> items, List<String> photoUrls) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("A GRN needs at least one received line");
        }
        grn.setDate(LocalDateTime.now());
        grn.setStatus("DRAFT");
        if (grn.getGrnNumber() == null || grn.getGrnNumber().isBlank()) {
            grn.setGrnNumber(nextGrnNumber());
        }
        User user = currentUserService.getCurrentUser();
        if (user != null) {
            grn.setReceivedByUser(user);
            if (grn.getReceivedBy() == null) {
                grn.setReceivedBy(user.getName());
            }
        }
        GoodsReceiptNote savedGrn = grnRepository.save(grn);

        for (GoodsReceiptNoteItem item : items) {
            item.setGrn(savedGrn);
            if (item.getAcceptedQuantity() == null) {
                int rejected = item.getRejectedQuantity() != null ? item.getRejectedQuantity() : 0;
                int damaged = item.getDamagedQuantity() != null ? item.getDamagedQuantity() : 0;
                item.setAcceptedQuantity(Math.max(item.getReceivedQuantity() - rejected - damaged, 0));
            }
            grniRepository.save(item);
        }
        if (photoUrls != null) {
            for (String url : photoUrls) {
                if (url == null || url.isBlank()) continue;
                GrnPhoto photo = new GrnPhoto();
                photo.setGrn(savedGrn);
                photo.setPhotoUrl(url);
                grnPhotoRepository.save(photo);
            }
        }
        return savedGrn;
    }

    public List<GrnPhoto> getGrnPhotos(Long grnId) {
        return grnPhotoRepository.findByGrnId(grnId);
    }

    /** Records the quality-check verdict on a draft GRN. */
    public GoodsReceiptNote recordQualityCheck(Long grnId, String qcStatus, String reason, String remarks) {
        if (!List.of("PASS", "PARTIAL_PASS", "REJECT").contains(qcStatus)) {
            throw new IllegalArgumentException("QC status must be PASS, PARTIAL_PASS or REJECT");
        }
        GoodsReceiptNote grn = grnRepository.findById(grnId).orElseThrow();
        if ("APPROVED".equals(grn.getStatus())) {
            throw new IllegalStateException("QC verdict must be recorded before the GRN is approved");
        }
        grn.setQcStatus(qcStatus);
        grn.setQcReason(reason);
        grn.setQcRemarks(remarks);
        return grnRepository.save(grn);
    }

    @Transactional
    public GoodsReceiptNote approveGrn(Long grnId) {
        GoodsReceiptNote grn = grnRepository.findById(grnId).orElseThrow();
        if ("APPROVED".equals(grn.getStatus())) {
            throw new IllegalStateException("GRN is already approved");
        }
        if ("REJECT".equals(grn.getQcStatus())) {
            throw new IllegalStateException("A quality-rejected GRN cannot be approved; raise a purchase return instead");
        }

        PurchaseOrder po = grn.getPurchaseOrder();
        List<GoodsReceiptNoteItem> items = grniRepository.findByGrnId(grnId);
        List<PurchaseOrderItem> poItems = poiRepository.findByPurchaseOrderId(po.getId());

        for (GoodsReceiptNoteItem item : items) {
            // 1. Update PO item received quantity
            for (PurchaseOrderItem poItem : poItems) {
                if (poItem.getProduct().getId().equals(item.getProduct().getId())) {
                    poItem.setReceivedQuantity(poItem.getReceivedQuantity() + item.getAcceptedQuantity());
                    poiRepository.save(poItem);
                    break;
                }
            }

            // 2. Add accepted stock to Inventory via InventoryTransaction
            if (item.getAcceptedQuantity() > 0) {
                InventoryTransaction tx = new InventoryTransaction();
                tx.setProduct(item.getProduct());
                tx.setDestinationWarehouse(grn.getWarehouse());
                tx.setType("PURCHASE");
                tx.setQuantity(item.getAcceptedQuantity());
                tx.setReference(grn.getGrnNumber());
                tx.setReferenceType("GRN");
                tx.setReferenceId(grn.getId());
                tx.setProject(po.getProject());
                tx.setDate(LocalDateTime.now());
                inventoryService.processTransaction(tx);
            }

            // 3. Refresh supplier price memory for this material
            for (ProductSupplier link : productSupplierRepository.findByProductId(item.getProduct().getId())) {
                if (link.getSupplier().getId().equals(po.getSupplier().getId())) {
                    link.setLastPurchaseDate(LocalDate.now());
                    for (PurchaseOrderItem poItem : poItems) {
                        if (poItem.getProduct().getId().equals(item.getProduct().getId())) {
                            link.setPurchasePrice(poItem.getUnitPrice());
                        }
                    }
                    productSupplierRepository.save(link);
                }
            }

            // 4. Link project material requirements to this PO for availability tracking
            if (po.getProject() != null) {
                for (ProjectMaterialRequirement req :
                        projectMaterialRequirementRepository.findByProjectIdOrderByIdAsc(po.getProject().getId())) {
                    if (req.getProduct().getId().equals(item.getProduct().getId()) && req.getPurchaseOrder() == null) {
                        req.setPurchaseOrder(po);
                        projectMaterialRequirementRepository.save(req);
                    }
                }
            }
        }

        grn.setStatus("APPROVED");
        checkAndUpdatePoStatus(po.getId());

        notifyRoles("Material Received",
                grn.getGrnNumber() + " received against " + po.getPoNumber() + " at " + grn.getWarehouse().getName(),
                "GRN", "/purchases/orders/" + po.getId());

        return grnRepository.save(grn);
    }

    private void checkAndUpdatePoStatus(Long poId) {
        PurchaseOrder po = poRepository.findById(poId).orElseThrow();
        List<PurchaseOrderItem> items = poiRepository.findByPurchaseOrderId(poId);
        boolean allReceived = true;
        for (PurchaseOrderItem item : items) {
            if (item.getReceivedQuantity() < item.getQuantity()) {
                allReceived = false;
                break;
            }
        }
        if (allReceived && !"COMPLETED".equals(po.getStatus())) {
            po.setStatus("COMPLETED");
            poRepository.save(po);
        } else if (!allReceived && !"PARTIAL".equals(po.getStatus())) {
            po.setStatus("PARTIAL");
            poRepository.save(po);
        }
    }

    // =====================================================================
    // Bills (purchase invoices) & Payments
    // =====================================================================

    public List<PurchaseBill> getBillsForPo(Long poId) {
        return billRepository.findByPurchaseOrderId(poId);
    }

    public List<PurchaseBill> getAllBills() {
        return billRepository.findAllByOrderByIdDesc();
    }

    public PurchaseBill createBill(PurchaseBill bill) {
        bill.setDate(LocalDate.now());
        bill.setStatus("UNPAID");
        PurchaseOrder po = null;
        if (bill.getPurchaseOrder() != null && bill.getPurchaseOrder().getId() != null) {
            po = poRepository.findById(bill.getPurchaseOrder().getId()).orElseThrow();
            if (bill.getSupplier() == null) {
                bill.setSupplier(po.getSupplier());
            }
        }
        PurchaseBill saved = billRepository.save(bill);
        // Finance automation: a bill against a project PO immediately becomes project cost.
        if (po != null && po.getProject() != null) {
            try {
                projectFinanceService.syncProjectExpenses(po.getProject().getId());
            } catch (Exception e) {
                System.out.println("Project expense sync skipped for bill " + saved.getId() + ": " + e.getMessage());
            }
        }
        return saved;
    }

    public List<PurchasePayment> getPaymentsForBill(Long billId) {
        return paymentRepository.findByPurchaseBillId(billId);
    }

    public List<PurchasePayment> getAllPayments() {
        return paymentRepository.findAllByOrderByIdDesc();
    }

    /**
     * Records a supplier payment. ADVANCE payments reference a PO (no bill yet);
     * PARTIAL/FULL payments reference a bill and roll its status forward.
     */
    @Transactional
    public PurchasePayment addPayment(PurchasePayment payment) {
        if (payment.getPaymentDate() == null) {
            payment.setPaymentDate(LocalDate.now());
        }
        if (payment.getPurchaseBill() == null && payment.getPurchaseOrder() == null) {
            throw new IllegalArgumentException("A payment must reference a bill or (for advances) a purchase order");
        }

        if (payment.getPurchaseBill() != null) {
            PurchaseBill bill = billRepository.findById(payment.getPurchaseBill().getId()).orElseThrow();
            payment.setSupplier(bill.getSupplier());
            if (payment.getPurchaseOrder() == null) {
                payment.setPurchaseOrder(bill.getPurchaseOrder());
            }
            PurchasePayment saved = paymentRepository.save(payment);

            BigDecimal totalPaid = paymentRepository.findByPurchaseBillId(bill.getId()).stream()
                    .map(PurchasePayment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (totalPaid.compareTo(bill.getTotalAmount()) >= 0) {
                bill.setStatus("PAID");
            } else if (totalPaid.compareTo(BigDecimal.ZERO) > 0) {
                bill.setStatus("PARTIAL");
            }
            billRepository.save(bill);
            return saved;
        }

        // Advance against a PO
        PurchaseOrder po = poRepository.findById(payment.getPurchaseOrder().getId()).orElseThrow();
        payment.setSupplier(po.getSupplier());
        payment.setPaymentType("ADVANCE");
        return paymentRepository.save(payment);
    }

    // =====================================================================
    // Purchase Returns
    // =====================================================================

    public List<PurchaseReturn> getAllReturns() {
        return returnRepository.findAllByOrderByIdDesc();
    }

    public List<PurchaseReturnItem> getReturnItems(Long returnId) {
        return returnItemRepository.findByPurchaseReturnId(returnId);
    }

    @Transactional
    public PurchaseReturn createReturn(PurchaseReturn purchaseReturn, List<PurchaseReturnItem> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("A purchase return needs at least one line");
        }
        if (!List.of("DAMAGED", "WRONG_MATERIAL", "EXCESS_QUANTITY").contains(purchaseReturn.getReasonType())) {
            throw new IllegalArgumentException("Reason must be DAMAGED, WRONG_MATERIAL or EXCESS_QUANTITY");
        }
        PurchaseOrder po = poRepository.findById(purchaseReturn.getPurchaseOrder().getId()).orElseThrow();
        purchaseReturn.setSupplier(po.getSupplier());
        purchaseReturn.setStatus("DRAFT");
        if (purchaseReturn.getReturnNumber() == null || purchaseReturn.getReturnNumber().isBlank()) {
            purchaseReturn.setReturnNumber(nextReturnNumber());
        }

        List<PurchaseOrderItem> poItems = poiRepository.findByPurchaseOrderId(po.getId());
        BigDecimal total = BigDecimal.ZERO;
        for (PurchaseReturnItem item : items) {
            PurchaseOrderItem poItem = poItems.stream()
                    .filter(pi -> pi.getProduct().getId().equals(item.getProduct().getId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Returned product is not on this purchase order"));
            int returnable = poItem.getReceivedQuantity() - poItem.getReturnedQuantity();
            if (item.getQuantity() > returnable) {
                throw new IllegalArgumentException("Return quantity for " + poItem.getProduct().getName()
                        + " exceeds received balance (" + returnable + ")");
            }
            if (item.getUnitPrice() == null) {
                item.setUnitPrice(poItem.getUnitPrice());
            }
            item.setTotalPrice(item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
            total = total.add(item.getTotalPrice());
        }
        purchaseReturn.setTotalAmount(total);
        PurchaseReturn saved = returnRepository.save(purchaseReturn);
        for (PurchaseReturnItem item : items) {
            item.setPurchaseReturn(saved);
            returnItemRepository.save(item);
        }
        return saved;
    }

    /** Confirms the return: deducts stock from the warehouse and bumps PO returned quantities. */
    @Transactional
    public PurchaseReturn confirmReturn(Long id) {
        PurchaseReturn purchaseReturn = returnRepository.findById(id).orElseThrow();
        if (!"DRAFT".equals(purchaseReturn.getStatus())) {
            throw new IllegalStateException("Only a DRAFT return can be confirmed");
        }
        List<PurchaseReturnItem> items = returnItemRepository.findByPurchaseReturnId(id);
        List<PurchaseOrderItem> poItems = poiRepository.findByPurchaseOrderId(purchaseReturn.getPurchaseOrder().getId());

        for (PurchaseReturnItem item : items) {
            InventoryTransaction tx = new InventoryTransaction();
            tx.setProduct(item.getProduct());
            tx.setSourceWarehouse(purchaseReturn.getWarehouse());
            tx.setType("PURCHASE_RETURN");
            tx.setQuantity(item.getQuantity());
            tx.setReference(purchaseReturn.getReturnNumber());
            tx.setReferenceType("PURCHASE_RETURN");
            tx.setReferenceId(purchaseReturn.getId());
            tx.setDate(LocalDateTime.now());
            inventoryService.processTransaction(tx);

            for (PurchaseOrderItem poItem : poItems) {
                if (poItem.getProduct().getId().equals(item.getProduct().getId())) {
                    poItem.setReturnedQuantity(poItem.getReturnedQuantity() + item.getQuantity());
                    poiRepository.save(poItem);
                    break;
                }
            }
        }
        purchaseReturn.setStatus("CONFIRMED");
        purchaseReturn.setConfirmedAt(LocalDateTime.now());
        notifyRoles("Purchase Return Confirmed",
                purchaseReturn.getReturnNumber() + " (" + purchaseReturn.getReasonType() + ") to "
                        + purchaseReturn.getSupplier().getName(),
                "PURCHASE_RETURN", "/purchases/returns");
        return returnRepository.save(purchaseReturn);
    }

    // =====================================================================
    // Price comparison
    // =====================================================================

    /** All supplier options for a material with price, lead time and rating, plus purchase history stats. */
    public List<Map<String, Object>> comparePrices(Long productId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        List<PurchaseOrderItem> history = poiRepository.findAll().stream()
                .filter(i -> i.getProduct().getId().equals(productId))
                .toList();

        for (ProductSupplier link : productSupplierRepository.findByProductId(productId)) {
            Supplier supplier = link.getSupplier();
            List<BigDecimal> pastPrices = history.stream()
                    .filter(i -> i.getPurchaseOrder().getSupplier() != null
                            && i.getPurchaseOrder().getSupplier().getId().equals(supplier.getId()))
                    .map(PurchaseOrderItem::getUnitPrice)
                    .filter(Objects::nonNull)
                    .toList();
            BigDecimal avgPrice = pastPrices.isEmpty() ? null
                    : pastPrices.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(pastPrices.size()), 2, RoundingMode.HALF_UP);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("supplierId", supplier.getId());
            row.put("supplierName", supplier.getName());
            row.put("price", link.getPurchasePrice());
            row.put("leadTimeDays", link.getLeadTimeDays() != null ? link.getLeadTimeDays() : supplier.getLeadTimeDays());
            row.put("rating", supplier.getPerformanceRating());
            row.put("isPreferred", link.getIsPreferred());
            row.put("lastPurchaseDate", link.getLastPurchaseDate());
            row.put("lastPurchasePrice", pastPrices.isEmpty() ? null : pastPrices.get(pastPrices.size() - 1));
            row.put("averagePrice", avgPrice);
            rows.add(row);
        }
        rows.sort(Comparator.comparing(r -> {
            BigDecimal p = (BigDecimal) r.get("price");
            return p != null ? p : BigDecimal.valueOf(Long.MAX_VALUE);
        }));
        return rows;
    }

    // =====================================================================
    // Dashboard
    // =====================================================================

    public Map<String, Object> getDashboard() {
        LocalDate today = LocalDate.now();

        long pendingPr = purchaseRequestRepository.countByStatus("PENDING");
        long approvedPr = purchaseRequestRepository.countByStatus("APPROVED");
        long pendingPo = poRepository.countByStatusIn(List.of("DRAFT", "PENDING_APPROVAL"));
        long openPo = poRepository.countByStatusIn(OPEN_PO_STATUSES);
        long pendingGrn = grnRepository.countByStatus("DRAFT");

        List<PurchaseBill> unpaidBills = billRepository.findByStatusInOrderByDueDateAsc(List.of("UNPAID", "PARTIAL"));
        BigDecimal outstanding = BigDecimal.ZERO;
        for (PurchaseBill bill : unpaidBills) {
            BigDecimal paid = paymentRepository.findByPurchaseBillId(bill.getId()).stream()
                    .map(PurchasePayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            outstanding = outstanding.add(bill.getTotalAmount().subtract(paid));
        }

        List<PurchaseOrder> todaysDeliveries = poRepository.findByExpectedDeliveryDateAndStatusIn(today, OPEN_PO_STATUSES);
        List<PurchaseOrder> delayedDeliveries = poRepository.findByExpectedDeliveryDateBeforeAndStatusIn(today, OPEN_PO_STATUSES);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pendingPurchaseRequests", pendingPr);
        result.put("approvedPurchaseRequests", approvedPr);
        result.put("pendingPurchaseOrders", pendingPo);
        result.put("openPurchaseOrders", openPo);
        result.put("pendingGrns", pendingGrn);
        result.put("pendingBills", unpaidBills.size());
        result.put("outstandingPayments", outstanding);
        result.put("todaysDeliveries", todaysDeliveries);
        result.put("delayedDeliveries", delayedDeliveries);
        result.put("lowStockMaterials", inventoryService.getLowStockAlerts().size());
        return result;
    }

    // =====================================================================
    // Scheduled alerts: delayed deliveries and invoices due
    // =====================================================================

    /** Every morning: flag POs whose expected delivery date has passed without completion. */
    @Scheduled(cron = "0 0 8 * * *")
    public void alertDelayedDeliveries() {
        List<PurchaseOrder> delayed = poRepository.findByExpectedDeliveryDateBeforeAndStatusIn(LocalDate.now(), OPEN_PO_STATUSES);
        for (PurchaseOrder po : delayed) {
            long daysLate = ChronoUnit.DAYS.between(po.getExpectedDeliveryDate(), LocalDate.now());
            notifyRolesDeduped("Delivery Delayed",
                    po.getPoNumber() + " from " + po.getSupplier().getName() + " is overdue",
                    "PURCHASE_ORDER", "/purchases/orders/" + po.getId());
        }
    }

    /** Every morning: flag supplier invoices due within 3 days or overdue. */
    @Scheduled(cron = "0 5 8 * * *")
    public void alertInvoicesDue() {
        LocalDate today = LocalDate.now();
        List<PurchaseBill> dueSoon = billRepository.findByStatusInAndDueDateBetween(
                List.of("UNPAID", "PARTIAL"), today, today.plusDays(3));
        List<PurchaseBill> overdue = billRepository.findByStatusInAndDueDateBefore(
                List.of("UNPAID", "PARTIAL"), today);
        for (PurchaseBill bill : dueSoon) {
            notifyRolesDeduped("Invoice Due",
                    bill.getBillNumber() + " (" + bill.getSupplier().getName() + ") due on " + bill.getDueDate(),
                    "PURCHASE_BILL", "/purchases/invoices");
        }
        for (PurchaseBill bill : overdue) {
            notifyRolesDeduped("Payment Pending",
                    bill.getBillNumber() + " (" + bill.getSupplier().getName() + ") is overdue since " + bill.getDueDate(),
                    "PURCHASE_BILL", "/purchases/invoices");
        }
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    void notifyRoles(String title, String message, String type, String actionUrl) {
        for (User recipient : userRepository.findByRoleNames(PURCHASE_ALERT_ROLES)) {
            notificationService.dispatch(title, message, type, recipient.getId(), actionUrl);
        }
    }

    /** Deduped variant for the daily delivery/invoice reminders so they don't re-post each morning. */
    void notifyRolesDeduped(String title, String message, String type, String actionUrl) {
        for (User recipient : userRepository.findByRoleNames(PURCHASE_ALERT_ROLES)) {
            notificationService.dispatchIfAbsent(title, message, type, recipient.getId(), actionUrl);
        }
    }

    String nextPoNumber() {
        String candidate = String.format("PO-%06d", poRepository.count() + 1);
        while (poRepository.existsByPoNumber(candidate)) {
            candidate = "PO-" + System.currentTimeMillis();
        }
        return candidate;
    }

    private String nextGrnNumber() {
        String candidate = String.format("GRN-%06d", grnRepository.count() + 1);
        while (grnRepository.existsByGrnNumber(candidate)) {
            candidate = "GRN-" + System.currentTimeMillis();
        }
        return candidate;
    }

    private String nextReturnNumber() {
        String candidate = String.format("PRET-%06d", returnRepository.count() + 1);
        while (returnRepository.existsByReturnNumber(candidate)) {
            candidate = "PRET-" + System.currentTimeMillis();
        }
        return candidate;
    }
}

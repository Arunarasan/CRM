package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class InventoryService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    @Autowired
    private InventoryTransactionRepository transactionRepository;

    @Autowired
    private ProductSupplierRepository productSupplierRepository;

    @Autowired
    private DamageEntryRepository damageEntryRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private PurchaseOrderRepository purchaseOrderRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private com.arudra.crm.repository.PurchaseRequestRepository purchaseRequestRepository;

    /** Roles that get inventory alerts (low stock, negative-stock attempts, damage). */
    static final List<String> INVENTORY_ALERT_ROLES =
            List.of("ROLE_ADMIN", "ROLE_MANAGER", "ROLE_INVENTORY_MANAGER");

    public Page<Product> getProducts(String search, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("id").descending());
        if (search != null && !search.isEmpty()) {
            return productRepository.searchProducts(search, pageRequest);
        }
        return productRepository.findAll(pageRequest);
    }

    public List<InventoryItem> getAllStock() {
        return itemRepository.findAll();
    }

    public List<InventoryItem> getLowStockAlerts() {
        return itemRepository.findLowStockItems();
    }

    public List<InventoryTransaction> getRecentTransactions() {
        return transactionRepository.findTop50ByOrderByDateDesc();
    }

    public Product createProduct(Product product) {
        Product saved = productRepository.save(product);
        // Material code is auto-assigned by the DB layer's MAT-%06d convention (see V6 backfill);
        // barcode/QR default to the material code itself so a freshly-created material is scannable immediately.
        boolean needsCodes = saved.getBarcode() == null || saved.getQrCode() == null;
        if (needsCodes) {
            if (saved.getMaterialCode() == null) {
                saved.setMaterialCode(String.format("MAT-%06d", saved.getId()));
            }
            if (saved.getBarcode() == null) {
                saved.setBarcode(saved.getMaterialCode());
            }
            if (saved.getQrCode() == null) {
                saved.setQrCode(saved.getMaterialCode());
            }
            saved = productRepository.save(saved);
        }
        return saved;
    }

    public Product updateProduct(Long id, Product details) {
        Product product = productRepository.findById(id).orElseThrow();
        product.setName(details.getName());
        product.setSku(details.getSku());
        product.setBarcode(details.getBarcode() != null ? details.getBarcode() : product.getBarcode());
        product.setQrCode(details.getQrCode() != null ? details.getQrCode() : product.getQrCode());
        product.setCategory(details.getCategory());
        product.setSubCategory(details.getSubCategory());
        product.setUnit(details.getUnit());
        product.setBrand(details.getBrand());
        product.setModel(details.getModel());
        product.setHsnCode(details.getHsnCode());
        product.setGstPercent(details.getGstPercent());
        product.setPrice(details.getPrice());
        product.setCostPrice(details.getCostPrice());
        product.setSellingPrice(details.getSellingPrice());
        product.setPurchasePrice(details.getPurchasePrice());
        product.setMinStockLevel(details.getMinStockLevel());
        product.setMaxStockLevel(details.getMaxStockLevel());
        product.setReorderLevel(details.getReorderLevel());
        product.setLeadTimeDays(details.getLeadTimeDays());
        product.setSupplier(details.getSupplier());
        product.setDefaultWarehouse(details.getDefaultWarehouse());
        product.setImageUrl(details.getImageUrl());
        return productRepository.save(product);
    }

    public Product deactivateProduct(Long id) {
        Product product = productRepository.findById(id).orElseThrow();
        product.setStatus("INACTIVE");
        return productRepository.save(product);
    }

    public Product findByBarcode(String code) {
        return productRepository.findFirstByMaterialCodeIgnoreCaseOrSkuIgnoreCaseOrBarcodeOrQrCode(code, code, code, code)
                .orElseThrow(() -> new java.util.NoSuchElementException("No material found for code: " + code));
    }

    /** Spec's Inventory Dashboard tiles. */
    public Map<String, Object> getDashboard() {
        List<Product> products = productRepository.findAll();
        List<InventoryItem> items = itemRepository.findAll();

        java.math.BigDecimal stockValue = java.math.BigDecimal.ZERO;
        java.math.BigDecimal reservedValue = java.math.BigDecimal.ZERO;
        for (InventoryItem item : items) {
            java.math.BigDecimal cost = item.getProduct().getCostPrice() != null
                    ? item.getProduct().getCostPrice()
                    : (item.getProduct().getPrice() != null ? item.getProduct().getPrice() : java.math.BigDecimal.ZERO);
            stockValue = stockValue.add(cost.multiply(java.math.BigDecimal.valueOf(item.getAvailableQuantity())));
            reservedValue = reservedValue.add(cost.multiply(java.math.BigDecimal.valueOf(item.getReservedQuantity())));
        }

        long lowStockCount = getLowStockAlerts().size();
        long outOfStockCount = items.stream().filter(i -> i.getAvailableQuantity() <= 0).count();
        long pendingPurchaseCount = purchaseRequestRepository.findByStatusOrderByIdDesc("PENDING").size();

        LocalDateTime startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay();
        List<InventoryTransaction> todaysTx = transactionRepository.findByDateAfter(startOfDay);
        long todaysIssues = todaysTx.stream().filter(t -> "CONSUMPTION".equals(t.getType())).count();
        long todaysReturns = todaysTx.stream()
                .filter(t -> "PROJECT_RETURN".equals(t.getType()) || "SUPPLIER_RETURN".equals(t.getType()))
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalMaterials", products.size());
        result.put("availableStockValue", stockValue);
        result.put("reservedStockValue", reservedValue);
        result.put("lowStockCount", lowStockCount);
        result.put("outOfStockCount", outOfStockCount);
        result.put("pendingPurchaseCount", pendingPurchaseCount);
        result.put("todaysIssues", todaysIssues);
        result.put("todaysReturns", todaysReturns);
        return result;
    }

    /** Current/reserved/available stock plus catalog pricing/supplier info, per the spec's material picker fields. */
    public Map<String, Object> getAvailability(Long productId) {
        Product product = productRepository.findById(productId).orElseThrow();
        List<InventoryItem> stock = itemRepository.findByProductId(productId);
        int currentStock = stock.stream().mapToInt(InventoryItem::getQuantity).sum();
        int reservedStock = stock.stream().mapToInt(InventoryItem::getReservedQuantity).sum();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("productId", product.getId());
        result.put("productName", product.getName());
        result.put("currentStock", currentStock);
        result.put("reservedStock", reservedStock);
        result.put("availableStock", currentStock - reservedStock);
        result.put("unit", product.getUnit());
        result.put("costPrice", product.getCostPrice() != null ? product.getCostPrice() : product.getPrice());
        result.put("sellingPrice", product.getSellingPrice() != null ? product.getSellingPrice() : product.getPrice());
        result.put("supplier", product.getSupplier() != null ? product.getSupplier().getName() : null);
        result.put("brand", product.getBrand());
        return result;
    }

    @Transactional
    public InventoryTransaction processTransaction(InventoryTransaction tx) {
        if (tx.getDate() == null) {
            tx.setDate(LocalDateTime.now());
        }

        String type = tx.getType(); // PURCHASE, CONSUMPTION, ADJUSTMENT, TRANSFER

        if ("PURCHASE".equals(type) || "ADJUSTMENT".equals(type)
                || "PROJECT_RETURN".equals(type) || "SUPPLIER_RETURN".equals(type) || "OPENING".equals(type)) {
            // Need a destination warehouse to add stock
            if (tx.getDestinationWarehouse() != null) {
                addStock(tx.getProduct().getId(), tx.getDestinationWarehouse().getId(), tx.getQuantity());
            }
        }
        else if ("CONSUMPTION".equals(type) || "PURCHASE_RETURN".equals(type)) {
            // Need a source warehouse to remove stock (PURCHASE_RETURN = material sent back to supplier)
            if (tx.getSourceWarehouse() != null) {
                removeStock(tx.getProduct().getId(), tx.getSourceWarehouse().getId(), tx.getQuantity());
            }
        }
        else if ("TRANSFER".equals(type)) {
            // Need both
            if (tx.getSourceWarehouse() != null && tx.getDestinationWarehouse() != null) {
                removeStock(tx.getProduct().getId(), tx.getSourceWarehouse().getId(), tx.getQuantity());
                addStock(tx.getProduct().getId(), tx.getDestinationWarehouse().getId(), tx.getQuantity());
            }
        }

        return transactionRepository.save(tx);
    }

    /** Reserves stock against the warehouse with the most available quantity for this product. */
    @Transactional
    public void reserveStock(Long productId, int quantity, String referenceType, Long referenceId) {
        InventoryItem item = pickWarehouseForReservation(productId);
        item.setReservedQuantity(item.getReservedQuantity() + quantity);
        itemRepository.save(item);
        logMovement(productId, item.getWarehouse(), null, "RESERVATION", quantity, referenceType, referenceId);
    }

    /** Releases a previously reserved quantity (e.g. item rejected/dropped before execution). */
    @Transactional
    public void releaseReservation(Long productId, int quantity, String referenceType, Long referenceId) {
        List<InventoryItem> stock = itemRepository.findByProductId(productId);
        int remaining = quantity;
        for (InventoryItem item : stock) {
            if (remaining <= 0) break;
            int release = Math.min(item.getReservedQuantity(), remaining);
            if (release <= 0) continue;
            item.setReservedQuantity(item.getReservedQuantity() - release);
            itemRepository.save(item);
            remaining -= release;
        }
        logMovement(productId, null, null, "RELEASE", quantity, referenceType, referenceId);
    }

    /** Converts a reservation into an actual stock deduction (execution/project consumption). */
    @Transactional
    public void deductReservedStock(Long productId, int quantity, String referenceType, Long referenceId) {
        List<InventoryItem> stock = itemRepository.findByProductId(productId);
        int remaining = quantity;
        for (InventoryItem item : stock) {
            if (remaining <= 0) break;
            int consume = Math.min(item.getReservedQuantity(), remaining);
            if (consume <= 0) continue;
            item.setReservedQuantity(item.getReservedQuantity() - consume);
            item.setQuantity(item.getQuantity() - consume);
            itemRepository.save(item);
            remaining -= consume;
        }
        if (remaining > 0) {
            // No matching reservation found for the remainder — deduct directly (allows negative, matches removeStock).
            InventoryItem item = pickWarehouseForReservation(productId);
            item.setQuantity(item.getQuantity() - remaining);
            itemRepository.save(item);
        }
        logMovement(productId, null, null, "CONSUMPTION", quantity, referenceType, referenceId);
    }

    private InventoryItem pickWarehouseForReservation(Long productId) {
        List<InventoryItem> stock = itemRepository.findByProductId(productId);
        return stock.stream()
                .max(Comparator.comparingInt(InventoryItem::getAvailableQuantity))
                .orElseGet(() -> {
                    InventoryItem item = new InventoryItem();
                    item.setProduct(productRepository.findById(productId).orElseThrow());
                    item.setWarehouse(warehouseRepository.findAll().stream().findFirst()
                            .orElseThrow(() -> new IllegalStateException("No warehouse configured to reserve stock against.")));
                    item.setQuantity(0);
                    return itemRepository.save(item);
                });
    }

    private void logMovement(Long productId, Warehouse warehouse, Warehouse unused, String type, int quantity, String referenceType, Long referenceId) {
        InventoryTransaction tx = new InventoryTransaction();
        tx.setProduct(productRepository.findById(productId).orElseThrow());
        tx.setSourceWarehouse(warehouse);
        tx.setType(type);
        tx.setQuantity(quantity);
        tx.setDate(LocalDateTime.now());
        tx.setReferenceType(referenceType);
        tx.setReferenceId(referenceId);
        transactionRepository.save(tx);
    }

    private void addStock(Long productId, Long warehouseId, int quantity) {
        Optional<InventoryItem> optItem = itemRepository.findByProductIdAndWarehouseId(productId, warehouseId);
        InventoryItem item;
        if (optItem.isPresent()) {
            item = optItem.get();
            item.setQuantity(item.getQuantity() + quantity);
        } else {
            item = new InventoryItem();
            item.setProduct(productRepository.findById(productId).orElseThrow());
            item.setWarehouse(warehouseRepository.findById(warehouseId).orElseThrow());
            item.setQuantity(quantity);
        }
        itemRepository.save(item);
    }

    private void removeStock(Long productId, Long warehouseId, int quantity) {
        Optional<InventoryItem> optItem = itemRepository.findByProductIdAndWarehouseId(productId, warehouseId);
        if (optItem.isPresent()) {
            InventoryItem item = optItem.get();
            item.setQuantity(item.getQuantity() - quantity); // Allows negative stock depending on business logic, assuming yes for now or throw exception
            itemRepository.save(item);
        } else {
            // If item doesn't exist, create it with negative stock to flag an error visually
            InventoryItem item = new InventoryItem();
            item.setProduct(productRepository.findById(productId).orElseThrow());
            item.setWarehouse(warehouseRepository.findById(warehouseId).orElseThrow());
            item.setQuantity(-quantity);
            itemRepository.save(item);
        }
    }
}

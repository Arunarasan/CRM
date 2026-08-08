package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** The 4 core inventory reports built for this phase: Summary, Valuation, Low Stock, Movement — plus per-project material cost. */
@Service
public class InventoryReportService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    @Autowired
    private InventoryTransactionRepository transactionRepository;

    @Autowired
    private ProjectMaterialRequirementRepository requirementRepository;

    @Autowired
    private TaskMaterialUsageRepository taskMaterialUsageRepository;

    @Autowired
    private TaskRepository taskRepository;

    public Map<String, Object> inventorySummary() {
        List<Product> products = productRepository.findAll();
        List<InventoryItem> items = itemRepository.findAll();

        long activeMaterials = products.stream().filter(p -> "ACTIVE".equals(p.getStatus())).count();
        int totalAvailableQty = items.stream().mapToInt(InventoryItem::getAvailableQuantity).sum();
        int totalReservedQty = items.stream().mapToInt(InventoryItem::getReservedQuantity).sum();
        int totalDamagedQty = items.stream().mapToInt(InventoryItem::getDamagedQuantity).sum();
        long lowStockCount = items.stream().filter(i -> i.getProduct().getMinStockLevel() != null
                && i.getQuantity() < i.getProduct().getMinStockLevel()).count();
        long outOfStockCount = items.stream().filter(i -> i.getAvailableQuantity() <= 0).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalMaterials", products.size());
        result.put("activeMaterials", activeMaterials);
        result.put("totalAvailableQty", totalAvailableQty);
        result.put("totalReservedQty", totalReservedQty);
        result.put("totalDamagedQty", totalDamagedQty);
        result.put("lowStockCount", lowStockCount);
        result.put("outOfStockCount", outOfStockCount);
        return result;
    }

    public List<Map<String, Object>> stockValuation() {
        return itemRepository.findAll().stream().map(item -> {
            Product product = item.getProduct();
            BigDecimal unitCost = product.getCostPrice() != null ? product.getCostPrice()
                    : (product.getPrice() != null ? product.getPrice() : BigDecimal.ZERO);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("productId", product.getId());
            row.put("materialCode", product.getMaterialCode());
            row.put("productName", product.getName());
            row.put("warehouseName", item.getWarehouse().getName());
            row.put("availableQty", item.getAvailableQuantity());
            row.put("unitCost", unitCost);
            row.put("totalValue", unitCost.multiply(BigDecimal.valueOf(item.getAvailableQuantity())));
            return row;
        }).toList();
    }

    public List<Map<String, Object>> lowStockReport() {
        return itemRepository.findLowStockItems().stream().map(item -> {
            Product product = item.getProduct();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("productId", product.getId());
            row.put("materialCode", product.getMaterialCode());
            row.put("productName", product.getName());
            row.put("warehouseName", item.getWarehouse().getName());
            row.put("currentQty", item.getQuantity());
            row.put("minStockLevel", product.getMinStockLevel());
            row.put("reorderLevel", product.getReorderLevel());
            return row;
        }).toList();
    }

    public List<InventoryTransaction> materialMovement(LocalDateTime from, LocalDateTime to) {
        if (from == null) {
            return transactionRepository.findTop50ByOrderByDateDesc();
        }
        LocalDateTime end = to != null ? to : LocalDateTime.now();
        return transactionRepository.findAll().stream()
                .filter(t -> !t.getDate().isBefore(from) && !t.getDate().isAfter(end))
                .sorted((a, b) -> b.getDate().compareTo(a.getDate()))
                .toList();
    }

    /** Actual material cost incurred by a project so far: issued requirement cost + field-logged task consumption cost. */
    public Map<String, Object> projectMaterialCost(Long projectId) {
        BigDecimal requirementCost = BigDecimal.ZERO;
        for (ProjectMaterialRequirement req : requirementRepository.findByProjectIdOrderByIdAsc(projectId)) {
            BigDecimal unitCost = req.getProduct().getCostPrice() != null ? req.getProduct().getCostPrice() : BigDecimal.ZERO;
            BigDecimal issued = req.getIssuedQty() != null ? req.getIssuedQty() : BigDecimal.ZERO;
            requirementCost = requirementCost.add(unitCost.multiply(issued));
        }

        BigDecimal taskUsageCost = BigDecimal.ZERO;
        for (Task task : taskRepository.findByProjectId(projectId)) {
            for (TaskMaterialUsage usage : taskMaterialUsageRepository.findByTaskIdOrderByUsedAtDesc(task.getId())) {
                BigDecimal unitCost = usage.getProduct().getCostPrice() != null ? usage.getProduct().getCostPrice() : BigDecimal.ZERO;
                taskUsageCost = taskUsageCost.add(unitCost.multiply(usage.getQuantityUsed()));
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("projectId", projectId);
        result.put("materialRequirementCost", requirementCost);
        result.put("taskConsumptionCost", taskUsageCost);
        result.put("totalMaterialCost", requirementCost.add(taskUsageCost));
        return result;
    }
}

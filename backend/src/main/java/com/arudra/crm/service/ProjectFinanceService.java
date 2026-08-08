package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

/**
 * Project-level cost tracking and profitability. Auto-syncs project expenses from
 * their originating documents — purchase bills, inventory consumption, contractor
 * payments — using (source, referenceId) as the idempotency key so re-syncing
 * updates rows in place instead of double-counting.
 */
@Service
public class ProjectFinanceService {

    @Autowired private ProjectExpenseRepository expenseRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private PurchaseBillRepository purchaseBillRepository;
    @Autowired private InventoryTransactionRepository inventoryTransactionRepository;
    @Autowired private ContractorPaymentRepository contractorPaymentRepository;
    @Autowired private ContractorBillRepository contractorBillRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private CustomerPaymentRepository paymentRepository;

    // =====================================================================
    // Expenses
    // =====================================================================

    public Page<ProjectExpense> getExpenses(Long projectId, int page, int size) {
        if (projectId != null) {
            return expenseRepository.findByProjectIdAndIsDeletedFalseOrderByExpenseDateDescIdDesc(
                    projectId, PageRequest.of(page, size));
        }
        return expenseRepository.findByIsDeletedFalseOrderByExpenseDateDescIdDesc(PageRequest.of(page, size));
    }

    @Transactional
    public ProjectExpense addManualExpense(ProjectExpense expense, User actingUser) {
        if (expense.getProject() == null || expense.getProject().getId() == null) {
            throw new RuntimeException("Expense needs a project");
        }
        if (expense.getAmount() == null || expense.getAmount().signum() <= 0) {
            throw new RuntimeException("Expense amount must be positive");
        }
        expense.setId(null);
        expense.setSource("MANUAL");
        if (expense.getExpenseDate() == null) expense.setExpenseDate(LocalDate.now());
        if (expense.getCategory() == null || expense.getCategory().isBlank()) expense.setCategory("MISC");
        expense.setRecordedBy(actingUser);
        ProjectExpense saved = expenseRepository.save(expense);
        updateProjectActualCost(expense.getProject().getId());
        return saved;
    }

    @Transactional
    public void deleteExpense(Long id) {
        expenseRepository.findById(id).ifPresent(e -> {
            if (!"MANUAL".equals(e.getSource())) {
                throw new RuntimeException("Auto-synced expenses are managed by their source document");
            }
            e.setIsDeleted(true);
            e.setDeletedAt(java.time.LocalDateTime.now());
            expenseRepository.save(e);
            updateProjectActualCost(e.getProject().getId());
        });
    }

    /**
     * Pulls every cost document for the project into project_expenses.
     * Safe to run any number of times.
     */
    @Transactional
    public Map<String, Object> syncProjectExpenses(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));
        int synced = 0;

        // 1. Purchase bills raised against POs of this project -> MATERIAL cost
        for (PurchaseBill bill : purchaseBillRepository.findByPurchaseOrderProjectIdAndIsDeletedFalse(projectId)) {
            upsert(project, "MATERIAL", "PURCHASE_BILL", "PURCHASE_BILL", bill.getId(),
                    "Purchase bill " + bill.getBillNumber() +
                            (bill.getSupplier() != null ? " — " + bill.getSupplier().getName() : ""),
                    bill.getTotalAmount(), bill.getDate(),
                    bill.getSupplier() != null ? bill.getSupplier().getName() : null);
            synced++;
        }

        // 2. Inventory consumed on the project -> MATERIAL cost at product cost price
        for (InventoryTransaction tx : inventoryTransactionRepository.findByTypeAndProjectId("CONSUMPTION", projectId)) {
            BigDecimal unitCost = productCost(tx.getProduct());
            if (unitCost == null || tx.getQuantity() == null) continue;
            BigDecimal value = unitCost.multiply(BigDecimal.valueOf(tx.getQuantity()));
            upsert(project, "MATERIAL", "INVENTORY_CONSUMPTION", "INVENTORY_TXN", tx.getId(),
                    "Material consumed: " + (tx.getProduct() != null ? tx.getProduct().getName() : "item")
                            + " x " + tx.getQuantity(),
                    value, tx.getDate() != null ? tx.getDate().toLocalDate() : LocalDate.now(), null);
            synced++;
        }

        // 3a. Approved contractor bills -> CONTRACTOR (labour) cost, on accrual.
        // The bill is the cost event; the payments that settle it are cash movements, so
        // billed work is counted here and settled payments are deliberately skipped below.
        for (ContractorBill bill : contractorBillRepository.findByProjectIdOrderByIdDesc(projectId)) {
            if (Boolean.TRUE.equals(bill.getIsDeleted())) continue;
            if (!List.of("FINANCE_APPROVED", "PARTIALLY_PAID", "PAID").contains(bill.getStatus())) continue;
            upsert(project, "CONTRACTOR", "CONTRACTOR_BILL", "CONTRACTOR_BILL", bill.getId(),
                    "Contractor bill " + bill.getBillNumber()
                            + (bill.getContractor() != null ? " — " + bill.getContractor().getName() : "")
                            + (bill.getWorkPackage() != null ? " (" + bill.getWorkPackage().getPackageCode() + ")" : ""),
                    bill.getNetAmount(), bill.getBillDate(),
                    bill.getContractor() != null ? bill.getContractor().getName() : null);
            synced++;
        }

        // 3b. Contractor payments with no bill behind them — legacy direct payments only.
        // Advances and retention releases are cash timing, not cost, so they never book here.
        for (ContractorPayment cp : contractorPaymentRepository.findByProjectIdAndStatus(projectId, "PAID")) {
            if (cp.getBill() != null) continue;
            if ("ADVANCE".equals(cp.getPaymentType()) || "RETENTION_RELEASE".equals(cp.getPaymentType())) continue;
            upsert(project, "CONTRACTOR", "CONTRACTOR_PAYMENT", "CONTRACTOR_PAYMENT", cp.getId(),
                    "Contractor payment" + (cp.getContractor() != null ? " — " + cp.getContractor().getName() : ""),
                    cp.getAmount(), cp.getPaymentDate() != null ? cp.getPaymentDate() : LocalDate.now(),
                    cp.getContractor() != null ? cp.getContractor().getName() : null);
            synced++;
        }

        BigDecimal total = updateProjectActualCost(projectId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("projectId", projectId);
        result.put("documentsSynced", synced);
        result.put("totalExpenses", total);
        return result;
    }

    private BigDecimal productCost(Product product) {
        if (product == null) return null;
        if (product.getCostPrice() != null) return product.getCostPrice();
        if (product.getPurchasePrice() != null) return product.getPurchasePrice();
        return product.getPrice();
    }

    private void upsert(Project project, String category, String source, String referenceType, Long referenceId,
                        String description, BigDecimal amount, LocalDate date, String vendor) {
        if (amount == null) return;
        ProjectExpense expense = expenseRepository.findBySourceAndReferenceIdAndIsDeletedFalse(source, referenceId)
                .orElseGet(ProjectExpense::new);
        expense.setProject(project);
        expense.setCategory(category);
        expense.setSource(source);
        expense.setReferenceType(referenceType);
        expense.setReferenceId(referenceId);
        expense.setDescription(description);
        expense.setAmount(amount);
        expense.setExpenseDate(date);
        expense.setVendor(vendor);
        expenseRepository.save(expense);
    }

    private BigDecimal updateProjectActualCost(Long projectId) {
        BigDecimal total = expenseRepository.totalForProject(projectId);
        projectRepository.findById(projectId).ifPresent(p -> {
            p.setActualCost(total);
            projectRepository.save(p);
        });
        return total;
    }

    // =====================================================================
    // Profitability
    // =====================================================================

    /** Full financial picture of one project: estimate vs revenue vs cost vs profit. */
    public Map<String, Object> getProjectProfitability(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found: " + projectId));
        syncProjectExpenses(projectId);
        return buildProfitability(project);
    }

    /** Profitability rows for every project (list view; no per-project re-sync). */
    public List<Map<String, Object>> getAllProjectProfitability() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Project p : projectRepository.findAll()) {
            if (Boolean.TRUE.equals(p.getIsDeleted())) continue;
            rows.add(buildProfitability(p));
        }
        rows.sort((a, b) -> ((BigDecimal) b.get("revenue")).compareTo((BigDecimal) a.get("revenue")));
        return rows;
    }

    private Map<String, Object> buildProfitability(Project project) {
        Long projectId = project.getId();

        BigDecimal quotationValue = project.getQuotation() != null && project.getQuotation().getGrandTotal() != null
                ? project.getQuotation().getGrandTotal()
                : (project.getBudget() != null ? project.getBudget() : BigDecimal.ZERO);

        BigDecimal invoiced = BigDecimal.ZERO;
        for (Invoice i : invoiceRepository.findByProjectId(projectId)) {
            if (Boolean.TRUE.equals(i.getIsDeleted())) continue;
            if ("DRAFT".equals(i.getStatus()) || "CANCELLED".equals(i.getStatus())) continue;
            invoiced = invoiced.add(i.getTotalAmount());
        }
        BigDecimal collected = paymentRepository.sumConfirmedForProject(projectId);

        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (Object[] row : expenseRepository.totalsByCategoryForProject(projectId)) {
            byCategory.put((String) row[0], (BigDecimal) row[1]);
        }
        BigDecimal totalExpenses = byCategory.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal materialCost = byCategory.getOrDefault("MATERIAL", BigDecimal.ZERO);
        BigDecimal labourCost = byCategory.getOrDefault("LABOUR", BigDecimal.ZERO)
                .add(byCategory.getOrDefault("CONTRACTOR", BigDecimal.ZERO));
        BigDecimal directCost = materialCost.add(labourCost);

        BigDecimal grossProfit = invoiced.subtract(directCost);
        BigDecimal netProfit = invoiced.subtract(totalExpenses);
        BigDecimal profitPercent = invoiced.signum() == 0 ? BigDecimal.ZERO
                : netProfit.multiply(BigDecimal.valueOf(100)).divide(invoiced, 2, RoundingMode.HALF_UP);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("projectId", projectId);
        result.put("projectName", project.getProjectName());
        result.put("projectStatus", project.getStatus());
        result.put("customerName", project.getCustomer() != null ? project.getCustomer().getName() : null);
        result.put("quotationValue", quotationValue);
        result.put("budget", project.getBudget());
        result.put("estimatedCost", project.getEstimatedCost());
        result.put("revenue", invoiced);
        result.put("collected", collected);
        result.put("outstanding", invoiced.subtract(collected).max(BigDecimal.ZERO));
        result.put("materialCost", materialCost);
        result.put("labourCost", labourCost);
        result.put("expensesByCategory", byCategory);
        result.put("totalExpenses", totalExpenses);
        result.put("grossProfit", grossProfit);
        result.put("netProfit", netProfit);
        result.put("profitPercent", profitPercent);
        return result;
    }
}

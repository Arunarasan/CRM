package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Quote changes on a running project — the project's "Measurement &amp; Quotation" tab. The customer's
 * change is made on the project's own price sheet (unlocked in place) and, once the customer approves
 * it, applied to the SAME project: no second project is ever created.
 * <ul>
 *   <li>{@link #startChange}: unlocks the sheet. The project keeps its current quotation until approval.</li>
 *   <li>{@link #approveChange}: the change quotation (new number) becomes the project's quotation; the
 *       old one is marked REVISED. Rooms/work items, the execution checklist, the Supply &amp; Install
 *       list, the budget, unbilled payment milestones and contractor packages follow the new scope.</li>
 * </ul>
 * Lines already worked on site can't be removed (BoqService guards that while the sheet is edited).
 */
@Service
public class ProjectQuoteChangeService {

    private static final Set<String> CLOSED_STATUSES = Set.of("COMPLETED", "CANCELLED", "CLOSED");

    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final BoqService boqService;
    private final QuoteWorkspaceService quoteWorkspaceService;
    private final QuotationService quotationService;
    private final QuotationRepository quotationRepository;
    private final ProjectMaterialRequirementRepository requirementRepository;
    private final BoqItemMaterialRepository boqItemMaterialRepository;
    private final QuoteProductLinker quoteProductLinker;
    private final ProductRepository productRepository;
    private final InventoryService inventoryService;
    private final PaymentScheduleRepository scheduleRepository;
    private final CustomerPaymentRepository customerPaymentRepository;
    private final ProjectActivityLogRepository activityLogRepository;
    private final NotificationService notificationService;
    private final WorkPackageService workPackageService;

    public ProjectQuoteChangeService(ProjectRepository projectRepository, ProjectService projectService,
                                     BoqService boqService, QuoteWorkspaceService quoteWorkspaceService,
                                     QuotationService quotationService, QuotationRepository quotationRepository,
                                     ProjectMaterialRequirementRepository requirementRepository,
                                     BoqItemMaterialRepository boqItemMaterialRepository,
                                     QuoteProductLinker quoteProductLinker, ProductRepository productRepository,
                                     InventoryService inventoryService,
                                     PaymentScheduleRepository scheduleRepository,
                                     CustomerPaymentRepository customerPaymentRepository,
                                     ProjectActivityLogRepository activityLogRepository,
                                     NotificationService notificationService, WorkPackageService workPackageService) {
        this.projectRepository = projectRepository;
        this.projectService = projectService;
        this.boqService = boqService;
        this.quoteWorkspaceService = quoteWorkspaceService;
        this.quotationService = quotationService;
        this.quotationRepository = quotationRepository;
        this.requirementRepository = requirementRepository;
        this.boqItemMaterialRepository = boqItemMaterialRepository;
        this.quoteProductLinker = quoteProductLinker;
        this.productRepository = productRepository;
        this.inventoryService = inventoryService;
        this.scheduleRepository = scheduleRepository;
        this.customerPaymentRepository = customerPaymentRepository;
        this.activityLogRepository = activityLogRepository;
        this.notificationService = notificationService;
        this.workPackageService = workPackageService;
    }

    /** Where the project's quote stands — drives the project tab's banner and buttons. */
    @Transactional(readOnly = true)
    public Map<String, Object> status(Long projectId) {
        Project project = projectService.getProjectById(projectId);
        Boq boq = project.getBoq();
        Quotation quote = project.getQuotation();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projectId", project.getId());
        out.put("projectCode", project.getProjectCode());
        out.put("boqId", boq != null ? boq.getId() : null);
        out.put("quotationId", quote != null ? quote.getId() : null);
        out.put("quotationNumber", quote != null ? quote.getQuotationNumber() : null);
        out.put("contractValue", quote != null ? quote.getGrandTotal() : project.getBudget());
        out.put("changeOpen", boq != null && !"APPROVED".equals(boq.getStatus()));
        out.put("canChange", boq != null && quote != null && !isClosed(project));
        return out;
    }

    /** Unlocks the project's sheet for a change. Safe to call again while a change is already open. */
    @Transactional
    public Map<String, Object> startChange(Long projectId, User user) {
        Project project = projectService.getProjectById(projectId);
        if (isClosed(project)) {
            throw new IllegalStateException("Project " + project.getProjectCode() + " is " + project.getStatus().toLowerCase()
                    + " — its quote can no longer be changed.");
        }
        if (project.getBoq() == null || project.getQuotation() == null) {
            throw new IllegalStateException("This project wasn't built from a quote, so there is no price sheet to change.");
        }
        if ("APPROVED".equals(project.getBoq().getStatus())) {
            boqService.unlockForProjectChange(project.getBoq().getId(), user);
            log(project, user, "Quote change started on " + project.getQuotation().getQuotationNumber()
                    + " — waiting for the customer's approval.");
        }
        return status(projectId);
    }

    /**
     * The customer approved the change: the sheet's change quotation becomes the project's quotation and
     * the project is brought in line with it. Returns a summary of what changed.
     */
    @Transactional
    public Map<String, Object> approveChange(Long projectId, User user) {
        Project project = projectService.getProjectById(projectId);
        Boq boq = project.getBoq();
        Quotation oldQuote = project.getQuotation();
        if (boq == null || oldQuote == null) {
            throw new IllegalStateException("This project wasn't built from a quote, so there is no change to approve.");
        }
        if ("APPROVED".equals(boq.getStatus())) {
            throw new IllegalStateException("No quote change is in progress — press \"Make changes\" first.");
        }
        // Nothing was actually edited: just lock the sheet again — no new quotation number for nothing.
        if (sheetMatchesQuote(boq, oldQuote)) {
            closeUnchanged(project, boq, oldQuote, user);
            Map<String, Object> out = new LinkedHashMap<>(status(projectId));
            out.put("unchanged", true);
            return out;
        }
        BigDecimal oldTotal = nz(oldQuote.getGrandTotal());
        Map<Long, BigDecimal> oldLinked = quoteLinkedPlan(oldQuote.getItems());

        // 1. The change quotation (synced with the sheet one last time) → approved, the project's quote.
        Quotation live = quoteWorkspaceService.liveQuote(boq.getId(), user);
        Quotation newQuote = quotationService.approveProjectChange(live.getId(), project, user);
        oldQuote.setStatus("REVISED");
        quotationRepository.save(oldQuote);
        boqService.approveProjectChange(boq.getId(), user);

        project.setQuotation(newQuote);
        project.setBudget(newQuote.getItems().stream()
                .map(i -> nz(i.getTotalAmount())).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(QuotationService.quoteLevelCharges(newQuote)));
        projectRepository.save(project);

        // 2. Rooms / work items (progress kept, moved lines follow, dropped lines cancelled) + checklist.
        Map<String, BigDecimal> requiredBefore = new HashMap<>();
        requirementRepository.findByProjectIdOrderByIdAsc(projectId)
                .forEach(r -> requiredBefore.put(String.valueOf(r.getId()), nz(r.getRequiredQty())));
        Map<String, Object> structure = projectService.reconcileProjectWithBoq(projectId, user, false);
        projectService.seedExecutionChecklist(projectId, true);

        // 3. Supply & Install list: quote-linked products follow the new quote; bought-but-dropped flagged.
        Map<Long, BigDecimal> newLinked = quoteLinkedPlan(newQuote.getItems());
        int[] supply = applySupplyChanges(project, oldLinked, newLinked, requiredBefore, newQuote.getQuotationNumber());

        // 4. Money: unbilled milestones re-scaled to the new total; overpayment surfaced, not refunded.
        BigDecimal newTotal = nz(newQuote.getGrandTotal());
        int milestones = rescaleUnbilledMilestones(projectId, newTotal);
        BigDecimal collected = nz(customerPaymentRepository.sumConfirmedForProject(projectId));
        BigDecimal excessPaid = collected.subtract(newTotal).max(BigDecimal.ZERO);

        // 5. Contractor packages: value moved → a PENDING variation for the PM (non-fatal).
        try {
            workPackageService.reconcileWithBoqRevision(projectId, null,
                    "Quote change " + oldQuote.getQuotationNumber() + " → " + newQuote.getQuotationNumber(), user);
        } catch (Exception e) {
            log(project, user, "Quote change applied, but contractor work package check failed: " + e.getMessage());
        }

        Map<String, Integer> lines = compareLines(oldQuote.getItems(), newQuote.getItems());
        BigDecimal diff = newTotal.subtract(oldTotal);
        String message = "Customer approved quote change " + oldQuote.getQuotationNumber() + " → " + newQuote.getQuotationNumber()
                + ": " + rupees(oldTotal) + " → " + rupees(newTotal) + " (" + (diff.signum() >= 0 ? "+" : "−") + rupees(diff.abs()) + "); "
                + lines.get("added") + " added, " + lines.get("removed") + " removed, " + lines.get("changed") + " changed."
                + (excessPaid.signum() > 0 ? " Customer has paid " + rupees(excessPaid) + " more than the new total." : "");
        log(project, user, message);
        if (project.getProjectManager() != null && (user == null || !project.getProjectManager().getId().equals(user.getId()))) {
            notificationService.dispatch("Quote changed", project.getProjectCode() + ": " + message,
                    "PROJECT", project.getProjectManager().getId(), "/projects/" + projectId + "?tab=quote");
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projectId", projectId);
        out.put("oldQuotationNumber", oldQuote.getQuotationNumber());
        out.put("newQuotationId", newQuote.getId());
        out.put("newQuotationNumber", newQuote.getQuotationNumber());
        out.put("oldTotal", oldTotal);
        out.put("newTotal", newTotal);
        out.put("difference", diff);
        out.put("itemsAdded", lines.get("added"));
        out.put("itemsRemoved", lines.get("removed"));
        out.put("itemsChanged", lines.get("changed"));
        out.put("workItemsCreated", structure.get("itemsCreated"));
        out.put("workItemsCancelled", structure.get("itemsCancelled"));
        out.put("supplyUpdated", supply[0]);
        out.put("supplyFlagged", supply[1]);
        out.put("milestonesRescaled", milestones);
        out.put("collected", collected);
        out.put("excessPaid", excessPaid);
        return out;
    }

    /**
     * Closes an open change without applying anything — only while the sheet still matches the project's
     * quote, so edits are never silently thrown away.
     */
    @Transactional
    public Map<String, Object> discardChange(Long projectId, User user) {
        Project project = projectService.getProjectById(projectId);
        Boq boq = project.getBoq();
        Quotation quote = project.getQuotation();
        if (boq == null || quote == null || "APPROVED".equals(boq.getStatus())) return status(projectId);
        if (!sheetMatchesQuote(boq, quote)) {
            throw new IllegalStateException("The sheet has changes. Approve them with the customer, or undo them first.");
        }
        closeUnchanged(project, boq, quote, user);
        return status(projectId);
    }

    private void closeUnchanged(Project project, Boq boq, Quotation projectQuote, User user) {
        // A quotation printed during the change is identical to the project's — retire it.
        for (Quotation q : quotationRepository.findByBoq_IdOrderByIdDesc(boq.getId())) {
            if (!q.getId().equals(projectQuote.getId()) && QuotationService.isLive(q)) {
                q.setStatus("REVISED");
                quotationRepository.save(q);
            }
        }
        boqService.relockProjectSheet(boq.getId(), projectQuote, user);
        log(project, user, "Quote change closed — nothing was changed; the project stays on " + projectQuote.getQuotationNumber() + ".");
    }

    /** Same lines (by sheet line: name, quantity, amount) and the same final price as the project's quote. */
    private static boolean sheetMatchesQuote(Boq boq, Quotation quote) {
        // Quote lines are rate × qty rounded to paise, so allow a rupee of rounding.
        if (!near(boq.getGrandTotal(), quote.getGrandTotal())) return false;
        Map<Long, QuotationItem> quoted = new HashMap<>();
        for (QuotationItem i : quote.getItems()) {
            if (i.getBoqItemId() != null && !"REJECTED".equals(i.getStatus())) quoted.put(i.getBoqItemId(), i);
        }
        int active = 0;
        for (BoqItem item : boq.getItems()) {
            if (Boolean.FALSE.equals(item.getIsActive())) continue;
            active++;
            QuotationItem q = quoted.get(item.getId());
            if (q == null || !near(q.getTotalAmount(), item.getAmount())
                    || nz(q.getQuantity()).compareTo(nz(item.getQuantity())) != 0
                    || !Objects.equals(q.getItemName(), item.getItemName())
                    || !Objects.equals(Objects.toString(q.getDescription(), ""), Objects.toString(item.getDescription(), ""))) {
                return false;
            }
        }
        return active == quoted.size();
    }

    // ---------------------------------------------------------------------------------------------

    private boolean isClosed(Project project) {
        return project.getStatus() != null && CLOSED_STATUSES.contains(project.getStatus().toUpperCase());
    }

    /**
     * Products the Supply &amp; Install list takes from the quote lines by name (lines whose BOQ materials
     * aren't tied to a product) — the same rule conversion uses. BOQ-material products are left to
     * {@link ProjectService#reconcileProjectWithBoq}.
     */
    private Map<Long, BigDecimal> quoteLinkedPlan(List<QuotationItem> items) {
        Set<Long> boqProducts = new HashSet<>();
        for (QuotationItem q : items) {
            if (q.getBoqItemId() == null || "REJECTED".equals(q.getStatus())) continue;
            for (BoqItemMaterial m : boqItemMaterialRepository.findByItemId(q.getBoqItemId())) {
                if (m.getProduct() != null) boqProducts.add(m.getProduct().getId());
            }
        }
        List<QuotationItem> inScope = items.stream().filter(i -> !"REJECTED".equals(i.getStatus())).toList();
        Map<Long, BigDecimal> plan = new LinkedHashMap<>();
        for (QuoteProductLinker.Line line : quoteProductLinker.resolve(inScope, true)) {
            if (!line.matched() || boqProducts.contains(line.product().getId())) continue;
            plan.merge(line.product().getId(), nz(line.quantity()), BigDecimal::add);
        }
        return plan;
    }

    /** Returns {rows updated or added, rows flagged as bought-but-no-longer-needed}. */
    private int[] applySupplyChanges(Project project, Map<Long, BigDecimal> oldLinked, Map<Long, BigDecimal> newLinked,
                                     Map<String, BigDecimal> requiredBefore, String quoteNumber) {
        int updated = 0, flagged = 0;
        List<ProjectMaterialRequirement> rows = requirementRepository.findByProjectIdOrderByIdAsc(project.getId());
        Map<Long, ProjectMaterialRequirement> byProduct = new LinkedHashMap<>();
        for (ProjectMaterialRequirement r : rows) {
            if (r.getProduct() != null) byProduct.putIfAbsent(r.getProduct().getId(), r);
        }

        for (Map.Entry<Long, BigDecimal> e : newLinked.entrySet()) {
            ProjectMaterialRequirement row = byProduct.get(e.getKey());
            if (row == null) {
                row = new ProjectMaterialRequirement();
                row.setProject(project);
                Product product = productRepository.findById(e.getKey()).orElse(null);
                if (product == null) continue;
                row.setProduct(product);
                row.setUnit(product.getUnit());
                row.setRemarks("Added by quote change " + quoteNumber);
            } else if (!ProjectService.isQuoteLinkedRequirement(row)) {
                continue; // a BOQ-material or hand-made row — not ours to overwrite
            }
            if (row.getId() != null && nz(row.getRequiredQty()).compareTo(e.getValue()) == 0) continue;
            row.setRequiredQty(e.getValue());
            requirementRepository.save(row);
            updated++;
        }

        // Dropped from the quote: free it if nothing was bought yet, otherwise keep and flag it.
        for (ProjectMaterialRequirement row : rows) {
            if (row.getProduct() == null) continue;
            Long productId = row.getProduct().getId();
            boolean droppedLinked = oldLinked.containsKey(productId) && !newLinked.containsKey(productId)
                    && ProjectService.isQuoteLinkedRequirement(row);
            BigDecimal before = requiredBefore.getOrDefault(String.valueOf(row.getId()), BigDecimal.ZERO);
            boolean droppedByBoq = before.signum() > 0 && nz(row.getRequiredQty()).signum() == 0;
            if (!droppedLinked && !droppedByBoq) continue;
            if (isBought(row)) {
                row.setRemarks("Removed from the quote (" + quoteNumber + ") but already bought — return it or use it elsewhere.");
                flagged++;
            } else {
                row.setRequiredQty(BigDecimal.ZERO);
                if (nz(row.getReservedQty()).signum() > 0) {
                    try {
                        inventoryService.releaseReservation(productId, row.getReservedQty().intValue(),
                                "PROJECT_MATERIAL_REQUIREMENT", row.getId());
                        row.setReservedQty(BigDecimal.ZERO);
                    } catch (Exception ignored) {
                        // stock bookkeeping must never block the customer's change
                    }
                }
                if (droppedLinked) row.setRemarks("No longer in the quote (" + quoteNumber + ").");
                updated++;
            }
            requirementRepository.save(row);
        }
        return new int[]{updated, flagged};
    }

    private static boolean isBought(ProjectMaterialRequirement r) {
        return r.getPurchaseOrder() != null || nz(r.getIssuedQty()).signum() > 0
                || nz(r.getInstalledQty()).signum() > 0 || nz(r.getConsumedQty()).signum() > 0;
    }

    /** Milestones not yet invoiced follow the new contract value; billed ones stay exactly as they are. */
    private int rescaleUnbilledMilestones(Long projectId, BigDecimal newTotal) {
        int count = 0;
        for (PaymentSchedule s : scheduleRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId)) {
            if (s.getInvoice() != null || !"PENDING".equalsIgnoreCase(s.getStatus()) || s.getPercentage() == null) continue;
            BigDecimal amount = newTotal.multiply(s.getPercentage()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            if (amount.compareTo(nz(s.getAmount())) == 0) continue;
            s.setAmount(amount);
            scheduleRepository.save(s);
            count++;
        }
        return count;
    }

    /** Line differences between two quotations, matched by their sheet line. */
    private static Map<String, Integer> compareLines(List<QuotationItem> before, List<QuotationItem> after) {
        Map<Long, QuotationItem> old = new HashMap<>();
        before.stream().filter(i -> i.getBoqItemId() != null && !"REJECTED".equals(i.getStatus()))
                .forEach(i -> old.put(i.getBoqItemId(), i));
        int added = 0, changed = 0;
        Set<Long> seen = new HashSet<>();
        for (QuotationItem i : after) {
            if (i.getBoqItemId() == null || "REJECTED".equals(i.getStatus())) continue;
            seen.add(i.getBoqItemId());
            QuotationItem was = old.get(i.getBoqItemId());
            if (was == null) added++;
            else if (nz(was.getTotalAmount()).compareTo(nz(i.getTotalAmount())) != 0
                    || nz(was.getQuantity()).compareTo(nz(i.getQuantity())) != 0
                    || !Objects.equals(was.getItemName(), i.getItemName())) changed++;
        }
        int removed = (int) old.keySet().stream().filter(id -> !seen.contains(id)).count();
        return Map.of("added", added, "removed", removed, "changed", changed);
    }

    private void log(Project project, User user, String description) {
        ProjectActivityLog entry = new ProjectActivityLog();
        entry.setProject(project);
        entry.setUser(user);
        entry.setRole("Quote change");
        entry.setDescription(description);
        activityLogRepository.save(entry);
    }

    private static String rupees(BigDecimal v) {
        return "₹" + String.format(Locale.ENGLISH, "%,.2f", v);
    }

    private static boolean near(BigDecimal a, BigDecimal b) {
        return nz(a).subtract(nz(b)).abs().compareTo(BigDecimal.ONE) <= 0;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}

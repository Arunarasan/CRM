package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

/**
 * Supply & Install tracker for a project: every material the project needs moves
 * To Buy → Ordered → Received → At Site → Installed. Reads the existing purchase-order,
 * goods-receipt and project stock-out data (nothing is duplicated) and adds two actions:
 * buy selected items (one PO per supplier, tagged with the project) and mark quantities installed.
 */
@Service
@RequiredArgsConstructor
public class SupplyInstallService {

    private static final Set<String> DEAD_PO = Set.of("CANCELLED", "REJECTED");
    private static final Set<String> OPEN_PO = Set.of("DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "CONFIRMED", "PARTIAL");

    private final ProjectService projectService;
    private final PurchaseService purchaseService;
    private final ProjectMaterialRequirementRepository requirementRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final ProductSupplierRepository productSupplierRepository;
    private final SupplierRepository supplierRepository;
    private final QuoteProductLinker quoteProductLinker;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getBoard(Long projectId) {
        Project project = projectService.getProjectById(projectId);
        List<ProjectMaterialRequirement> reqs = requirementRepository.findByProjectIdOrderByIdAsc(projectId);
        List<PurchaseOrder> orders = purchaseOrderRepository.findByProjectIdOrderByIdDesc(projectId).stream()
                .filter(po -> !DEAD_PO.contains(String.valueOf(po.getStatus()).toUpperCase()))
                .toList();

        // Ordered / received per product across this project's live purchase orders.
        Map<Long, BigDecimal> orderedLeft = new HashMap<>();
        Map<Long, BigDecimal> receivedLeft = new HashMap<>();
        Map<Long, List<Map<String, Object>>> ordersByProduct = new HashMap<>();
        BigDecimal purchaseCost = BigDecimal.ZERO;
        List<Map<String, Object>> lateOrders = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (PurchaseOrder po : orders) {
            for (PurchaseOrderItem item : purchaseOrderItemRepository.findByPurchaseOrderId(po.getId())) {
                if (item.getProduct() == null) continue;
                Long pid = item.getProduct().getId();
                BigDecimal qty = BigDecimal.valueOf(nzi(item.getQuantity()));
                BigDecimal rec = BigDecimal.valueOf(nzi(item.getReceivedQuantity()));
                orderedLeft.merge(pid, qty, BigDecimal::add);
                receivedLeft.merge(pid, rec, BigDecimal::add);
                purchaseCost = purchaseCost.add(nz(item.getTotalPrice()));
                Map<String, Object> o = new LinkedHashMap<>();
                o.put("id", po.getId());
                o.put("poNumber", po.getPoNumber());
                o.put("status", po.getStatus());
                o.put("supplierName", po.getSupplier() != null ? po.getSupplier().getName() : null);
                o.put("expectedDeliveryDate", po.getExpectedDeliveryDate());
                o.put("quantity", qty);
                o.put("received", rec);
                ordersByProduct.computeIfAbsent(pid, k -> new ArrayList<>()).add(o);
            }
            if (po.getExpectedDeliveryDate() != null && po.getExpectedDeliveryDate().isBefore(today)
                    && OPEN_PO.contains(String.valueOf(po.getStatus()).toUpperCase())) {
                Map<String, Object> late = new LinkedHashMap<>();
                late.put("id", po.getId());
                late.put("poNumber", po.getPoNumber());
                late.put("supplierName", po.getSupplier() != null ? po.getSupplier().getName() : null);
                late.put("expectedDeliveryDate", po.getExpectedDeliveryDate());
                late.put("daysLate", java.time.temporal.ChronoUnit.DAYS.between(po.getExpectedDeliveryDate(), today));
                lateOrders.add(late);
            }
        }

        Map<Long, String> colours = colourBreakdown(project);
        List<Map<String, Object>> rows = new ArrayList<>();
        int needed = 0, toBuy = 0, ordered = 0, received = 0, atSite = 0, installed = 0;
        for (ProjectMaterialRequirement r : reqs) {
            Product p = r.getProduct();
            if (p == null) continue;
            Long pid = p.getId();
            BigDecimal required = nz(r.getRequiredQty());
            BigDecimal sent = nz(r.getIssuedQty()).subtract(nz(r.getReturnedQty())).max(BigDecimal.ZERO);
            BigDecimal inst = nz(r.getInstalledQty());

            // A product can sit on several requirement rows (one per phase): hand out the PO
            // quantities to them in order so they're not double-counted.
            BigDecimal remainingNeed = required.subtract(sent).max(BigDecimal.ZERO);
            BigDecimal ord = take(orderedLeft, pid, remainingNeed);
            BigDecimal rec = take(receivedLeft, pid, ord);

            int stock = inventoryItemRepository.findByProductId(pid).stream()
                    .mapToInt(i -> Math.max(0, i.getAvailableQuantity())).sum();
            BigDecimal suggestedBuy = remainingNeed.subtract(ord).subtract(BigDecimal.valueOf(stock)).max(BigDecimal.ZERO);

            String stage;
            if (required.signum() <= 0) stage = "NOT_NEEDED";
            else if (inst.compareTo(required) >= 0) stage = "INSTALLED";
            else if (sent.compareTo(required) >= 0) stage = "AT_SITE";
            else if (ord.signum() > 0 && rec.compareTo(ord) >= 0) stage = "RECEIVED";
            else if (ord.signum() > 0) stage = "ORDERED";
            else if (stock > 0 && BigDecimal.valueOf(stock).compareTo(remainingNeed) >= 0) stage = "IN_STOCK";
            else stage = "TO_BUY";

            if (required.signum() > 0) {
                needed++;
                switch (stage) {
                    case "INSTALLED" -> { installed++; atSite++; received++; ordered++; }
                    case "AT_SITE" -> { atSite++; received++; ordered++; }
                    case "RECEIVED", "IN_STOCK" -> { received++; ordered++; }
                    case "ORDERED" -> ordered++;
                    default -> toBuy++;
                }
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("requirementId", r.getId());
            row.put("productId", pid);
            row.put("productName", p.getName());
            row.put("productCode", p.getMaterialCode());
            row.put("colors", colours.get(pid));
            row.put("imageUrl", p.getImageUrl());
            row.put("unit", r.getUnit() != null ? r.getUnit() : p.getUnit());
            row.put("phaseName", r.getPhase() != null ? r.getPhase().getName() : null);
            row.put("required", required);
            row.put("inStock", stock);
            row.put("ordered", ord);
            row.put("received", rec);
            row.put("sentToSite", sent);
            row.put("installed", inst);
            row.put("suggestedBuy", suggestedBuy.setScale(0, RoundingMode.CEILING));
            row.put("unitCost", p.getCostPrice());
            row.put("stage", stage);
            row.put("supplierName", preferredSupplier(p).map(Supplier::getName).orElse(null));
            row.put("orders", ordersByProduct.getOrDefault(pid, List.of()));
            rows.add(row);
        }

        BigDecimal quoted = project.getQuotation() != null && project.getQuotation().getGrandTotal() != null
                ? project.getQuotation().getGrandTotal() : nz(project.getBudget());

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("items", needed);
        summary.put("toBuy", toBuy);
        summary.put("ordered", ordered);
        summary.put("received", received);
        summary.put("atSite", atSite);
        summary.put("installed", installed);
        summary.put("readyToInstall", needed > 0 && atSite == needed);
        summary.put("quotedValue", quoted);
        summary.put("purchaseCost", purchaseCost);
        summary.put("margin", quoted.subtract(purchaseCost));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rows", rows);
        out.put("summary", summary);
        out.put("lateOrders", lateOrders);
        out.put("siteAddress", project.getPropertyAddress());
        out.put("hasQuote", project.getQuotation() != null);
        out.put("unlinked", unlinkedQuoteLines(project));
        return out;
    }

    /**
     * Buys the selected materials: groups lines by supplier (chosen, else the product's preferred
     * supplier) and raises one DRAFT purchase order per supplier, tagged with this project.
     */
    @Transactional
    public List<PurchaseOrder> purchase(Long projectId, Map<String, Object> body) {
        Project project = projectService.getProjectById(projectId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lines = (List<Map<String, Object>>) body.getOrDefault("lines", List.of());
        if (lines.isEmpty()) throw new IllegalArgumentException("Pick at least one item to buy");
        boolean deliverToSite = Boolean.TRUE.equals(body.get("deliverToSite"));
        LocalDate expected = body.get("expectedDeliveryDate") != null && !String.valueOf(body.get("expectedDeliveryDate")).isBlank()
                ? LocalDate.parse(String.valueOf(body.get("expectedDeliveryDate"))) : null;

        Map<Long, String> colours = colourBreakdown(project);
        Map<Long, List<String>> colourNotesBySupplier = new LinkedHashMap<>();
        Map<Long, Supplier> suppliers = new LinkedHashMap<>();
        Map<Long, List<PurchaseOrderItem>> itemsBySupplier = new LinkedHashMap<>();
        Map<Long, List<ProjectMaterialRequirement>> reqsBySupplier = new LinkedHashMap<>();
        List<String> missingSupplier = new ArrayList<>();

        for (Map<String, Object> line : lines) {
            Long reqId = toLong(line.get("requirementId"));
            ProjectMaterialRequirement req = requirementRepository.findById(reqId)
                    .orElseThrow(() -> new IllegalArgumentException("Material not found"));
            if (!req.getProject().getId().equals(projectId)) throw new IllegalArgumentException("Material belongs to another project");
            BigDecimal qtyIn = line.get("quantity") != null ? new BigDecimal(String.valueOf(line.get("quantity"))) : BigDecimal.ZERO;
            int qty = qtyIn.setScale(0, RoundingMode.CEILING).intValue();
            if (qty <= 0) continue;

            Product product = req.getProduct();
            Long supplierId = toLong(line.get("supplierId"));
            Optional<Supplier> supplier = supplierId != null ? supplierRepository.findById(supplierId) : preferredSupplier(product);
            if (supplier.isEmpty()) {
                missingSupplier.add(product.getName());
                continue;
            }
            Supplier s = supplier.get();
            BigDecimal price = productSupplierRepository.findByProductId(product.getId()).stream()
                    .filter(ps -> ps.getSupplier() != null && ps.getSupplier().getId().equals(s.getId()) && ps.getPurchasePrice() != null)
                    .map(ProductSupplier::getPurchasePrice).findFirst()
                    .orElse(nz(product.getCostPrice()));

            PurchaseOrderItem item = new PurchaseOrderItem();
            item.setProduct(product);
            item.setQuantity(qty);
            item.setUnitPrice(price);
            item.setTotalPrice(price.multiply(BigDecimal.valueOf(qty)));
            suppliers.put(s.getId(), s);
            itemsBySupplier.computeIfAbsent(s.getId(), k -> new ArrayList<>()).add(item);
            reqsBySupplier.computeIfAbsent(s.getId(), k -> new ArrayList<>()).add(req);
            if (colours.containsKey(product.getId())) {
                colourNotesBySupplier.computeIfAbsent(s.getId(), k -> new ArrayList<>())
                        .add(product.getName() + ": " + colours.get(product.getId()));
            }
        }
        if (!missingSupplier.isEmpty()) {
            throw new IllegalStateException("No supplier set for: " + String.join(", ", missingSupplier)
                    + ". Pick a supplier for these items.");
        }
        if (itemsBySupplier.isEmpty()) throw new IllegalArgumentException("Enter a quantity to buy");

        List<PurchaseOrder> created = new ArrayList<>();
        for (Map.Entry<Long, List<PurchaseOrderItem>> e : itemsBySupplier.entrySet()) {
            PurchaseOrder po = new PurchaseOrder();
            po.setSupplier(suppliers.get(e.getKey()));
            po.setProject(project);
            po.setExpectedDeliveryDate(expected);
            if (deliverToSite) po.setDeliveryAddress(project.getPropertyAddress());
            List<String> colourNotes = colourNotesBySupplier.getOrDefault(e.getKey(), List.of());
            po.setNotes("For project " + project.getProjectName()
                    + (deliverToSite ? " — deliver directly to the customer's site" : "")
                    + (colourNotes.isEmpty() ? "" : "\nColours — " + String.join("; ", colourNotes)));
            PurchaseOrder saved = purchaseService.createPurchaseOrder(po, e.getValue());
            for (ProjectMaterialRequirement req : reqsBySupplier.get(e.getKey())) {
                req.setPurchaseOrder(saved);
                requirementRepository.save(req);
            }
            created.add(saved);
        }
        return created;
    }

    /** Sends received stock out to the customer's site (project stock-out from the fullest warehouse unless one is given). */
    @Transactional
    public InventoryTransaction sendToSite(Long projectId, Long reqId, Map<String, Object> body) {
        ProjectMaterialRequirement req = ownRequirement(projectId, reqId);
        int qty = new BigDecimal(String.valueOf(body.getOrDefault("quantity", "0"))).setScale(0, RoundingMode.CEILING).intValue();
        if (qty <= 0) throw new IllegalArgumentException("Quantity must be greater than zero");
        Long warehouseId = toLong(body.get("warehouseId"));
        Warehouse warehouse = warehouseId != null
                ? inventoryItemRepository.findByProductIdAndWarehouseId(req.getProduct().getId(), warehouseId)
                        .map(InventoryItem::getWarehouse).orElse(null)
                : inventoryItemRepository.findByProductId(req.getProduct().getId()).stream()
                        .max(Comparator.comparingInt(InventoryItem::getAvailableQuantity))
                        .map(InventoryItem::getWarehouse).orElse(null);
        if (warehouse == null) throw new IllegalStateException(req.getProduct().getName() + " is not in any warehouse yet — receive the goods first");

        InventoryTransaction tx = new InventoryTransaction();
        tx.setType("CONSUMPTION");
        tx.setProduct(req.getProduct());
        tx.setQuantity(qty);
        tx.setSourceWarehouse(warehouse);
        tx.setReferenceType("PROJECT");
        tx.setReferenceId(projectId);
        tx.setNotes(body.get("notes") != null ? String.valueOf(body.get("notes")) : "Sent to site (Supply & Install)");
        return projectService.recordMaterialTransaction(projectId, tx);
    }

    /**
     * Fills the supply list from the project's quote: each quote line (or its material lines) is
     * linked to a catalogue product by name. Products already on the list are left alone.
     */
    @Transactional
    public Map<String, Object> loadFromQuote(Long projectId) {
        Project project = projectService.getProjectById(projectId);
        Set<Long> listed = new HashSet<>();
        requirementRepository.findByProjectIdOrderByIdAsc(projectId)
                .forEach(r -> { if (r.getProduct() != null) listed.add(r.getProduct().getId()); });

        Map<Long, ProjectMaterialRequirement> added = new LinkedHashMap<>();
        for (QuoteProductLinker.Line line : quoteProductLinker.resolve(quoteItems(project), false)) {
            if (!line.matched() || listed.contains(line.product().getId())) continue;
            ProjectMaterialRequirement r = added.computeIfAbsent(line.product().getId(), pid -> {
                ProjectMaterialRequirement fresh = new ProjectMaterialRequirement();
                fresh.setProject(project);
                fresh.setProduct(line.product());
                fresh.setRequiredQty(BigDecimal.ZERO);
                fresh.setUnit(line.unit() != null ? line.unit() : line.product().getUnit());
                fresh.setRemarks("Auto-linked from quote: " + line.source());
                return fresh;
            });
            r.setRequiredQty(r.getRequiredQty().add(line.quantity()));
        }
        requirementRepository.saveAll(added.values());
        return Map.of("added", added.size());
    }

    /**
     * Links an unmatched quote line to a product by hand: remembers the name (so future quotes match it
     * automatically) and adds the quantity to this project's supply list.
     */
    @Transactional
    public ProjectMaterialRequirement linkQuoteLine(Long projectId, Map<String, Object> body) {
        Project project = projectService.getProjectById(projectId);
        String name = Objects.toString(body.get("name"), "").trim();
        Long productId = toLong(body.get("productId"));
        if (name.isEmpty() || productId == null) throw new IllegalArgumentException("Pick a product for this quote line");
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        BigDecimal qty = body.get("quantity") != null ? new BigDecimal(String.valueOf(body.get("quantity"))) : BigDecimal.ZERO;
        String unit = body.get("unit") != null ? String.valueOf(body.get("unit")) : product.getUnit();

        quoteProductLinker.remember(name, product);

        ProjectMaterialRequirement req = requirementRepository.findByProjectIdOrderByIdAsc(projectId).stream()
                .filter(r -> r.getProduct() != null && r.getProduct().getId().equals(productId))
                .findFirst()
                .orElseGet(() -> {
                    ProjectMaterialRequirement fresh = new ProjectMaterialRequirement();
                    fresh.setProject(project);
                    fresh.setProduct(product);
                    fresh.setRequiredQty(BigDecimal.ZERO);
                    fresh.setUnit(unit);
                    fresh.setRemarks("Linked from quote: " + name);
                    return fresh;
                });
        req.setRequiredQty(nz(req.getRequiredQty()).add(qty.max(BigDecimal.ZERO)));
        return requirementRepository.save(req);
    }

    /** Quote lines that couldn't be matched to any product, so the team can link them by hand. */
    private List<Map<String, Object>> unlinkedQuoteLines(Project project) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (QuoteProductLinker.Line line : quoteProductLinker.resolve(quoteItems(project), false)) {
            if (line.matched()) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", line.source());
            m.put("quantity", line.quantity());
            m.put("unit", line.unit());
            out.add(m);
        }
        return out;
    }

    /**
     * The quote lines that belong to this project. A quotation split per floor makes one project per
     * floor named "<floor> - Project for …"; keep that floor's lines only.
     */
    /**
     * Per product, the colours the quote asks for and how many of each ("Gold ×2 · Teal ×3"), so the
     * supply list and the purchase order say which colours to buy. Lines without a colour are left out.
     */
    private Map<Long, String> colourBreakdown(Project project) {
        Map<Long, Map<String, BigDecimal>> byProduct = new LinkedHashMap<>();
        for (QuotationItem q : quoteItems(project)) {
            if (q.getColor() == null || q.getColor().isBlank() || "REJECTED".equals(q.getStatus())) continue;
            Long pid = q.getProductId();
            if (pid == null) continue;
            BigDecimal qty = q.getQuantity() != null ? q.getQuantity() : BigDecimal.ZERO;
            byProduct.computeIfAbsent(pid, k -> new LinkedHashMap<>()).merge(q.getColor().trim(), qty, BigDecimal::add);
        }
        Map<Long, String> out = new LinkedHashMap<>();
        byProduct.forEach((pid, m) -> out.put(pid, m.entrySet().stream()
                .map(e -> e.getKey() + " ×" + e.getValue().stripTrailingZeros().toPlainString())
                .collect(java.util.stream.Collectors.joining(" · "))));
        return out;
    }

    private List<QuotationItem> quoteItems(Project project) {
        Quotation q = project.getQuotation();
        if (q == null || q.getItems() == null) return List.of();
        String name = Objects.toString(project.getProjectName(), "");
        List<QuotationItem> floor = q.getItems().stream()
                .filter(i -> i.getFloorName() != null && !i.getFloorName().isBlank() && name.startsWith(i.getFloorName() + " - "))
                .toList();
        return floor.isEmpty() ? q.getItems() : floor;
    }

    @Transactional
    public ProjectMaterialRequirement setInstalled(Long projectId, Long reqId, BigDecimal installedQty) {
        ProjectMaterialRequirement req = ownRequirement(projectId, reqId);
        req.setInstalledQty(installedQty == null ? BigDecimal.ZERO : installedQty.max(BigDecimal.ZERO));
        return requirementRepository.save(req);
    }

    private ProjectMaterialRequirement ownRequirement(Long projectId, Long reqId) {
        ProjectMaterialRequirement req = requirementRepository.findById(reqId)
                .orElseThrow(() -> new IllegalArgumentException("Material not found"));
        if (!req.getProject().getId().equals(projectId)) throw new IllegalArgumentException("Material belongs to another project");
        return req;
    }

    private Optional<Supplier> preferredSupplier(Product product) {
        List<ProductSupplier> options = productSupplierRepository.findByProductId(product.getId());
        return options.stream().filter(ps -> Boolean.TRUE.equals(ps.getIsPreferred()) && ps.getSupplier() != null)
                .map(ProductSupplier::getSupplier).findFirst()
                .or(() -> Optional.ofNullable(product.getSupplier()))
                .or(() -> options.stream().map(ProductSupplier::getSupplier).filter(Objects::nonNull).findFirst());
    }

    private static BigDecimal take(Map<Long, BigDecimal> pool, Long key, BigDecimal want) {
        BigDecimal have = pool.getOrDefault(key, BigDecimal.ZERO);
        BigDecimal got = have.min(want.max(BigDecimal.ZERO));
        pool.put(key, have.subtract(got));
        return got;
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
    private static int nzi(Integer v) { return v == null ? 0 : v; }
    private static Long toLong(Object v) {
        if (v == null || String.valueOf(v).isBlank()) return null;
        return Long.valueOf(String.valueOf(v));
    }
}

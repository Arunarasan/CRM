package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.event.ProjectProgressChangedEvent;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Project work tracking by Category → Product, behind the project's two shared tasks.
 *
 * <p><b>Project Execution</b> — every quoted product line goes through its own steps until it is at site:
 * MATERIAL (read from the project's purchase orders when one covers the product, otherwise a manual tick),
 * MANUFACTURE / STITCHING (checklist + %), and DELIVERY (DIRECT: supplier dispatches → at site, or PICKUP:
 * team picks up → on the way → at site). Execution % = average of every step.
 *
 * <p><b>Installation</b> — one checklist per category; a category is "ready" once its products are at site.
 * Category % = max(ticked share, manual %), Installation % = average of categories. The team posts a daily
 * "done today / plan for tomorrow" log that can move the bars.
 *
 * <p>Project % = half execution + half installation, held at 99% until the closing task is approved.
 */
@Service
public class ProjectWorkService {

    public static final String INSTALLATION_TEMPLATE_CODE = "TT_PM_INSTALLATION";

    public static final String MATERIAL = "MATERIAL";
    public static final String MANUFACTURE = "MANUFACTURE";
    public static final String STITCHING = "STITCHING";
    public static final String DELIVERY = "DELIVERY";
    private static final List<String> STEP_ORDER = List.of(MATERIAL, MANUFACTURE, STITCHING, DELIVERY);
    private static final Map<String, String> STEP_LABELS = Map.of(
            MATERIAL, "Material", MANUFACTURE, "Manufacture", STITCHING, "Stitching", DELIVERY, "Delivery to site");

    private static final Set<String> DEAD_PO = Set.of("CANCELLED", "REJECTED");
    private static final Set<String> DRAFT_PO = Set.of("DRAFT", "PENDING_APPROVAL");

    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private ProjectWorkLineRepository lineRepository;
    @Autowired private ProjectWorkLineStepRepository stepRepository;
    @Autowired private ProjectWorkEventRepository eventRepository;
    @Autowired private ProjectInstallCategoryRepository installCategoryRepository;
    @Autowired private ProjectInstallStepRepository installStepRepository;
    @Autowired private ProjectTaskDailyLogRepository dailyLogRepository;
    @Autowired private InventoryCategoryRepository inventoryCategoryRepository;
    @Autowired private PurchaseOrderRepository purchaseOrderRepository;
    @Autowired private PurchaseOrderItemRepository purchaseOrderItemRepository;
    @Autowired private PurchaseOrderShipmentRepository shipmentRepository;
    @Autowired private WorkflowService workflowService;
    @Autowired private WorkflowInstanceRepository workflowInstanceRepository;
    @Autowired private TaskTemplateRepository taskTemplateRepository;
    @Autowired private TaskGenerationService taskGenerationService;
    @Autowired private ApplicationEventPublisher eventPublisher;

    // ------------------------------------------------------------------ tasks

    public Task findTask(Long projectId, String templateCode) {
        return taskRepository.findByProjectId(projectId).stream()
                .filter(t -> t.getTaskTemplate() != null && templateCode.equals(t.getTaskTemplate().getCode()))
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .findFirst().orElse(null);
    }

    public Task findExecutionTask(Long projectId) {
        return findTask(projectId, ProjectService.EXECUTION_TEMPLATE_CODE);
    }

    public Task findInstallationTask(Long projectId) {
        return findTask(projectId, INSTALLATION_TEMPLATE_CODE);
    }

    public static boolean isInstallationTask(Task t) {
        return t != null && t.getTaskTemplate() != null && INSTALLATION_TEMPLATE_CODE.equals(t.getTaskTemplate().getCode());
    }

    public static boolean isExecutionTask(Task t) {
        return t != null && t.getTaskTemplate() != null
                && ProjectService.EXECUTION_TEMPLATE_CODE.equals(t.getTaskTemplate().getCode());
    }

    /** True once the project tracks work by product lines (new-style projects). */
    public boolean hasWorkLines(Long projectId) {
        return projectId != null && lineRepository.existsByProjectIdAndIsDeletedFalse(projectId);
    }

    /**
     * The task whose admin approval closes the project: Installation when the project has one, otherwise
     * (older projects) the single Project Execution task.
     */
    public boolean isClosingTask(Task t) {
        if (t == null || t.getProject() == null) return false;
        if (isInstallationTask(t)) return true;
        return isExecutionTask(t) && findInstallationTask(t.getProject().getId()) == null;
    }

    /**
     * Make sure the project has both shared tasks — creates the missing one(s) through the PROJECT workflow
     * (idempotent: existing tasks are skipped). Used for projects created before Installation existed.
     */
    @Transactional
    public void ensureTasks(Long projectId) {
        if (findExecutionTask(projectId) != null && findInstallationTask(projectId) != null) return;
        Optional<WorkflowInstance> active =
                workflowInstanceRepository.findFirstByScopeAndProjectIdAndStatus("PROJECT", projectId, "ACTIVE");
        if (active.isEmpty()) {
            workflowService.startProjectWorkflow(projectId);
            return;
        }
        for (WorkflowPhaseInstance pi : workflowService.orderedPhaseInstances(active.get())) {
            boolean hasOurs = taskTemplateRepository.findByPhaseIdAndIsDeletedFalseOrderByOrderIndexAsc(pi.getPhase().getId())
                    .stream().anyMatch(tpl -> INSTALLATION_TEMPLATE_CODE.equals(tpl.getCode())
                            || ProjectService.EXECUTION_TEMPLATE_CODE.equals(tpl.getCode()));
            if (hasOurs) taskGenerationService.materializePhase(pi);
        }
    }

    // ------------------------------------------------------------------ seeding

    /** Build the work lines + installation checklists from the project's approved quotation (once). */
    @Transactional
    public Map<String, Object> setup(Long projectId) {
        ensureTasks(projectId);
        if (!hasWorkLines(projectId)) syncFromQuote(projectId);
        else recompute(projectId);
        return getBoard(projectId);
    }

    /**
     * Bring the work lines in line with the project's quotation: matched lines are refreshed (progress
     * kept), new quote lines are added with their category's default steps, dropped ones are deactivated.
     * Lines are matched by BOQ item, then quotation item, then category + name.
     */
    @Transactional
    public void syncFromQuote(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Quotation quote = project.getQuotation();
        if (quote == null) return;

        List<QuotationItem> items = quote.getItems().stream()
                .filter(i -> !Boolean.TRUE.equals(i.getIsDeleted()))
                .filter(i -> !"REJECTED".equalsIgnoreCase(i.getStatus()))
                .sorted(Comparator.comparing((QuotationItem i) -> i.getItemOrder() == null ? 0 : i.getItemOrder())
                        .thenComparing(QuotationItem::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        // Category order = order of first appearance; lines sorted category-first.
        List<String> categoryOrder = new ArrayList<>();
        for (QuotationItem i : items) {
            String c = categoryOf(i.getCategory());
            if (!categoryOrder.contains(c)) categoryOrder.add(c);
        }
        List<QuotationItem> ordered = new ArrayList<>(items);
        ordered.sort(Comparator.comparingInt(i -> categoryOrder.indexOf(categoryOf(i.getCategory()))));

        List<ProjectWorkLine> existing = new ArrayList<>(lineRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId));
        Map<String, InventoryCategory> catalog = catalogCategories();
        Set<Long> kept = new HashSet<>();
        int order = 0;
        for (QuotationItem qi : ordered) {
            ProjectWorkLine line = matchLine(existing, kept, qi);
            boolean isNew = line == null;
            if (isNew) {
                line = new ProjectWorkLine();
                line.setProjectId(projectId);
            }
            line.setQuotationItemId(qi.getId());
            line.setBoqItemId(qi.getBoqItemId());
            line.setCategory(categoryOf(qi.getCategory()));
            if (qi.getProductId() != null) line.setProductId(qi.getProductId());
            line.setItemName(qi.getItemName() != null && !qi.getItemName().isBlank() ? qi.getItemName() : "Item");
            line.setColor(qi.getColor());
            line.setLocation(firstNonBlank(qi.getLocation(), qi.getRoomName()));
            line.setQuantity(qi.getQuantity());
            line.setUnit(qi.getUnit());
            line.setImageUrl(qi.getImageUrl());
            line.setSortOrder(order++);
            line.setActive(true);
            line = lineRepository.save(line);
            kept.add(line.getId());
            if (isNew) createSteps(line, defaultStepsFor(line.getCategory(), catalog.get(norm(line.getCategory()))));
        }
        // Lines dropped from the quote stay for history but stop counting.
        for (ProjectWorkLine old : existing) {
            if (!kept.contains(old.getId()) && Boolean.TRUE.equals(old.getActive()) && old.getQuotationItemId() != null) {
                old.setActive(false);
                lineRepository.save(old);
            }
        }
        syncInstallCategories(projectId, catalog);
        recompute(projectId);
    }

    private ProjectWorkLine matchLine(List<ProjectWorkLine> existing, Set<Long> taken, QuotationItem qi) {
        for (ProjectWorkLine l : existing) {
            if (taken.contains(l.getId())) continue;
            if (qi.getBoqItemId() != null && qi.getBoqItemId().equals(l.getBoqItemId())) return l;
        }
        for (ProjectWorkLine l : existing) {
            if (taken.contains(l.getId())) continue;
            if (qi.getId() != null && qi.getId().equals(l.getQuotationItemId())) return l;
        }
        for (ProjectWorkLine l : existing) {
            if (taken.contains(l.getId())) continue;
            if (norm(categoryOf(qi.getCategory())).equals(norm(l.getCategory()))
                    && norm(qi.getItemName()).equals(norm(l.getItemName()))) return l;
        }
        return null;
    }

    private void createSteps(ProjectWorkLine line, List<String> types) {
        int i = 0;
        for (String type : STEP_ORDER) {
            if (!types.contains(type)) continue;
            ProjectWorkLineStep s = new ProjectWorkLineStep();
            s.setWorkLineId(line.getId());
            s.setStepType(type);
            s.setSortOrder(i++);
            if (DELIVERY.equals(type)) s.setDeliveryRoute("DIRECT");
            stepRepository.save(s);
        }
    }

    /** One installation checklist per active category; categories with no live products are hidden. */
    private void syncInstallCategories(Long projectId, Map<String, InventoryCategory> catalog) {
        List<String> categories = new ArrayList<>();
        for (ProjectWorkLine l : lineRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId)) {
            if (Boolean.TRUE.equals(l.getActive()) && !categories.contains(l.getCategory())) categories.add(l.getCategory());
        }
        List<ProjectInstallCategory> existing = installCategoryRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId);
        Map<String, ProjectInstallCategory> byName = new HashMap<>();
        existing.forEach(c -> byName.putIfAbsent(norm(c.getCategory()), c));
        int order = 0;
        for (String cat : categories) {
            ProjectInstallCategory ic = byName.remove(norm(cat));
            if (ic == null) {
                ic = new ProjectInstallCategory();
                ic.setProjectId(projectId);
                ic.setCategory(cat);
                ic.setSortOrder(order++);
                ic = installCategoryRepository.save(ic);
                int i = 0;
                for (String content : defaultInstallSteps(cat, catalog.get(norm(cat)))) {
                    ProjectInstallStep st = new ProjectInstallStep();
                    st.setInstallCategoryId(ic.getId());
                    st.setContent(content);
                    st.setSortOrder(i++);
                    installStepRepository.save(st);
                }
            } else {
                ic.setSortOrder(order++);
                ic.setActive(true);
                installCategoryRepository.save(ic);
            }
        }
        // Left-over categories: hidden unless someone added them by hand (no products ever) — keep those.
        for (ProjectInstallCategory left : byName.values()) {
            boolean hadProducts = lineRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId).stream()
                    .anyMatch(l -> norm(l.getCategory()).equals(norm(left.getCategory())));
            if (hadProducts && Boolean.TRUE.equals(left.getActive())) {
                left.setActive(false);
                installCategoryRepository.save(left);
            }
        }
    }

    private Map<String, InventoryCategory> catalogCategories() {
        Map<String, InventoryCategory> m = new HashMap<>();
        for (InventoryCategory c : inventoryCategoryRepository.findAll()) {
            if (!Boolean.TRUE.equals(c.getIsDeleted()) && c.getName() != null) m.putIfAbsent(norm(c.getName()), c);
        }
        return m;
    }

    /** The category's configured steps, else a guess from its name. Material + delivery always apply. */
    static List<String> defaultStepsFor(String category, InventoryCategory configured) {
        if (configured != null && configured.getWorkSteps() != null && !configured.getWorkSteps().isBlank()) {
            List<String> parsed = Arrays.stream(configured.getWorkSteps().split(","))
                    .map(s -> s.trim().toUpperCase()).filter(STEP_ORDER::contains).toList();
            if (!parsed.isEmpty()) return parsed;
        }
        String n = norm(category);
        List<String> steps = new ArrayList<>(List.of(MATERIAL));
        if (hasAny(n, "curtain", "drape", "sheer", "blind", "roman", "upholster", "sofa", "cushion", "pillow",
                "bedsheet", "bed sheet", "fabric", "linen", "stitch")) steps.add(STITCHING);
        if (hasAny(n, "wardrobe", "kitchen", "furniture", "cabinet", "cot", "table", "door", "shelf", "tv unit",
                "carpent", "modular", "partition", "panel", "frame", "bed")) steps.add(MANUFACTURE);
        steps.add(DELIVERY);
        return steps;
    }

    static List<String> defaultInstallSteps(String category, InventoryCategory configured) {
        if (configured != null && configured.getInstallSteps() != null && !configured.getInstallSteps().isBlank()) {
            List<String> lines = Arrays.stream(configured.getInstallSteps().split("\\r?\\n"))
                    .map(String::trim).filter(s -> !s.isBlank()).toList();
            if (!lines.isEmpty()) return lines;
        }
        String n = norm(category);
        if (hasAny(n, "blind")) return List.of("Mark & fix brackets", "Mount blinds", "Test operation", "Final check & clean up");
        if (hasAny(n, "curtain", "drape", "sheer")) return List.of("Mark & fix brackets", "Fix rods / tracks",
                "Hang curtains & set pleats", "Final check & clean up");
        if (hasAny(n, "wallpaper", "wall paper", "mural")) return List.of("Wall preparation (clean / putty / prime)",
                "Paste wallpaper", "Trim edges & joints", "Final check & clean up");
        if (hasAny(n, "floor", "carpet", "rug", "vinyl", "laminate", "tile")) return List.of("Surface preparation",
                "Lay flooring", "Fix skirting & edges", "Final check & clean up");
        if (hasAny(n, "wardrobe", "kitchen", "furniture", "cabinet", "shelf", "tv unit", "modular", "door", "partition", "panel"))
            return List.of("Assemble units", "Fix to wall & level", "Fit shutters & hardware", "Final check & clean up");
        if (hasAny(n, "sofa", "upholster", "cushion", "pillow", "bed")) return List.of("Place items", "Final check & clean up");
        if (hasAny(n, "paint", "polish")) return List.of("Surface preparation", "Primer coat", "Finish coats", "Final check & clean up");
        return List.of("Install as per design", "Final check & clean up");
    }

    // ------------------------------------------------------------------ board

    @Transactional(readOnly = true)
    public Map<String, Object> getBoard(Long projectId) {
        Calc calc = calculate(projectId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projectId", projectId);
        out.put("hasLines", !calc.lines.isEmpty());
        out.put("executionTask", taskInfo(findExecutionTask(projectId)));
        out.put("installationTask", taskInfo(findInstallationTask(projectId)));
        out.put("executionPercent", calc.executionPercent);
        out.put("installationPercent", calc.installationPercent);
        out.put("overallPercent", overall(calc));
        out.put("productCount", calc.lines.stream().filter(l -> Boolean.TRUE.equals(l.getActive())).count());
        out.put("atSiteCount", calc.lines.stream().filter(l -> Boolean.TRUE.equals(l.getActive()) && calc.atSite.contains(l.getId())).count());

        // Execution: categories → products → steps.
        Map<String, List<Map<String, Object>>> byCategory = new LinkedHashMap<>();
        Map<String, int[]> catPct = new LinkedHashMap<>();
        for (ProjectWorkLine l : calc.lines) {
            if (!Boolean.TRUE.equals(l.getActive())) continue;
            Map<String, Object> lm = new LinkedHashMap<>();
            lm.put("id", l.getId());
            lm.put("itemName", l.getItemName());
            lm.put("category", l.getCategory());
            lm.put("productId", l.getProductId());
            lm.put("color", l.getColor());
            lm.put("location", l.getLocation());
            lm.put("quantity", l.getQuantity());
            lm.put("unit", l.getUnit());
            lm.put("imageUrl", l.getImageUrl());
            lm.put("percent", calc.linePercent.getOrDefault(l.getId(), 0));
            lm.put("atSite", calc.atSite.contains(l.getId()));
            lm.put("custom", l.getQuotationItemId() == null);
            List<Map<String, Object>> steps = new ArrayList<>();
            for (ProjectWorkLineStep s : calc.stepsByLine.getOrDefault(l.getId(), List.of())) {
                steps.add(stepView(s, l, calc));
            }
            lm.put("steps", steps);
            byCategory.computeIfAbsent(l.getCategory(), k -> new ArrayList<>()).add(lm);
            int[] acc = catPct.computeIfAbsent(l.getCategory(), k -> new int[2]);
            acc[0] += calc.linePercent.getOrDefault(l.getId(), 0);
            acc[1]++;
        }
        List<Map<String, Object>> categories = new ArrayList<>();
        byCategory.forEach((cat, lines) -> {
            Map<String, Object> cm = new LinkedHashMap<>();
            int[] acc = catPct.get(cat);
            cm.put("category", cat);
            cm.put("percent", acc[1] == 0 ? 0 : Math.round((float) acc[0] / acc[1]));
            cm.put("productCount", lines.size());
            cm.put("atSiteCount", lines.stream().filter(m -> Boolean.TRUE.equals(m.get("atSite"))).count());
            cm.put("lines", lines);
            categories.add(cm);
        });
        out.put("categories", categories);

        // Installation: category checklists.
        List<Map<String, Object>> install = new ArrayList<>();
        for (ProjectInstallCategory ic : calc.installCategories) {
            if (!Boolean.TRUE.equals(ic.getActive())) continue;
            Map<String, Object> im = new LinkedHashMap<>();
            im.put("id", ic.getId());
            im.put("category", ic.getCategory());
            im.put("percent", calc.installPercent.getOrDefault(ic.getId(), 0));
            im.put("manualPercent", ic.getManualPercent());
            int[] wait = calc.waiting.getOrDefault(norm(ic.getCategory()), new int[2]);
            im.put("productCount", wait[1]);
            im.put("waitingCount", wait[0]);
            im.put("ready", wait[0] == 0);
            List<Map<String, Object>> steps = new ArrayList<>();
            for (ProjectInstallStep st : calc.installSteps.getOrDefault(ic.getId(), List.of())) {
                Map<String, Object> sm = new LinkedHashMap<>();
                sm.put("id", st.getId());
                sm.put("content", st.getContent());
                sm.put("done", Boolean.TRUE.equals(st.getDone()));
                sm.put("doneByName", st.getDoneByName());
                sm.put("doneAt", st.getDoneAt());
                steps.add(sm);
            }
            im.put("steps", steps);
            install.add(im);
        }
        out.put("install", install);

        List<Map<String, Object>> types = new ArrayList<>();
        for (String t : STEP_ORDER) types.add(Map.of("type", t, "label", STEP_LABELS.get(t)));
        out.put("stepTypes", types);
        return out;
    }

    private Map<String, Object> stepView(ProjectWorkLineStep s, ProjectWorkLine l, Calc calc) {
        Map<String, Object> sm = new LinkedHashMap<>();
        sm.put("id", s.getId());
        sm.put("stepType", s.getStepType());
        sm.put("label", STEP_LABELS.getOrDefault(s.getStepType(), s.getStepType()));
        int pct = calc.stepPercent.getOrDefault(s.getId(), 0);
        sm.put("percent", pct);
        sm.put("status", pct >= 100 ? "DONE" : pct > 0 ? "IN_PROGRESS" : "PENDING");
        PoStatus po = MATERIAL.equals(s.getStepType()) && l.getProductId() != null ? calc.po.get(l.getProductId()) : null;
        sm.put("source", po != null ? "PO" : "MANUAL");
        if (po != null) sm.put("po", po.view());
        sm.put("deliveryRoute", s.getDeliveryRoute());
        sm.put("deliveryStage", s.getDeliveryStage());
        sm.put("pickupFrom", s.getPickupFrom());
        sm.put("note", s.getNote());
        sm.put("photoUrl", s.getPhotoUrl());
        sm.put("updatedByName", s.getUpdatedByName());
        sm.put("doneAt", s.getDoneAt());
        sm.put("updatedAt", s.getUpdatedAt());
        return sm;
    }

    private Map<String, Object> taskInfo(Task t) {
        if (t == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getTaskName());
        m.put("status", t.getStatus());
        m.put("progress", t.getProgress());
        m.put("dueDate", t.getDueDate());
        return m;
    }

    // ------------------------------------------------------------------ calculation

    /** Purchase-order picture for one product on this project. */
    private static class PoStatus {
        BigDecimal ordered = BigDecimal.ZERO;
        BigDecimal received = BigDecimal.ZERO;
        boolean anyLive; // approved / sent / confirmed / partial / completed
        List<Map<String, Object>> orders = new ArrayList<>();
        List<String> inTransit = new ArrayList<>();

        int percent() {
            if (!anyLive) return 0; // only drafts — not ordered yet
            int floor = inTransit.isEmpty() ? 20 : 50;
            int recv = ordered.signum() > 0
                    ? received.multiply(BigDecimal.valueOf(100)).divide(ordered, 0, RoundingMode.DOWN).intValue() : 0;
            return Math.min(100, Math.max(floor, recv));
        }

        String label() {
            int p = percent();
            if (!anyLive) return "PO in draft";
            if (p >= 100) return "Received";
            if (received.signum() > 0) return "Partly received";
            if (!inTransit.isEmpty()) return "Shipped";
            return "Ordered";
        }

        Map<String, Object> view() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", label());
            m.put("ordered", ordered);
            m.put("received", received);
            m.put("orders", orders);
            m.put("inTransit", inTransit);
            return m;
        }
    }

    private static class Calc {
        List<ProjectWorkLine> lines = List.of();
        Map<Long, List<ProjectWorkLineStep>> stepsByLine = new HashMap<>();
        Map<Long, Integer> stepPercent = new HashMap<>();
        Map<Long, Integer> linePercent = new HashMap<>();
        Set<Long> atSite = new HashSet<>();
        Map<Long, PoStatus> po = new HashMap<>();
        List<ProjectInstallCategory> installCategories = List.of();
        Map<Long, List<ProjectInstallStep>> installSteps = new HashMap<>();
        Map<Long, Integer> installPercent = new HashMap<>();
        Map<String, int[]> waiting = new HashMap<>(); // category → [not at site, total]
        int executionPercent;
        int installationPercent;
    }

    private Calc calculate(Long projectId) {
        Calc c = new Calc();
        c.lines = lineRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId);
        c.po = poByProduct(projectId);
        List<Long> ids = c.lines.stream().map(ProjectWorkLine::getId).toList();
        if (!ids.isEmpty()) {
            for (ProjectWorkLineStep s : stepRepository.findByWorkLineIdInAndIsDeletedFalseOrderBySortOrderAscIdAsc(ids)) {
                c.stepsByLine.computeIfAbsent(s.getWorkLineId(), k -> new ArrayList<>()).add(s);
            }
        }
        long stepSum = 0;
        int stepCount = 0;
        for (ProjectWorkLine l : c.lines) {
            List<ProjectWorkLineStep> steps = c.stepsByLine.getOrDefault(l.getId(), List.of());
            int sum = 0;
            boolean allDone = true;
            Integer delivery = null;
            for (ProjectWorkLineStep s : steps) {
                int p = stepPercent(s, l, c.po);
                c.stepPercent.put(s.getId(), p);
                sum += p;
                if (p < 100) allDone = false;
                if (DELIVERY.equals(s.getStepType())) delivery = p;
            }
            c.linePercent.put(l.getId(), steps.isEmpty() ? 0 : Math.round((float) sum / steps.size()));
            boolean here = delivery != null ? delivery >= 100 : (!steps.isEmpty() && allDone);
            if (here) c.atSite.add(l.getId());
            if (Boolean.TRUE.equals(l.getActive())) {
                stepSum += sum;
                stepCount += steps.size();
                int[] w = c.waiting.computeIfAbsent(norm(l.getCategory()), k -> new int[2]);
                if (!here) w[0]++;
                w[1]++;
            }
        }
        c.executionPercent = stepCount == 0 ? 0 : (int) Math.round((double) stepSum / stepCount);

        c.installCategories = installCategoryRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId);
        List<Long> catIds = c.installCategories.stream().map(ProjectInstallCategory::getId).toList();
        if (!catIds.isEmpty()) {
            for (ProjectInstallStep st : installStepRepository.findByInstallCategoryIdInAndIsDeletedFalseOrderBySortOrderAscIdAsc(catIds)) {
                c.installSteps.computeIfAbsent(st.getInstallCategoryId(), k -> new ArrayList<>()).add(st);
            }
        }
        int catSum = 0, catCount = 0;
        for (ProjectInstallCategory ic : c.installCategories) {
            List<ProjectInstallStep> steps = c.installSteps.getOrDefault(ic.getId(), List.of());
            long done = steps.stream().filter(s -> Boolean.TRUE.equals(s.getDone())).count();
            int ticked = steps.isEmpty() ? 0 : (int) (done * 100 / steps.size());
            int pct = Math.max(ticked, ic.getManualPercent() == null ? 0 : ic.getManualPercent());
            c.installPercent.put(ic.getId(), pct);
            if (Boolean.TRUE.equals(ic.getActive())) {
                catSum += pct;
                catCount++;
            }
        }
        c.installationPercent = catCount == 0 ? 0 : Math.round((float) catSum / catCount);
        return c;
    }

    private int stepPercent(ProjectWorkLineStep s, ProjectWorkLine l, Map<Long, PoStatus> po) {
        if (MATERIAL.equals(s.getStepType()) && l.getProductId() != null && po.containsKey(l.getProductId())) {
            return po.get(l.getProductId()).percent();
        }
        if (DELIVERY.equals(s.getStepType())) return deliveryPercent(s.getDeliveryRoute(), s.getDeliveryStage());
        return clamp(s.getPercent());
    }

    static int deliveryPercent(String route, String stage) {
        if (stage == null) return 0;
        boolean pickup = "PICKUP".equalsIgnoreCase(route);
        return switch (stage.toUpperCase()) {
            case "AT_SITE" -> 100;
            case "ON_THE_WAY" -> 70;
            case "PICKED_UP" -> 40;
            case "DISPATCHED" -> pickup ? 40 : 50;
            default -> 0;
        };
    }

    private Map<Long, PoStatus> poByProduct(Long projectId) {
        Map<Long, PoStatus> out = new HashMap<>();
        for (PurchaseOrder order : purchaseOrderRepository.findByProjectIdOrderByIdDesc(projectId)) {
            String status = String.valueOf(order.getStatus()).toUpperCase();
            if (DEAD_PO.contains(status) || Boolean.TRUE.equals(order.getIsDeleted())) continue;
            List<String> transit = shipmentRepository.findActiveForOrder(order.getId()).stream()
                    .filter(s -> "IN_TRANSIT".equalsIgnoreCase(s.getStatus()))
                    .map(PurchaseOrderShipment::getShippingId).toList();
            for (PurchaseOrderItem item : purchaseOrderItemRepository.findByPurchaseOrderId(order.getId())) {
                if (item.getProduct() == null) continue;
                PoStatus ps = out.computeIfAbsent(item.getProduct().getId(), k -> new PoStatus());
                int qty = item.getQuantity() == null ? 0 : item.getQuantity();
                int rec = item.getReceivedQuantity() == null ? 0 : item.getReceivedQuantity();
                if (!DRAFT_PO.contains(status)) {
                    ps.anyLive = true;
                    ps.ordered = ps.ordered.add(BigDecimal.valueOf(qty));
                    ps.received = ps.received.add(BigDecimal.valueOf(rec));
                    transit.forEach(t -> { if (!ps.inTransit.contains(t)) ps.inTransit.add(t); });
                }
                Map<String, Object> o = new LinkedHashMap<>();
                o.put("id", order.getId());
                o.put("poNumber", order.getPoNumber());
                o.put("status", order.getStatus());
                o.put("supplierName", order.getSupplier() != null ? order.getSupplier().getName() : null);
                o.put("quantity", qty);
                o.put("received", rec);
                o.put("expectedDeliveryDate", order.getExpectedDeliveryDate());
                ps.orders.add(o);
            }
        }
        return out;
    }

    private int overall(Calc c) {
        boolean hasInstall = c.installCategories.stream().anyMatch(ic -> Boolean.TRUE.equals(ic.getActive()));
        if (!hasInstall) return c.executionPercent;
        return Math.round((c.executionPercent + c.installationPercent) / 2f);
    }

    /**
     * Push the computed bars onto the two tasks and the project (project held at 99% until the closing
     * task is approved). No-op for projects without work lines.
     */
    @Transactional
    public void recompute(Long projectId) {
        if (!hasWorkLines(projectId)) return;
        Calc c = calculate(projectId);
        Task exec = findExecutionTask(projectId);
        if (exec != null && !Objects.equals(exec.getProgress(), c.executionPercent)) {
            exec.setProgress(c.executionPercent);
            taskRepository.save(exec);
        }
        Task inst = findInstallationTask(projectId);
        if (inst != null && !Objects.equals(inst.getProgress(), c.installationPercent)) {
            inst.setProgress(c.installationPercent);
            taskRepository.save(inst);
        }
        Project p = projectRepository.findById(projectId).orElse(null);
        if (p == null || "COMPLETED".equalsIgnoreCase(p.getStatus())) return;
        int pct = Math.min(99, overall(c));
        if (!Objects.equals(p.getProgress(), pct)) {
            p.setProgress(pct);
            projectRepository.save(p);
            eventPublisher.publishEvent(new ProjectProgressChangedEvent(projectId));
        }
    }

    /** Execution % for the completion gate. */
    @Transactional(readOnly = true)
    public int executionPercent(Long projectId) {
        return calculate(projectId).executionPercent;
    }

    @Transactional(readOnly = true)
    public int installationPercent(Long projectId) {
        return calculate(projectId).installationPercent;
    }

    // ------------------------------------------------------------------ execution edits

    /**
     * Update one step. Body: {@code percent} (0–100), {@code done} (true = 100 / false = 0),
     * {@code deliveryRoute} (DIRECT|PICKUP), {@code deliveryStage}, {@code pickupFrom}, {@code note},
     * {@code photoUrl}. A purchase-order-linked material step keeps its % from the PO.
     */
    @Transactional
    public Map<String, Object> updateStep(Long stepId, Map<String, Object> body, User user) {
        ProjectWorkLineStep s = stepRepository.findById(stepId)
                .orElseThrow(() -> new RuntimeException("Work step not found"));
        ProjectWorkLine line = lineRepository.findById(s.getWorkLineId())
                .orElseThrow(() -> new RuntimeException("Work line not found"));
        boolean poLinked = MATERIAL.equals(s.getStepType()) && line.getProductId() != null
                && poByProduct(line.getProjectId()).containsKey(line.getProductId());
        int before = DELIVERY.equals(s.getStepType()) ? deliveryPercent(s.getDeliveryRoute(), s.getDeliveryStage()) : clamp(s.getPercent());
        String action = "UPDATED";

        if (DELIVERY.equals(s.getStepType())) {
            if (body.get("deliveryRoute") != null) {
                String route = String.valueOf(body.get("deliveryRoute")).toUpperCase();
                if (!route.equals("DIRECT") && !route.equals("PICKUP")) throw new IllegalArgumentException("Route must be DIRECT or PICKUP");
                s.setDeliveryRoute(route);
            }
            if (body.containsKey("deliveryStage")) {
                Object st = body.get("deliveryStage");
                String stage = st == null || String.valueOf(st).isBlank() ? null : String.valueOf(st).toUpperCase();
                if (stage != null && !Set.of("DISPATCHED", "PICKED_UP", "ON_THE_WAY", "AT_SITE").contains(stage)) {
                    throw new IllegalArgumentException("Unknown delivery stage " + stage);
                }
                s.setDeliveryStage(stage);
                action = stage == null ? "RESET" : stage;
            }
            if (body.containsKey("pickupFrom")) s.setPickupFrom(blankToNull(body.get("pickupFrom")));
            if (Boolean.TRUE.equals(body.get("done"))) { s.setDeliveryStage("AT_SITE"); action = "AT_SITE"; }
            if (Boolean.FALSE.equals(body.get("done"))) { s.setDeliveryStage(null); action = "RESET"; }
            s.setPercent(deliveryPercent(s.getDeliveryRoute(), s.getDeliveryStage()));
        } else if (body.containsKey("percent") || body.containsKey("done")) {
            if (poLinked) {
                throw new IllegalStateException("Material for this product follows its purchase order — "
                        + "receive the goods against the PO to move it.");
            }
            int pct = body.containsKey("done")
                    ? (Boolean.TRUE.equals(body.get("done")) ? 100 : 0)
                    : clamp(toInt(body.get("percent")));
            s.setPercent(pct);
            action = pct >= 100 ? "DONE" : "PROGRESS";
        }
        if (body.containsKey("note")) s.setNote(blankToNull(body.get("note")));
        if (body.containsKey("photoUrl")) s.setPhotoUrl(blankToNull(body.get("photoUrl")));

        int after = clamp(s.getPercent());
        s.setStatus(after >= 100 ? "DONE" : after > 0 ? "IN_PROGRESS" : "PENDING");
        if (after >= 100 && before < 100) s.setDoneAt(LocalDateTime.now());
        if (after < 100) s.setDoneAt(null);
        s.setUpdatedByName(user != null ? user.getName() : null);
        s = stepRepository.save(s);

        logEvent(line.getProjectId(), line.getId(), s.getId(), null, s.getStepType(), action, after,
                s.getNote(), s.getPhotoUrl(), user);
        recompute(line.getProjectId());
        return getBoard(line.getProjectId());
    }

    /** Choose which steps a product goes through (adds missing ones, removes un-started dropped ones). */
    @Transactional
    public Map<String, Object> setLineSteps(Long lineId, List<String> types) {
        ProjectWorkLine line = lineRepository.findById(lineId)
                .orElseThrow(() -> new RuntimeException("Work line not found"));
        Set<String> wanted = types == null ? Set.of() : types.stream().map(String::toUpperCase)
                .filter(STEP_ORDER::contains).collect(Collectors.toSet());
        List<ProjectWorkLineStep> steps = stepRepository.findByWorkLineIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(lineId);
        for (ProjectWorkLineStep s : steps) {
            if (!wanted.contains(s.getStepType())) {
                s.setIsDeleted(true);
                s.setDeletedAt(LocalDateTime.now());
                stepRepository.save(s);
            }
        }
        Set<String> have = steps.stream().map(ProjectWorkLineStep::getStepType).collect(Collectors.toSet());
        for (String type : STEP_ORDER) {
            if (!wanted.contains(type) || have.contains(type)) continue;
            ProjectWorkLineStep s = new ProjectWorkLineStep();
            s.setWorkLineId(lineId);
            s.setStepType(type);
            if (DELIVERY.equals(type)) s.setDeliveryRoute("DIRECT");
            stepRepository.save(s);
        }
        // Keep the fixed step order.
        for (ProjectWorkLineStep s : stepRepository.findByWorkLineIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(lineId)) {
            s.setSortOrder(STEP_ORDER.indexOf(s.getStepType()));
            stepRepository.save(s);
        }
        recompute(line.getProjectId());
        return getBoard(line.getProjectId());
    }

    /** A product that wasn't on the quote (extra work agreed on site). */
    @Transactional
    public Map<String, Object> addLine(Long projectId, Map<String, Object> body) {
        String name = blankToNull(body.get("itemName"));
        if (name == null) throw new IllegalArgumentException("Enter the product name");
        ProjectWorkLine line = new ProjectWorkLine();
        line.setProjectId(projectId);
        line.setCategory(categoryOf(blankToNull(body.get("category"))));
        line.setItemName(name);
        line.setColor(blankToNull(body.get("color")));
        line.setLocation(blankToNull(body.get("location")));
        if (body.get("quantity") != null && !String.valueOf(body.get("quantity")).isBlank()) {
            line.setQuantity(new BigDecimal(String.valueOf(body.get("quantity"))));
        }
        line.setUnit(blankToNull(body.get("unit")));
        if (body.get("productId") != null) line.setProductId(Long.valueOf(String.valueOf(body.get("productId"))));
        line.setSortOrder(lineRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId).size());
        line = lineRepository.save(line);
        Map<String, InventoryCategory> catalog = catalogCategories();
        @SuppressWarnings("unchecked")
        List<String> types = body.get("steps") instanceof List<?> l ? (List<String>) l : null;
        createSteps(line, types != null && !types.isEmpty()
                ? types.stream().map(String::toUpperCase).toList()
                : defaultStepsFor(line.getCategory(), catalog.get(norm(line.getCategory()))));
        syncInstallCategories(projectId, catalog);
        recompute(projectId);
        return getBoard(projectId);
    }

    @Transactional
    public Map<String, Object> updateLine(Long lineId, Map<String, Object> body) {
        ProjectWorkLine line = lineRepository.findById(lineId)
                .orElseThrow(() -> new RuntimeException("Work line not found"));
        if (body.containsKey("productId")) {
            Object v = body.get("productId");
            line.setProductId(v == null || String.valueOf(v).isBlank() ? null : Long.valueOf(String.valueOf(v)));
        }
        if (body.containsKey("location")) line.setLocation(blankToNull(body.get("location")));
        if (body.containsKey("itemName") && blankToNull(body.get("itemName")) != null) line.setItemName(blankToNull(body.get("itemName")));
        lineRepository.save(line);
        recompute(line.getProjectId());
        return getBoard(line.getProjectId());
    }

    /** Remove a product from tracking (only extra, non-quote lines are deleted; quote lines are hidden). */
    @Transactional
    public Map<String, Object> removeLine(Long lineId) {
        ProjectWorkLine line = lineRepository.findById(lineId)
                .orElseThrow(() -> new RuntimeException("Work line not found"));
        line.setActive(false);
        if (line.getQuotationItemId() == null) {
            line.setIsDeleted(true);
            line.setDeletedAt(LocalDateTime.now());
        }
        lineRepository.save(line);
        syncInstallCategories(line.getProjectId(), catalogCategories());
        recompute(line.getProjectId());
        return getBoard(line.getProjectId());
    }

    // ------------------------------------------------------------------ installation edits

    @Transactional
    public Map<String, Object> toggleInstallStep(Long stepId, User user) {
        ProjectInstallStep st = installStepRepository.findById(stepId)
                .orElseThrow(() -> new RuntimeException("Checklist step not found"));
        boolean done = !Boolean.TRUE.equals(st.getDone());
        st.setDone(done);
        st.setDoneByName(done && user != null ? user.getName() : null);
        st.setDoneAt(done ? LocalDateTime.now() : null);
        installStepRepository.save(st);
        ProjectInstallCategory ic = installCategoryRepository.findById(st.getInstallCategoryId()).orElseThrow();
        logEvent(ic.getProjectId(), null, null, ic.getId(), "INSTALL", done ? "TICKED" : "UNTICKED", null,
                st.getContent(), null, user);
        recompute(ic.getProjectId());
        return getBoard(ic.getProjectId());
    }

    @Transactional
    public Map<String, Object> addInstallStep(Long categoryId, String content) {
        if (content == null || content.isBlank()) throw new IllegalArgumentException("Enter the checklist step");
        ProjectInstallCategory ic = installCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new RuntimeException("Installation category not found"));
        ProjectInstallStep st = new ProjectInstallStep();
        st.setInstallCategoryId(categoryId);
        st.setContent(content.trim());
        st.setSortOrder(installStepRepository.findByInstallCategoryIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(categoryId).size());
        installStepRepository.save(st);
        recompute(ic.getProjectId());
        return getBoard(ic.getProjectId());
    }

    @Transactional
    public Map<String, Object> removeInstallStep(Long stepId) {
        ProjectInstallStep st = installStepRepository.findById(stepId)
                .orElseThrow(() -> new RuntimeException("Checklist step not found"));
        st.setIsDeleted(true);
        st.setDeletedAt(LocalDateTime.now());
        installStepRepository.save(st);
        ProjectInstallCategory ic = installCategoryRepository.findById(st.getInstallCategoryId()).orElseThrow();
        recompute(ic.getProjectId());
        return getBoard(ic.getProjectId());
    }

    @Transactional
    public Map<String, Object> addInstallCategory(Long projectId, String category) {
        String name = categoryOf(category);
        ProjectInstallCategory ic = new ProjectInstallCategory();
        ic.setProjectId(projectId);
        ic.setCategory(name);
        ic.setSortOrder(installCategoryRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId).size());
        ic = installCategoryRepository.save(ic);
        int i = 0;
        for (String content : defaultInstallSteps(name, catalogCategories().get(norm(name)))) {
            ProjectInstallStep st = new ProjectInstallStep();
            st.setInstallCategoryId(ic.getId());
            st.setContent(content);
            st.setSortOrder(i++);
            installStepRepository.save(st);
        }
        recompute(projectId);
        return getBoard(projectId);
    }

    @Transactional
    public Map<String, Object> setInstallPercent(Long categoryId, Integer percent, User user) {
        ProjectInstallCategory ic = installCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new RuntimeException("Installation category not found"));
        ic.setManualPercent(percent == null ? null : clamp(percent));
        installCategoryRepository.save(ic);
        logEvent(ic.getProjectId(), null, null, ic.getId(), "INSTALL", "PERCENT", ic.getManualPercent(), ic.getCategory(), null, user);
        recompute(ic.getProjectId());
        return getBoard(ic.getProjectId());
    }

    // ------------------------------------------------------------------ daily logs

    /**
     * "Done today / plan for tomorrow" on either project task. Optional {@code categoryPercents}
     * ({installCategoryId: %}) moves the installation bars in the same go; the log records the task's
     * % before and after.
     */
    @Transactional
    public Map<String, Object> addDailyLog(Long taskId, Map<String, Object> body, User user) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new RuntimeException("Task not found"));
        if (task.getProject() == null) throw new IllegalStateException("This task isn't linked to a project.");
        Long projectId = task.getProject().getId();
        String workDone = blankToNull(body.get("workDone"));
        String plan = blankToNull(body.get("tomorrowPlan"));
        if (workDone == null && plan == null) throw new IllegalArgumentException("Write what was done today or the plan for tomorrow");

        boolean install = isInstallationTask(task);
        Calc before = calculate(projectId);
        int pctBefore = install ? before.installationPercent : before.executionPercent;

        if (body.get("categoryPercents") instanceof Map<?, ?> cp) {
            for (Map.Entry<?, ?> e : cp.entrySet()) {
                Long catId = Long.valueOf(String.valueOf(e.getKey()));
                installCategoryRepository.findById(catId).ifPresent(ic -> {
                    if (!projectId.equals(ic.getProjectId())) return;
                    ic.setManualPercent(clamp(toInt(e.getValue())));
                    installCategoryRepository.save(ic);
                });
            }
        }
        recompute(projectId);
        Calc after = calculate(projectId);

        ProjectTaskDailyLog log = new ProjectTaskDailyLog();
        log.setTaskId(taskId);
        log.setProjectId(projectId);
        log.setLogDate(body.get("logDate") != null ? LocalDate.parse(String.valueOf(body.get("logDate"))) : LocalDate.now());
        log.setWorkDone(workDone);
        log.setTomorrowPlan(plan);
        log.setPercentBefore(pctBefore);
        log.setPercentAfter(install ? after.installationPercent : after.executionPercent);
        if (body.get("photos") instanceof List<?> photos) {
            log.setPhotos(photos.stream().filter(Objects::nonNull).map(String::valueOf).filter(s -> !s.isBlank()).toList());
        }
        log.setAudioUrl(blankToNull(body.get("audioUrl")));
        if (user != null) {
            log.setAuthorId(user.getId());
            log.setAuthorName(user.getName());
        }
        return toLogView(dailyLogRepository.save(log));
    }

    public List<Map<String, Object>> dailyLogs(Long taskId) {
        return dailyLogRepository.findByTaskIdAndIsDeletedFalseOrderByLogDateDescIdDesc(taskId).stream()
                .map(this::toLogView).toList();
    }

    public List<Map<String, Object>> projectDailyLogs(Long projectId) {
        return dailyLogRepository.findByProjectIdAndIsDeletedFalseOrderByLogDateDescIdDesc(projectId).stream()
                .map(this::toLogView).toList();
    }

    private Map<String, Object> toLogView(ProjectTaskDailyLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("taskId", l.getTaskId());
        m.put("logDate", l.getLogDate());
        m.put("workDone", l.getWorkDone());
        m.put("tomorrowPlan", l.getTomorrowPlan());
        m.put("percentBefore", l.getPercentBefore());
        m.put("percentAfter", l.getPercentAfter());
        m.put("photos", l.getPhotos() == null ? List.of() : l.getPhotos());
        m.put("audioUrl", l.getAudioUrl());
        m.put("authorName", l.getAuthorName());
        m.put("createdAt", l.getCreatedAt());
        return m;
    }

    // ------------------------------------------------------------------ history

    public List<Map<String, Object>> events(Long projectId) {
        Map<Long, String> lineNames = lineRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId).stream()
                .collect(Collectors.toMap(ProjectWorkLine::getId, ProjectWorkLine::getItemName, (a, b) -> a));
        Map<Long, String> catNames = installCategoryRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId).stream()
                .collect(Collectors.toMap(ProjectInstallCategory::getId, ProjectInstallCategory::getCategory, (a, b) -> a));
        return eventRepository.findByProjectIdAndIsDeletedFalseOrderByCreatedAtDesc(projectId).stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("workLineId", e.getWorkLineId());
            m.put("itemName", e.getWorkLineId() != null ? lineNames.get(e.getWorkLineId()) : null);
            m.put("installCategoryId", e.getInstallCategoryId());
            m.put("category", e.getInstallCategoryId() != null ? catNames.get(e.getInstallCategoryId()) : null);
            m.put("stepType", e.getStepType());
            m.put("stepLabel", STEP_LABELS.getOrDefault(e.getStepType(), e.getStepType()));
            m.put("action", e.getAction());
            m.put("percent", e.getPercent());
            m.put("note", e.getNote());
            m.put("photoUrl", e.getPhotoUrl());
            m.put("actorName", e.getActorName());
            m.put("createdAt", e.getCreatedAt());
            return m;
        }).toList();
    }

    private void logEvent(Long projectId, Long lineId, Long stepId, Long installCategoryId, String stepType,
                          String action, Integer percent, String note, String photoUrl, User user) {
        ProjectWorkEvent e = new ProjectWorkEvent();
        e.setProjectId(projectId);
        e.setWorkLineId(lineId);
        e.setStepId(stepId);
        e.setInstallCategoryId(installCategoryId);
        e.setStepType(stepType);
        e.setAction(action);
        e.setPercent(percent);
        e.setNote(note != null && note.length() > 500 ? note.substring(0, 500) : note);
        e.setPhotoUrl(photoUrl);
        if (user != null) {
            e.setActorId(user.getId());
            e.setActorName(user.getName());
        }
        eventRepository.save(e);
    }

    // ------------------------------------------------------------------ helpers

    private static String categoryOf(String raw) {
        return raw == null || raw.isBlank() ? "Others" : raw.trim();
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean hasAny(String hay, String... keys) {
        for (String k : keys) if (hay.contains(k)) return true;
        return false;
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : (b != null && !b.isBlank() ? b : null);
    }

    private static String blankToNull(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static int toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.intValue();
        return (int) Math.round(Double.parseDouble(String.valueOf(v)));
    }

    private static int clamp(Integer v) {
        return v == null ? 0 : Math.max(0, Math.min(100, v));
    }
}

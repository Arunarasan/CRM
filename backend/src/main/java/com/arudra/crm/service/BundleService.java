package com.arudra.crm.service;

import com.arudra.crm.dto.workforce.AssignResourceRequest;
import com.arudra.crm.dto.BundleRequests;
import com.arudra.crm.dto.BundleView;
import com.arudra.crm.dto.InvoicePaymentSplit;
import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Orders (called "bundles" in code and tables): the customer's material that needs work (stitching /
 * making) after a sale is tracked as physical orders, each with a printed sticker code. Scanning/typing
 * the code opens the order (items, work specs, status, history) and staff move it through four steps:
 * ORDER → PROCESS → COMPLETED → DELIVERED (CANCELLED only when the bill is cancelled).
 *
 * <p>Floor staff can only step an order forward one step; admins/managers may jump or step back
 * (logged as an override).
 *
 * <p>An order leaves by PICKUP, DELIVERY or INSTALL. INSTALL is set only from a bill that includes
 * installation: the order is linked to the bill's installation task ({@code installTaskId}), the
 * installer is told when every linked order is COMPLETED, and {@link #markInstalled} (installer on
 * site, may collect the balance) delivers them all and closes the installation task.
 *
 * <p>Every bundle owns one task on the task board (source {@code BUNDLE}, "Stitching" lane): the
 * bundle's tailor is the task's assignee and the bundle status drives the task status (see
 * {@link #applyBundleStatus}). Assigning the task from the board flows back onto the bundle
 * (EmployeeTaskService), and the daily task-overdue scheduler covers late bundles.
 */
@Service
public class BundleService {

    public static final List<String> FLOW = List.of("ORDER", "PROCESS", "COMPLETED", "DELIVERED");
    public static final String COMPLETED = "COMPLETED";
    public static final String DELIVERED = "DELIVERED";
    public static final String CANCELLED = "CANCELLED";
    public static final String INSTALL = "INSTALL";
    private static final List<String> CLOSED = List.of(DELIVERED, CANCELLED);
    private static final Set<String> WORK_TYPES = Set.of("STITCHING", "MAKING", "FITTING", "OTHER");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "URGENT");
    /** Staff may pick these; INSTALL comes only from a bill with installation. */
    private static final Set<String> HANDOVER_MODES = Set.of("PICKUP", "DELIVERY");
    /** Sticker code prefix (JB-0042). */
    private static final String CODE_PREFIX = "JB";

    @Autowired private BundleRepository bundleRepository;
    @Autowired private BundleItemRepository itemRepository;
    @Autowired private BundleEventRepository eventRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private InvoiceItemRepository invoiceItemRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private DocumentNumberService documentNumberService;
    @Autowired private WorkforceResourceService resourceService;
    @Autowired private NotificationService notificationService;
    @Autowired private TaskService taskService;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Lazy @Autowired private EmployeeTaskService employeeTaskService;
    @Lazy @Autowired private FinanceService financeService;

    private static final ObjectMapper JSON = new ObjectMapper();

    // =====================================================================
    // Create
    // =====================================================================

    /** Creates the bundles (one sticker each) for a bill. Returns them in bundle-number order. */
    @Transactional
    public List<BundleView> create(BundleRequests.Create req, User user) {
        if (req == null || req.bundles == null || req.bundles.isEmpty()) {
            throw new IllegalArgumentException("Add at least one bundle");
        }
        Invoice invoice = null;
        Long customerId = req.customerId;
        if (req.invoiceId != null) {
            invoice = invoiceRepository.findById(req.invoiceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + req.invoiceId));
            if (CANCELLED.equals(invoice.getStatus())) {
                throw new IllegalStateException("Bill " + invoice.getInvoiceNumber() + " is cancelled");
            }
            if (invoice.getCustomer() != null) customerId = invoice.getCustomer().getId();
        }
        if (invoice == null && customerId == null) {
            throw new IllegalArgumentException("An order needs a bill or a customer");
        }

        Map<Long, InvoiceItem> billLines = invoice == null ? Map.of()
                : invoiceItemRepository.findByInvoiceId(invoice.getId()).stream()
                    .collect(Collectors.toMap(InvoiceItem::getId, Function.identity(), (a, b) -> a));

        boolean hasResource = req.resourceType != null && !req.resourceType.isBlank() && req.resourceId != null;
        String resourceType = hasResource ? ResourceType.normalize(req.resourceType) : null;
        if (hasResource && !resourceService.exists(resourceType, req.resourceId)) {
            throw new IllegalArgumentException("Selected tailor / worker was not found");
        }

        // INSTALL only when the bill itself includes installation: link its installation task.
        Long installTaskId = null;
        if (invoice != null) {
            Long billId = invoice.getId();
            installTaskId = req.installTaskId != null
                    ? taskRepository.findById(req.installTaskId).filter(t -> billId.equals(t.getInvoiceId()))
                        .map(Task::getId)
                        .orElseThrow(() -> new IllegalArgumentException("That installation task is not on this bill"))
                    : taskRepository.findFirstByInvoiceIdAndSourceAndStatusNotOrderByIdAsc(billId, "MANUAL", "CANCELLED")
                        .map(Task::getId).orElse(null);
        }

        int total = req.bundles.size();
        String groupCode = String.format("%s-%04d", CODE_PREFIX, documentNumberService.nextValue("BUNDLE"));
        List<Bundle> created = new ArrayList<>();
        for (int i = 0; i < total; i++) {
            BundleRequests.BundleSpec spec = req.bundles.get(i);
            Bundle b = new Bundle();
            b.setGroupCode(groupCode);
            b.setCode(total > 1 ? groupCode + "-" + (i + 1) : groupCode);
            b.setInvoiceId(invoice != null ? invoice.getId() : null);
            b.setCustomerId(customerId);
            b.setBundleNo(i + 1);
            b.setBundleTotal(total);
            b.setStatus(FLOW.get(0));
            b.setWorkType(pick(req.workType, WORK_TYPES, "STITCHING"));
            b.setPriority(pick(req.priority, PRIORITIES, "MEDIUM"));
            if (installTaskId != null) {
                b.setHandoverMode(INSTALL);
                b.setInstallTaskId(installTaskId);
            } else {
                b.setHandoverMode(pick(req.handoverMode, HANDOVER_MODES, "PICKUP"));
            }
            b.setDueDate(parseDate(req.dueDate));
            b.setRackLocation(blankToNull(req.rackLocation));
            b.setNotes(blankToNull(req.notes));
            if (hasResource) {
                b.setResourceType(resourceType);
                b.setResourceId(req.resourceId);
            }
            Bundle saved = bundleRepository.save(b);

            int itemCount = 0;
            if (spec != null && spec.items != null) {
                for (BundleRequests.ItemSpec is : spec.items) {
                    if (is == null) continue;
                    BundleItem item = new BundleItem();
                    item.setBundleId(saved.getId());
                    InvoiceItem line = is.invoiceItemId != null ? billLines.get(is.invoiceItemId) : null;
                    if (is.invoiceItemId != null && line == null) {
                        throw new IllegalArgumentException("Bill line " + is.invoiceItemId + " is not on this bill");
                    }
                    item.setInvoiceItemId(is.invoiceItemId);
                    item.setProductId(is.productId != null ? is.productId : line != null ? line.getProductId() : null);
                    String desc = blankToNull(is.description);
                    if (desc == null && line != null) desc = line.getDescription();
                    if (desc == null) continue; // nothing to identify the item by
                    item.setDescription(desc.length() > 500 ? desc.substring(0, 500) : desc);
                    BigDecimal qty = is.quantity;
                    if ((qty == null || qty.signum() <= 0) && line != null && line.getQuantity() != null) {
                        qty = BigDecimal.valueOf(line.getQuantity());
                    }
                    item.setQuantity(qty == null || qty.signum() <= 0 ? BigDecimal.ONE : qty);
                    item.setUnit(blankToNull(is.unit) != null ? is.unit.trim() : line != null ? line.getUnit() : null);
                    item.setWorkSpec(blankToNull(is.workSpec));
                    item.setNotes(blankToNull(is.notes));
                    item.setPhotoUrls(blankToNull(is.photoUrls));
                    itemRepository.save(item);
                    itemCount++;
                }
            }
            if (itemCount == 0) {
                throw new IllegalArgumentException("Order " + saved.getCode() + " has no items");
            }
            logEvent(saved, null, saved.getStatus(), user, "Order created", null);
            created.add(saved);
        }

        // One task-board task per bundle (assigning it also notifies the tailor).
        for (Bundle b : created) ensureTask(b, user);
        return created.stream().map(b -> toView(b, true)).toList();
    }

    // =====================================================================
    // Read
    // =====================================================================

    /** The scan lookup. A group code (JB-0042) of a multi-bundle order opens its first bundle. */
    public BundleView getByCode(String code) {
        String c = code == null ? "" : code.trim();
        if (c.isEmpty()) throw new IllegalArgumentException("Enter an order code");
        Bundle b = bundleRepository.findFirstByCodeIgnoreCaseAndIsDeletedFalse(c)
                .or(() -> bundleRepository.findByGroupCodeIgnoreCaseAndIsDeletedFalseOrderByBundleNoAsc(c)
                        .stream().findFirst())
                .orElseThrow(() -> new ResourceNotFoundException("No order found for code " + c));
        return toView(b, true);
    }

    /**
     * What the scan box finds for a typed/scanned value: a bundle code opens that bundle, a group
     * code (JB-0042) all its bundles, and a bill number every bundle of that bill.
     */
    public List<BundleView> lookup(String q) {
        String c = q == null ? "" : q.trim();
        if (c.isEmpty()) throw new IllegalArgumentException("Enter an order code or bill number");
        Optional<Bundle> exact = bundleRepository.findFirstByCodeIgnoreCaseAndIsDeletedFalse(c);
        if (exact.isPresent()) return List.of(toView(exact.get(), true));
        List<Bundle> group = bundleRepository.findByGroupCodeIgnoreCaseAndIsDeletedFalseOrderByBundleNoAsc(c);
        if (!group.isEmpty()) return group.stream().map(b -> toView(b, true)).toList();
        List<BundleView> bill = invoiceRepository.findFirstByInvoiceNumberIgnoreCase(c)
                .map(inv -> forInvoice(inv.getId())).orElse(List.of());
        if (!bill.isEmpty()) return bill;
        throw new ResourceNotFoundException("No order found for " + c);
    }

    public BundleView get(Long id) {
        return toView(find(id), true);
    }

    public Page<BundleView> search(String status, String resourceType, Long resourceId, boolean overdue,
                                   boolean openOnly, String q, int page, int size) {
        String st = blankToNull(status);
        String rt = blankToNull(resourceType) == null || resourceId == null ? null : ResourceType.normalize(resourceType);
        Page<Bundle> rows = bundleRepository.search(st, rt, rt == null ? null : resourceId,
                overdue ? LocalDate.now() : null, openOnly, blankToNull(q),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200)));
        Map<Long, Customer> customers = loadCustomers(rows.getContent());
        Map<Long, Invoice> invoices = loadInvoices(rows.getContent());
        Map<Long, List<BundleItem>> items = itemRepository
                .findByBundleIdInAndIsDeletedFalse(rows.getContent().stream().map(Bundle::getId).toList())
                .stream().collect(Collectors.groupingBy(BundleItem::getBundleId));
        return rows.map(b -> fill(b, customers.get(b.getCustomerId()), invoices.get(b.getInvoiceId()),
                items.getOrDefault(b.getId(), List.of())));
    }

    /** Bundles of a bill, with items (the sticker print needs them). */
    public List<BundleView> forInvoice(Long invoiceId) {
        return bundleRepository.findByInvoiceIdAndIsDeletedFalseOrderByBundleNoAsc(invoiceId).stream()
                .map(b -> toView(b, true)).toList();
    }

    /** Counts per status for open orders, plus overdue and ready-for-handover totals. */
    public Map<String, Object> summary() {
        List<Bundle> open = bundleRepository.findByIsDeletedFalseAndStatusNotIn(CLOSED);
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (String s : FLOW) if (!DELIVERED.equals(s)) byStatus.put(s, 0L);
        LocalDate today = LocalDate.now();
        long overdue = 0;
        for (Bundle b : open) {
            byStatus.merge(b.getStatus(), 1L, Long::sum);
            if (b.getDueDate() != null && b.getDueDate().isBefore(today)) overdue++;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("byStatus", byStatus);
        out.put("open", open.size());
        out.put("overdue", overdue);
        out.put("ready", byStatus.getOrDefault(COMPLETED, 0L));
        out.put("inWork", open.size() - byStatus.getOrDefault(COMPLETED, 0L));
        return out;
    }

    // =====================================================================
    // Workflow
    // =====================================================================

    /**
     * Moves a bundle to {@code req.status}. Non-admins may only take the next step in {@link #FLOW};
     * admins/managers may jump forward or step back (recorded as an override).
     */
    @Transactional
    public BundleView move(Long id, BundleRequests.Move req, User user, boolean canOverride) {
        Bundle b = find(id);
        String to = req == null || req.status == null ? "" : req.status.trim().toUpperCase();
        if (!FLOW.contains(to)) throw new IllegalArgumentException("Unknown status: " + to);
        String from = b.getStatus();
        if (CANCELLED.equals(from)) throw new IllegalStateException("This order is cancelled");
        if (to.equals(from)) return toView(b, true);

        int fromIdx = FLOW.indexOf(from);
        int toIdx = FLOW.indexOf(to);
        boolean nextStep = toIdx == fromIdx + 1;
        if (DELIVERED.equals(to) && !canOverride) {
            BigDecimal due = balanceDue(b.getInvoiceId());
            if (due.signum() > 0) {
                throw new IllegalStateException(rupees(due) + " is still due on bill " + invoiceNumber(b.getInvoiceId())
                        + " — collect it with " + (INSTALL.equals(b.getHandoverMode()) ? "Mark Installed" : "Hand over")
                        + ", or ask a manager.");
            }
        }
        if (!nextStep && !canOverride) {
            throw new IllegalStateException("Next step for " + b.getCode() + " is " + stepLabel(FLOW.get(Math.min(fromIdx + 1, FLOW.size() - 1)))
                    + ". Only a manager can skip or go back.");
        }

        b.setStatus(to);
        if (toIdx >= FLOW.indexOf(COMPLETED) && b.getPackedAt() == null) b.setPackedAt(LocalDateTime.now());
        if (toIdx < FLOW.indexOf(COMPLETED)) b.setPackedAt(null);
        if (DELIVERED.equals(to)) {
            b.setDeliveredAt(LocalDateTime.now());
            b.setDeliveredTo(blankToNull(req.deliveredTo));
        } else {
            b.setDeliveredAt(null);
            b.setDeliveredTo(null);
        }
        bundleRepository.save(b);

        String note = blankToNull(req.note);
        if (!nextStep) note = (toIdx < fromIdx ? "Moved back" : "Skipped ahead") + " by manager" + (note == null ? "" : " — " + note);
        if (DELIVERED.equals(to) && b.getDeliveredTo() != null) {
            note = (note == null ? "" : note + " · ") + (INSTALL.equals(b.getHandoverMode()) ? "Installed for " : "Handed to ")
                    + b.getDeliveredTo();
        }
        logEvent(b, from, to, user, note, blankToNull(req.photoUrl));
        syncTaskStatus(b);

        if (COMPLETED.equals(to)) {
            String mode = b.getHandoverMode();
            notificationService.dispatchToAdmins("Order " + b.getCode() + " is completed",
                    "Ready for " + (INSTALL.equals(mode) ? "installation" : "DELIVERY".equals(mode) ? "delivery" : "pickup")
                            + customerSuffix(b), "BUNDLE_READY", "/bundles/" + b.getId(),
                    user != null ? user.getId() : null);
            if (INSTALL.equals(mode)) notifyInstallerIfReady(b);
        }
        if (DELIVERED.equals(to) && INSTALL.equals(b.getHandoverMode())) closeInstallTaskIfDone(b, user);
        return toView(b, true);
    }

    // =====================================================================
    // Installation (orders from a bill that includes installation)
    // =====================================================================

    /** The orders an installation task installs, cancelled ones left out (empty for a plain install task). */
    private List<Bundle> installOrders(Long installTaskId) {
        if (installTaskId == null) return List.of();
        return bundleRepository.findByInstallTaskIdAndIsDeletedFalseOrderByBundleNoAsc(installTaskId).stream()
                .filter(x -> !CANCELLED.equals(x.getStatus())).toList();
    }

    /** Every linked order is COMPLETED → tell the installer the job can go out. */
    private void notifyInstallerIfReady(Bundle b) {
        List<Bundle> orders = installOrders(b.getInstallTaskId());
        if (orders.isEmpty() || orders.stream().anyMatch(x -> FLOW.indexOf(x.getStatus()) < FLOW.indexOf(COMPLETED))) return;
        String codes = orders.stream().map(Bundle::getCode).collect(Collectors.joining(", "));
        String title = "Ready to install: " + b.getGroupCode();
        String message = "Order " + codes + " is completed — take it and install" + customerSuffix(b);
        for (Long userId : installerUserIds(b.getInstallTaskId())) {
            notificationService.dispatch(title, message, "BUNDLE_READY", userId, "/employee/tasks/" + b.getInstallTaskId());
        }
    }

    /** Users who install: the installation task's active employee assignees (or its assigned employee). */
    private Set<Long> installerUserIds(Long taskId) {
        Set<Long> ids = new LinkedHashSet<>();
        for (TaskAssignment a : assignmentRepository.findByTaskId(taskId)) {
            if ("CANCELLED".equals(a.getStatus()) || "REJECTED".equals(a.getStatus())) continue;
            if (a.getEmployee() != null) ids.add(a.getEmployee().getId());
            else if (ResourceType.EMPLOYEE.equals(a.getResourceType()) && a.getResourceId() != null) ids.add(a.getResourceId());
        }
        if (ids.isEmpty()) {
            taskRepository.findById(taskId).map(Task::getAssignedEmployee).ifPresent(u -> ids.add(u.getId()));
        }
        return ids;
    }

    private String installerName(Long taskId) {
        List<String> names = new ArrayList<>();
        for (TaskAssignment a : assignmentRepository.findByTaskId(taskId)) {
            if ("CANCELLED".equals(a.getStatus()) || "REJECTED".equals(a.getStatus())) continue;
            if (a.getEmployee() != null) names.add(a.getEmployee().getName());
            else if (a.getResourceId() != null) names.add(resourceService.displayName(a.getResourceType(), a.getResourceId()));
        }
        if (names.isEmpty()) {
            return taskRepository.findById(taskId).map(Task::getAssignedEmployee).map(User::getName).orElse(null);
        }
        return String.join(", ", names);
    }

    /** Every linked order delivered → the installation task is done too. */
    private void closeInstallTaskIfDone(Bundle b, User user) {
        List<Bundle> orders = installOrders(b.getInstallTaskId());
        if (orders.isEmpty() || !orders.stream().allMatch(x -> DELIVERED.equals(x.getStatus()))) return;
        employeeTaskService.finishInstallTask(b.getInstallTaskId(), user);
    }

    /**
     * What the installer's task shows: the linked orders, whether all are completed (ready to install)
     * and what is still owed on the bill. Null when the task installs no orders.
     */
    public Map<String, Object> installInfo(Long taskId) {
        List<Bundle> orders = installOrders(taskId);
        if (orders.isEmpty()) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("orders", orders.stream().map(x -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", x.getId());
            m.put("code", x.getCode());
            m.put("status", x.getStatus());
            m.put("itemCount", itemRepository.findByBundleIdAndIsDeletedFalseOrderByIdAsc(x.getId()).size());
            return m;
        }).toList());
        out.put("ready", orders.stream().allMatch(x -> COMPLETED.equals(x.getStatus()) || DELIVERED.equals(x.getStatus())));
        out.put("installed", orders.stream().allMatch(x -> DELIVERED.equals(x.getStatus())));
        List<Long> invoiceIds = orders.stream().map(Bundle::getInvoiceId).filter(Objects::nonNull).distinct().sorted().toList();
        out.put("invoiceNumber", invoiceIds.isEmpty() ? null : invoiceNumber(invoiceIds.get(0)));
        out.put("balanceDue", totalDue(invoiceIds));
        return out;
    }

    /** True when the task installs orders that are not all delivered yet (it closes through Mark Installed). */
    public boolean installPending(Long taskId) {
        List<Bundle> orders = installOrders(taskId);
        return !orders.isEmpty() && !orders.stream().allMatch(x -> DELIVERED.equals(x.getStatus()));
    }

    /**
     * The installer on site: collects what the customer pays now (installers may collect), then marks
     * every linked order installed (DELIVERED), which also closes the installation task. Anything still
     * owed afterwards needs a manager, as at the counter.
     */
    @Transactional
    public List<BundleView> markInstalled(Long taskId, BundleRequests.Handover req, User user, boolean canOverride) {
        List<Bundle> orders = installOrders(taskId).stream().filter(x -> !DELIVERED.equals(x.getStatus())).toList();
        if (orders.isEmpty()) throw new IllegalStateException("This task has no order waiting to be installed");
        if (!canOverride && (user == null || !installerUserIds(taskId).contains(user.getId()))) {
            throw new IllegalStateException("Only the installer on this task can mark it installed");
        }
        for (Bundle x : orders) {
            if (!COMPLETED.equals(x.getStatus())) {
                throw new IllegalStateException("Order " + x.getCode() + " is still at " + stepLabel(x.getStatus())
                        + " — it can be installed once it is Completed.");
            }
        }
        BundleRequests.Handover h = req == null ? new BundleRequests.Handover() : req;
        h.bundleIds = orders.stream().map(Bundle::getId).toList();
        return handover(h, user, canOverride, true);
    }

    private static String stepLabel(String status) {
        return switch (status == null ? "" : status) {
            case "ORDER" -> "Order";
            case "PROCESS" -> "Process";
            case "COMPLETED" -> "Completed";
            case "DELIVERED" -> "Delivered";
            default -> status;
        };
    }

    @Transactional
    public BundleView assign(Long id, BundleRequests.Assign req, User user) {
        Bundle b = find(id);
        boolean clear = req == null || req.resourceType == null || req.resourceType.isBlank() || req.resourceId == null;
        if (clear) {
            b.setResourceType(null);
            b.setResourceId(null);
            bundleRepository.save(b);
            logEvent(b, b.getStatus(), b.getStatus(), user, "Unassigned", null);
            syncTaskAssignment(b, user);
            return toView(b, true);
        }
        String type = ResourceType.normalize(req.resourceType);
        if (!resourceService.exists(type, req.resourceId)) {
            throw new IllegalArgumentException("Selected tailor / worker was not found");
        }
        b.setResourceType(type);
        b.setResourceId(req.resourceId);
        bundleRepository.save(b);
        logEvent(b, b.getStatus(), b.getStatus(), user,
                "Assigned to " + resourceService.displayName(type, req.resourceId), null);
        syncTaskAssignment(b, user); // also notifies the tailor
        return toView(b, true);
    }

    @Transactional
    public BundleView update(Long id, BundleRequests.Update req, User user) {
        Bundle b = find(id);
        if (req == null) return toView(b, true);
        if (req.workType != null) b.setWorkType(pick(req.workType, WORK_TYPES, b.getWorkType()));
        if (req.priority != null) b.setPriority(pick(req.priority, PRIORITIES, b.getPriority()));
        // INSTALL comes from the bill and can't be picked or dropped here.
        if (req.handoverMode != null && !INSTALL.equals(b.getHandoverMode())) {
            b.setHandoverMode(pick(req.handoverMode, HANDOVER_MODES, b.getHandoverMode()));
        }
        if (req.dueDate != null) b.setDueDate(parseDate(req.dueDate));
        if (req.rackLocation != null) b.setRackLocation(blankToNull(req.rackLocation));
        if (req.notes != null) b.setNotes(blankToNull(req.notes));
        bundleRepository.save(b);
        if (req.dueDate != null || req.priority != null || req.workType != null) {
            taskFor(b).ifPresent(t -> {
                t.setDueDate(b.getDueDate());
                t.setPriority(taskPriority(b.getPriority()));
                t.setTaskName(taskName(b));
                taskRepository.save(t);
            });
        }

        if (req.items != null) {
            Map<Long, BundleItem> mine = itemRepository.findByBundleIdAndIsDeletedFalseOrderByIdAsc(b.getId()).stream()
                    .collect(Collectors.toMap(BundleItem::getId, Function.identity()));
            for (BundleRequests.ItemUpdate u : req.items) {
                if (u == null || u.id == null) continue;
                BundleItem item = mine.get(u.id);
                if (item == null) continue;
                if (u.workSpec != null) item.setWorkSpec(blankToNull(u.workSpec));
                if (u.notes != null) item.setNotes(blankToNull(u.notes));
                if (u.photoUrls != null) item.setPhotoUrls(blankToNull(u.photoUrls));
                if (u.done != null) item.setDone(u.done);
                itemRepository.save(item);
            }
        }
        return toView(b, true);
    }

    /**
     * Hands bundles to the customer in one go: first collects any payments against their bill(s)
     * (oldest bill first), then marks each bundle DELIVERED. If a balance is still due afterwards,
     * only a manager may proceed, with {@code allowBalanceDue} and a reason (logged on each bundle).
     */
    @Transactional
    public List<BundleView> handover(BundleRequests.Handover req, User user, boolean canOverride, boolean canCollect) {
        if (req == null || req.bundleIds == null || req.bundleIds.isEmpty()) {
            throw new IllegalArgumentException("Pick at least one order to hand over");
        }
        List<Bundle> bundles = req.bundleIds.stream().distinct().map(this::find).toList();
        for (Bundle b : bundles) {
            if (CLOSED.contains(b.getStatus())) throw new IllegalStateException(b.getCode() + " is already " + b.getStatus().toLowerCase());
            if (!COMPLETED.equals(b.getStatus()) && !canOverride) {
                throw new IllegalStateException(b.getCode() + " is not completed yet. Only a manager can hand it over early.");
            }
        }
        List<Long> invoiceIds = bundles.stream().map(Bundle::getInvoiceId).filter(Objects::nonNull)
                .distinct().sorted().toList();

        // 1. collect what the customer pays now, oldest bill first
        List<BundleRequests.Payment> tenders = req.payments == null ? List.of() : req.payments.stream()
                .filter(p -> p != null && p.amount != null && p.amount.signum() > 0).toList();
        if (!tenders.isEmpty()) {
            if (!canCollect) throw new IllegalStateException("You are not allowed to collect payments");
            if (invoiceIds.isEmpty()) throw new IllegalStateException("These orders have no bill to collect against");
            BigDecimal owed = totalDue(invoiceIds);
            BigDecimal paying = tenders.stream().map(p -> p.amount).reduce(BigDecimal.ZERO, BigDecimal::add);
            if (paying.compareTo(owed) > 0) {
                throw new IllegalArgumentException("Collecting " + rupees(paying) + " but only " + rupees(owed) + " is due");
            }
            Deque<BundleRequests.Payment> left = new ArrayDeque<>();
            for (BundleRequests.Payment p : tenders) {
                BundleRequests.Payment copy = new BundleRequests.Payment();
                copy.method = p.method;
                copy.amount = p.amount;
                copy.referenceNumber = p.referenceNumber;
                left.add(copy);
            }
            for (Long invoiceId : invoiceIds) {
                BigDecimal due = balanceDue(invoiceId);
                List<InvoicePaymentSplit> splits = new ArrayList<>();
                while (due.signum() > 0 && !left.isEmpty()) {
                    BundleRequests.Payment p = left.peek();
                    BigDecimal take = p.amount.min(due);
                    String method = p.method == null || p.method.isBlank() ? "CASH" : p.method.trim().toUpperCase();
                    splits.add(new InvoicePaymentSplit(method, take, blankToNull(p.referenceNumber)));
                    due = due.subtract(take);
                    p.amount = p.amount.subtract(take);
                    if (p.amount.signum() <= 0) left.poll();
                }
                if (!splits.isEmpty()) financeService.markInvoicePaid(invoiceId, splits, user);
            }
        }

        // 2. anything still owed?
        BigDecimal stillDue = totalDue(invoiceIds);
        String note = blankToNull(req.note);
        if (stillDue.signum() > 0) {
            if (!canOverride) {
                throw new IllegalStateException(rupees(stillDue) + " is still due — collect it before handing over, or ask a manager.");
            }
            if (!req.allowBalanceDue || note == null) {
                throw new IllegalStateException(rupees(stillDue) + " is still due — tick \"hand over with balance due\" and give a reason.");
            }
            note = "Handed over with " + rupees(stillDue) + " due (manager) — " + note;
        }

        // 3. deliver (balance already checked above, so the per-bundle gate is satisfied)
        List<BundleView> out = new ArrayList<>();
        for (Bundle b : bundles) {
            BundleRequests.Move mv = new BundleRequests.Move();
            mv.status = DELIVERED;
            mv.note = note;
            mv.photoUrl = req.photoUrl;
            mv.deliveredTo = req.deliveredTo;
            out.add(move(b.getId(), mv, user, canOverride || stillDue.signum() == 0));
        }
        return out;
    }

    private BigDecimal totalDue(List<Long> invoiceIds) {
        return invoiceIds.stream().map(this::balanceDue).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** What is still owed on a bill (0 for none / draft / cancelled). */
    private BigDecimal balanceDue(Long invoiceId) {
        if (invoiceId == null) return BigDecimal.ZERO;
        return invoiceRepository.findById(invoiceId).map(BundleService::owed).orElse(BigDecimal.ZERO);
    }

    private static BigDecimal owed(Invoice inv) {
        if (CANCELLED.equals(inv.getStatus()) || "DRAFT".equals(inv.getStatus())) return BigDecimal.ZERO;
        BigDecimal due = inv.getBalanceDue() != null ? inv.getBalanceDue() : inv.getTotalAmount();
        return due == null ? BigDecimal.ZERO : due.max(BigDecimal.ZERO);
    }

    private String invoiceNumber(Long invoiceId) {
        return invoiceId == null ? "" : invoiceRepository.findById(invoiceId).map(Invoice::getInvoiceNumber).orElse("");
    }

    private static String rupees(BigDecimal v) {
        return "₹" + v.setScale(2, java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    /** Called when a bill is cancelled: every open bundle of it is cancelled too. */
    @Transactional
    public void cancelForInvoice(Long invoiceId, String reason) {
        for (Bundle b : bundleRepository.findByInvoiceIdAndIsDeletedFalseOrderByBundleNoAsc(invoiceId)) {
            if (CLOSED.contains(b.getStatus())) continue;
            String from = b.getStatus();
            b.setStatus(CANCELLED);
            bundleRepository.save(b);
            logEvent(b, from, CANCELLED, null, "Bill cancelled" + (reason == null || reason.isBlank() ? "" : ": " + reason), null);
            syncTaskStatus(b);
        }
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private Bundle find(Long id) {
        return bundleRepository.findById(id)
                .filter(b -> !Boolean.TRUE.equals(b.getIsDeleted()))
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
    }

    private void logEvent(Bundle b, String from, String to, User user, String note, String photoUrl) {
        BundleEvent e = new BundleEvent();
        e.setBundleId(b.getId());
        e.setFromStatus(from);
        e.setToStatus(to);
        if (user != null) {
            e.setUserId(user.getId());
            e.setUserName(user.getName() != null ? user.getName() : user.getEmail());
        }
        e.setNote(note != null && note.length() > 1000 ? note.substring(0, 1000) : note);
        e.setPhotoUrl(photoUrl);
        eventRepository.save(e);
    }

    // ---------------------------------------------------------------- task-board link

    /** Order status -> task status: Order = waiting, Process = being worked on, Completed onwards = done. */
    public static void applyBundleStatus(Task task, String bundleStatus) {
        int idx = FLOW.indexOf(bundleStatus);
        String status;
        if (CANCELLED.equals(bundleStatus)) status = "CANCELLED";
        else if (idx >= FLOW.indexOf(COMPLETED)) status = "COMPLETED";
        else if (idx > 0) status = "IN_PROGRESS";
        else status = "PENDING";
        task.setStatus(status);
        if (idx >= 0) task.setProgress(Math.min(100, Math.round(idx * 100f / FLOW.indexOf(COMPLETED))));
        if ("COMPLETED".equals(status)) {
            if (task.getCompletedDate() == null) task.setCompletedDate(LocalDate.now());
        } else {
            task.setCompletedDate(null);
        }
    }

    private Optional<Task> taskFor(Bundle b) {
        return b.getTaskId() == null ? Optional.empty() : taskRepository.findById(b.getTaskId());
    }

    /** Creates the bundle's board task if missing, then aligns its assignee and status. */
    private void ensureTask(Bundle b, User user) {
        if (b.getTaskId() == null || taskRepository.findById(b.getTaskId()).isEmpty()) {
            Task task = new Task();
            task.setTaskName(taskName(b));
            task.setSource("BUNDLE");
            task.setStatus("PENDING");
            task.setPriority(taskPriority(b.getPriority()));
            task.setDueDate(b.getDueDate());
            task.setStartDate(LocalDate.now());
            task.setInvoiceId(b.getInvoiceId());
            task.setCustomerId(b.getCustomerId());
            task.setAssignmentType(b.getResourceId() != null ? "SINGLE_EMPLOYEE" : "TEAM");
            task.setDescription(taskDescription(b));
            Task saved = taskService.createTask(task);
            b.setTaskId(saved.getId());
            bundleRepository.save(b);
        }
        syncTaskAssignment(b, user);
    }

    /** Makes the task's active assignee match the bundle's tailor (cancelling anyone else). */
    private void syncTaskAssignment(Bundle b, User user) {
        Task task = taskFor(b).orElse(null);
        if (task == null) {
            if (!CLOSED.contains(b.getStatus())) ensureTask(b, user);
            return;
        }
        for (TaskAssignment a : assignmentRepository.findByTaskId(task.getId())) {
            boolean active = !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus());
            boolean same = Objects.equals(a.getResourceType(), b.getResourceType()) && Objects.equals(a.getResourceId(), b.getResourceId());
            if (active && !same) employeeTaskService.removeResourceAssignment(task.getId(), a.getResourceType(), a.getResourceId());
        }
        if (b.getResourceId() != null) {
            employeeTaskService.assignResources(task.getId(),
                    List.of(new AssignResourceRequest(b.getResourceType(), b.getResourceId(), null)), user);
        }
        syncTaskStatus(b); // assignment recomputes status from assignments; restore the bundle's
    }

    private void syncTaskStatus(Bundle b) {
        if (b.getTaskId() == null && !CLOSED.contains(b.getStatus())) {
            ensureTask(b, null); // bundle from before the task-board link — give it its task now
            return;
        }
        taskFor(b).ifPresent(t -> {
            applyBundleStatus(t, b.getStatus());
            taskRepository.save(t);
        });
    }

    private String taskName(Bundle b) {
        String work = switch (b.getWorkType() == null ? "" : b.getWorkType()) {
            case "MAKING" -> "Making";
            case "FITTING" -> "Fitting";
            case "OTHER" -> "Work";
            default -> "Stitching";
        };
        String name = work + " — " + b.getCode() + customerSuffix(b).replace(" — ", " · ");
        return name.length() > 250 ? name.substring(0, 250) : name;
    }

    private static String taskPriority(String p) {
        return "URGENT".equals(p) ? "HIGH" : (p == null ? "MEDIUM" : p);
    }

    /** Items + work specs, so the task alone tells the tailor what to make. */
    private String taskDescription(Bundle b) {
        StringBuilder sb = new StringBuilder("Order ").append(b.getCode());
        if (b.getBundleTotal() != null && b.getBundleTotal() > 1) {
            sb.append(" (").append(b.getBundleNo()).append(" of ").append(b.getBundleTotal()).append(')');
        }
        sb.append(" — scan the sticker to update its status.\n");
        for (BundleItem i : itemRepository.findByBundleIdAndIsDeletedFalseOrderByIdAsc(b.getId())) {
            sb.append("\n• ").append(i.getDescription()).append(" × ").append(i.getQuantity().stripTrailingZeros().toPlainString());
            if (i.getUnit() != null) sb.append(' ').append(i.getUnit());
            String spec = specSummary(i.getWorkSpec());
            if (!spec.isEmpty()) sb.append(" — ").append(spec);
            if (i.getNotes() != null) sb.append(" (").append(i.getNotes()).append(')');
        }
        if (b.getNotes() != null) sb.append("\n\nNotes: ").append(b.getNotes());
        return sb.toString();
    }

    private static String specSummary(String json) {
        if (json == null || json.isBlank()) return "";
        try {
            JsonNode n = JSON.readTree(json);
            List<String> parts = new ArrayList<>();
            String type = n.path("type").asText("");
            if (!type.isEmpty()) parts.add(type);
            String w = n.path("width").asText(""), h = n.path("height").asText("");
            if (!w.isEmpty() || !h.isEmpty()) parts.add((w.isEmpty() ? "?" : w) + " × " + (h.isEmpty() ? "?" : h) + " in");
            String panels = n.path("panels").asText("");
            if (!panels.isEmpty()) {
                boolean window = type.isEmpty() || type.contains("Curtain") || type.contains("Blind");
                parts.add(panels + (window ? " panels" : " pcs"));
            }
            String pleat = n.path("pleat").asText("");
            if (!pleat.isEmpty() && !"None".equals(pleat)) parts.add(pleat);
            String lining = n.path("lining").asText("");
            if (!lining.isEmpty() && !"None".equals(lining)) parts.add(lining + " lining");
            String notes = n.path("notes").asText("");
            if (!notes.isEmpty()) parts.add(notes);
            return String.join(" · ", parts);
        } catch (Exception ex) {
            return json;
        }
    }

    private String customerSuffix(Bundle b) {
        if (b.getCustomerId() == null) return "";
        return customerRepository.findById(b.getCustomerId()).map(c -> " — " + c.getName()).orElse("");
    }

    private BundleView toView(Bundle b, boolean detail) {
        Customer customer = b.getCustomerId() == null ? null : customerRepository.findById(b.getCustomerId()).orElse(null);
        Invoice invoice = b.getInvoiceId() == null ? null : invoiceRepository.findById(b.getInvoiceId()).orElse(null);
        List<BundleItem> items = itemRepository.findByBundleIdAndIsDeletedFalseOrderByIdAsc(b.getId());
        BundleView v = fill(b, customer, invoice, items);
        if (!detail) return v;

        v.items = items.stream().map(i -> {
            BundleView.Item x = new BundleView.Item();
            x.id = i.getId();
            x.invoiceItemId = i.getInvoiceItemId();
            x.productId = i.getProductId();
            x.description = i.getDescription();
            x.quantity = i.getQuantity();
            x.unit = i.getUnit();
            x.workSpec = i.getWorkSpec();
            x.notes = i.getNotes();
            x.photoUrls = i.getPhotoUrls();
            x.done = Boolean.TRUE.equals(i.getDone());
            return x;
        }).toList();
        v.events = eventRepository.findByBundleIdAndIsDeletedFalseOrderByCreatedAtAsc(b.getId()).stream().map(e -> {
            BundleView.Event x = new BundleView.Event();
            x.id = e.getId();
            x.fromStatus = e.getFromStatus();
            x.toStatus = e.getToStatus();
            x.userName = e.getUserName();
            x.note = e.getNote();
            x.photoUrl = e.getPhotoUrl();
            x.at = e.getCreatedAt();
            return x;
        }).toList();
        v.siblings = bundleRepository.findByGroupCodeIgnoreCaseAndIsDeletedFalseOrderByBundleNoAsc(b.getGroupCode()).stream()
                .map(s -> {
                    BundleView.Sibling x = new BundleView.Sibling();
                    x.id = s.getId();
                    x.code = s.getCode();
                    x.bundleNo = s.getBundleNo();
                    x.status = s.getStatus();
                    return x;
                }).toList();
        return v;
    }

    private BundleView fill(Bundle b, Customer customer, Invoice invoice, List<BundleItem> items) {
        BundleView v = new BundleView();
        v.id = b.getId();
        v.code = b.getCode();
        v.groupCode = b.getGroupCode();
        v.bundleNo = b.getBundleNo();
        v.bundleTotal = b.getBundleTotal();
        v.status = b.getStatus();
        int idx = FLOW.indexOf(b.getStatus());
        v.nextStatus = idx >= 0 && idx < FLOW.size() - 1 ? FLOW.get(idx + 1) : null;
        v.workType = b.getWorkType();
        v.resourceType = b.getResourceType();
        v.resourceId = b.getResourceId();
        v.assigneeName = b.getResourceId() == null ? null : resourceService.displayName(b.getResourceType(), b.getResourceId());
        v.dueDate = b.getDueDate();
        v.overdue = b.getDueDate() != null && b.getDueDate().isBefore(LocalDate.now()) && !CLOSED.contains(b.getStatus());
        v.priority = b.getPriority();
        v.handoverMode = b.getHandoverMode();
        v.installTaskId = b.getInstallTaskId();
        if (b.getInstallTaskId() != null) v.installerName = installerName(b.getInstallTaskId());
        v.rackLocation = b.getRackLocation();
        v.notes = b.getNotes();
        v.packedAt = b.getPackedAt();
        v.deliveredAt = b.getDeliveredAt();
        v.deliveredTo = b.getDeliveredTo();
        v.createdAt = b.getCreatedAt();
        v.invoiceId = b.getInvoiceId();
        if (invoice != null) {
            v.invoiceNumber = invoice.getInvoiceNumber();
            v.invoiceDate = invoice.getDate();
            v.invoiceStatus = invoice.getStatus();
            v.invoiceTotal = invoice.getTotalAmount();
            v.amountPaid = invoice.getAmountPaid();
            v.balanceDue = owed(invoice);
        }
        v.customerId = b.getCustomerId();
        if (customer != null) {
            v.customerName = customer.getName();
            v.customerPhone = customer.getPhone();
        }
        v.itemCount = items.size();
        v.totalQuantity = items.stream().map(BundleItem::getQuantity).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return v;
    }

    private Map<Long, Customer> loadCustomers(List<Bundle> rows) {
        Set<Long> ids = rows.stream().map(Bundle::getCustomerId).filter(Objects::nonNull).collect(Collectors.toSet());
        return ids.isEmpty() ? Map.of() : customerRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Customer::getId, Function.identity()));
    }

    private Map<Long, Invoice> loadInvoices(List<Bundle> rows) {
        Set<Long> ids = rows.stream().map(Bundle::getInvoiceId).filter(Objects::nonNull).collect(Collectors.toSet());
        return ids.isEmpty() ? Map.of() : invoiceRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Invoice::getId, Function.identity()));
    }

    private static String pick(String value, Set<String> allowed, String fallback) {
        if (value == null) return fallback;
        String v = value.trim().toUpperCase();
        return allowed.contains(v) ? v : fallback;
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.trim());
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid date: " + s);
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}

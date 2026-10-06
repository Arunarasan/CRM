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
 * Bundle tracking: the customer's material that needs work (stitching / making) after a sale is
 * tracked as physical bundles, each with a printed sticker code. Scanning/typing the code opens the
 * bundle (items, work specs, status, history) and staff move it through the work steps:
 * RECEIVED → CUTTING → STITCHING → QC_CHECK → PACKED → READY → DELIVERED.
 *
 * <p>Floor staff can only step a bundle forward one step; admins/managers may jump or step back
 * (logged as an override). ON_HOLD parks a bundle with a reason and resumes where it left off.
 *
 * <p>Every bundle owns one task on the task board (source {@code BUNDLE}, "Stitching" lane): the
 * bundle's tailor is the task's assignee and the bundle status drives the task status (see
 * {@link #applyBundleStatus}). Assigning the task from the board flows back onto the bundle
 * (EmployeeTaskService), and the daily task-overdue scheduler covers late bundles.
 */
@Service
public class BundleService {

    public static final List<String> FLOW =
            List.of("RECEIVED", "CUTTING", "STITCHING", "QC_CHECK", "PACKED", "READY", "DELIVERED");
    public static final String ON_HOLD = "ON_HOLD";
    public static final String CANCELLED = "CANCELLED";
    private static final List<String> CLOSED = List.of("DELIVERED", CANCELLED);
    private static final Set<String> WORK_TYPES = Set.of("STITCHING", "MAKING", "FITTING", "OTHER");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "URGENT");
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
            throw new IllegalArgumentException("A bundle needs a bill or a customer");
        }

        Map<Long, InvoiceItem> billLines = invoice == null ? Map.of()
                : invoiceItemRepository.findByInvoiceId(invoice.getId()).stream()
                    .collect(Collectors.toMap(InvoiceItem::getId, Function.identity(), (a, b) -> a));

        boolean hasResource = req.resourceType != null && !req.resourceType.isBlank() && req.resourceId != null;
        String resourceType = hasResource ? ResourceType.normalize(req.resourceType) : null;
        if (hasResource && !resourceService.exists(resourceType, req.resourceId)) {
            throw new IllegalArgumentException("Selected tailor / worker was not found");
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
            b.setHandoverMode(pick(req.handoverMode, HANDOVER_MODES, "PICKUP"));
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
                throw new IllegalArgumentException("Bundle " + saved.getCode() + " has no items");
            }
            logEvent(saved, null, saved.getStatus(), user, "Bundle created", null);
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
        if (c.isEmpty()) throw new IllegalArgumentException("Enter a bundle code");
        Bundle b = bundleRepository.findFirstByCodeIgnoreCaseAndIsDeletedFalse(c)
                .or(() -> bundleRepository.findByGroupCodeIgnoreCaseAndIsDeletedFalseOrderByBundleNoAsc(c)
                        .stream().findFirst())
                .orElseThrow(() -> new ResourceNotFoundException("No bundle found for code " + c));
        return toView(b, true);
    }

    /**
     * What the scan box finds for a typed/scanned value: a bundle code opens that bundle, a group
     * code (JB-0042) all its bundles, and a bill number every bundle of that bill.
     */
    public List<BundleView> lookup(String q) {
        String c = q == null ? "" : q.trim();
        if (c.isEmpty()) throw new IllegalArgumentException("Enter a bundle code or bill number");
        Optional<Bundle> exact = bundleRepository.findFirstByCodeIgnoreCaseAndIsDeletedFalse(c);
        if (exact.isPresent()) return List.of(toView(exact.get(), true));
        List<Bundle> group = bundleRepository.findByGroupCodeIgnoreCaseAndIsDeletedFalseOrderByBundleNoAsc(c);
        if (!group.isEmpty()) return group.stream().map(b -> toView(b, true)).toList();
        List<BundleView> bill = invoiceRepository.findFirstByInvoiceNumberIgnoreCase(c)
                .map(inv -> forInvoice(inv.getId())).orElse(List.of());
        if (!bill.isEmpty()) return bill;
        throw new ResourceNotFoundException("No bundle found for " + c);
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

    /** Counts per status for open bundles, plus overdue and ready-for-handover totals. */
    public Map<String, Object> summary() {
        List<Bundle> open = bundleRepository.findByIsDeletedFalseAndStatusNotIn(CLOSED);
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (String s : FLOW) if (!"DELIVERED".equals(s)) byStatus.put(s, 0L);
        byStatus.put(ON_HOLD, 0L);
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
        out.put("ready", byStatus.getOrDefault("READY", 0L));
        out.put("onHold", byStatus.getOrDefault(ON_HOLD, 0L));
        out.put("inWork", open.size() - byStatus.getOrDefault("READY", 0L) - byStatus.getOrDefault(ON_HOLD, 0L));
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
        if (CANCELLED.equals(from)) throw new IllegalStateException("This bundle is cancelled");
        if (ON_HOLD.equals(from)) throw new IllegalStateException("This bundle is on hold — release it first");
        if (to.equals(from)) return toView(b, true);

        int fromIdx = FLOW.indexOf(from);
        int toIdx = FLOW.indexOf(to);
        boolean nextStep = toIdx == fromIdx + 1;
        if ("DELIVERED".equals(to) && !canOverride) {
            BigDecimal due = balanceDue(b.getInvoiceId());
            if (due.signum() > 0) {
                throw new IllegalStateException(rupees(due) + " is still due on bill " + invoiceNumber(b.getInvoiceId())
                        + " — collect it with Hand over, or ask a manager.");
            }
        }
        if (!nextStep && !canOverride) {
            throw new IllegalStateException("Next step for " + b.getCode() + " is " + FLOW.get(Math.min(fromIdx + 1, FLOW.size() - 1))
                    + ". Only a manager can skip or go back.");
        }

        b.setStatus(to);
        if (toIdx >= FLOW.indexOf("PACKED") && b.getPackedAt() == null) b.setPackedAt(LocalDateTime.now());
        if (toIdx < FLOW.indexOf("PACKED")) b.setPackedAt(null);
        if ("DELIVERED".equals(to)) {
            b.setDeliveredAt(LocalDateTime.now());
            b.setDeliveredTo(blankToNull(req.deliveredTo));
        } else {
            b.setDeliveredAt(null);
            b.setDeliveredTo(null);
        }
        bundleRepository.save(b);

        String note = blankToNull(req.note);
        if (!nextStep) note = (toIdx < fromIdx ? "Moved back" : "Skipped ahead") + " by manager" + (note == null ? "" : " — " + note);
        if ("DELIVERED".equals(to) && b.getDeliveredTo() != null) {
            note = (note == null ? "" : note + " · ") + "Handed to " + b.getDeliveredTo();
        }
        logEvent(b, from, to, user, note, blankToNull(req.photoUrl));
        syncTaskStatus(b);

        if ("READY".equals(to)) {
            notificationService.dispatchToAdmins("Bundle " + b.getCode() + " is ready",
                    "Packed and ready for " + ("DELIVERY".equals(b.getHandoverMode()) ? "delivery" : "pickup")
                            + customerSuffix(b), "BUNDLE_READY", "/bundles/" + b.getId(),
                    user != null ? user.getId() : null);
        }
        return toView(b, true);
    }

    @Transactional
    public BundleView hold(Long id, String reason, User user) {
        Bundle b = find(id);
        if (CLOSED.contains(b.getStatus())) throw new IllegalStateException("This bundle is already closed");
        if (ON_HOLD.equals(b.getStatus())) return toView(b, true);
        String r = blankToNull(reason);
        if (r == null) throw new IllegalArgumentException("Give a reason for the hold");
        String from = b.getStatus();
        b.setHeldFromStatus(from);
        b.setHoldReason(r.length() > 500 ? r.substring(0, 500) : r);
        b.setStatus(ON_HOLD);
        bundleRepository.save(b);
        logEvent(b, from, ON_HOLD, user, r, null);
        syncTaskStatus(b);
        return toView(b, true);
    }

    @Transactional
    public BundleView release(Long id, User user) {
        Bundle b = find(id);
        if (!ON_HOLD.equals(b.getStatus())) return toView(b, true);
        String back = b.getHeldFromStatus() != null && FLOW.contains(b.getHeldFromStatus()) ? b.getHeldFromStatus() : FLOW.get(0);
        b.setStatus(back);
        b.setHeldFromStatus(null);
        b.setHoldReason(null);
        bundleRepository.save(b);
        logEvent(b, ON_HOLD, back, user, "Hold released", null);
        syncTaskStatus(b);
        return toView(b, true);
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
        if (req.handoverMode != null) b.setHandoverMode(pick(req.handoverMode, HANDOVER_MODES, b.getHandoverMode()));
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
            throw new IllegalArgumentException("Pick at least one bundle to hand over");
        }
        List<Bundle> bundles = req.bundleIds.stream().distinct().map(this::find).toList();
        for (Bundle b : bundles) {
            if (CLOSED.contains(b.getStatus())) throw new IllegalStateException(b.getCode() + " is already " + b.getStatus().toLowerCase());
            if (ON_HOLD.equals(b.getStatus())) throw new IllegalStateException(b.getCode() + " is on hold — release it first");
            if (!"READY".equals(b.getStatus()) && !canOverride) {
                throw new IllegalStateException(b.getCode() + " is not ready yet. Only a manager can hand it over early.");
            }
        }
        List<Long> invoiceIds = bundles.stream().map(Bundle::getInvoiceId).filter(Objects::nonNull)
                .distinct().sorted().toList();

        // 1. collect what the customer pays now, oldest bill first
        List<BundleRequests.Payment> tenders = req.payments == null ? List.of() : req.payments.stream()
                .filter(p -> p != null && p.amount != null && p.amount.signum() > 0).toList();
        if (!tenders.isEmpty()) {
            if (!canCollect) throw new IllegalStateException("You are not allowed to collect payments");
            if (invoiceIds.isEmpty()) throw new IllegalStateException("These bundles have no bill to collect against");
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
            mv.status = "DELIVERED";
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
                .orElseThrow(() -> new ResourceNotFoundException("Bundle not found: " + id));
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

    /** Bundle status -> task status: waiting, being worked on, work done (packed onwards), parked, void. */
    public static void applyBundleStatus(Task task, String bundleStatus) {
        int idx = FLOW.indexOf(bundleStatus);
        String status;
        if (CANCELLED.equals(bundleStatus)) status = "CANCELLED";
        else if (ON_HOLD.equals(bundleStatus)) status = "PAUSED";
        else if (idx >= FLOW.indexOf("PACKED")) status = "COMPLETED";
        else if (idx > 0) status = "IN_PROGRESS";
        else status = "PENDING";
        task.setStatus(status);
        if (idx >= 0) task.setProgress(Math.min(100, Math.round(idx * 100f / FLOW.indexOf("PACKED"))));
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
        StringBuilder sb = new StringBuilder("Bundle ").append(b.getCode());
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
        v.heldFromStatus = b.getHeldFromStatus();
        v.holdReason = b.getHoldReason();
        v.workType = b.getWorkType();
        v.resourceType = b.getResourceType();
        v.resourceId = b.getResourceId();
        v.assigneeName = b.getResourceId() == null ? null : resourceService.displayName(b.getResourceType(), b.getResourceId());
        v.dueDate = b.getDueDate();
        v.overdue = b.getDueDate() != null && b.getDueDate().isBefore(LocalDate.now()) && !CLOSED.contains(b.getStatus());
        v.priority = b.getPriority();
        v.handoverMode = b.getHandoverMode();
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

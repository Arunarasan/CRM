package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class QuotationService {

    @Autowired
    private QuotationRepository quotationRepository;

    @Autowired
    private WorkflowTriggerService workflowTriggerService;

    @Autowired
    private QuotationActivityRepository quotationActivityRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectStageRepository projectStageRepository;

    @Autowired
    private ProjectActivityLogRepository projectActivityLogRepository;

    @Autowired
    private ProjectMaterialRequirementRepository projectMaterialRequirementRepository;

    @Autowired
    private BoqItemRepository boqItemRepository;

    @Autowired
    private BoqPhaseRepository boqPhaseRepository;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LeadService leadService;

    @Autowired
    private LeadRepository leadRepository;

    @Autowired
    private SiteVisitRepository siteVisitRepository;

    @Autowired
    private MeasurementRepository measurementRepository;

    @Autowired
    private BoqRepository boqRepository;

    @Autowired
    private LeadDocumentRepository leadDocumentRepository;

    @Autowired
    private ProjectDocumentRepository projectDocumentRepository;

    @Autowired
    private MeasurementDrawingRepository measurementDrawingRepository;

    @Autowired
    private MeasurementMediaRepository measurementMediaRepository;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private FinanceService financeService;

    /**
     * Re-resolves {id}-only JSON refs to managed proxies before save. Without this, Hibernate
     * treats a detached entity whose @Version field is null (as JSON binding produces) as
     * transient and throws PropertyValueException on flush, even for non-cascaded refs.
     */
    private void resolveRefs(Quotation quotation) {
        if (quotation.getCustomer() != null && quotation.getCustomer().getId() != null) {
            quotation.setCustomer(customerRepository.getReferenceById(quotation.getCustomer().getId()));
        }
        quotation.setLead(quotation.getLead() != null && quotation.getLead().getId() != null
                ? leadRepository.getReferenceById(quotation.getLead().getId()) : null);
        quotation.setSiteVisit(quotation.getSiteVisit() != null && quotation.getSiteVisit().getId() != null
                ? siteVisitRepository.getReferenceById(quotation.getSiteVisit().getId()) : null);
        quotation.setMeasurement(quotation.getMeasurement() != null && quotation.getMeasurement().getId() != null
                ? measurementRepository.getReferenceById(quotation.getMeasurement().getId()) : null);
        quotation.setBoq(quotation.getBoq() != null && quotation.getBoq().getId() != null
                ? boqRepository.getReferenceById(quotation.getBoq().getId()) : null);
    }

    public Page<Quotation> getQuotations(String search, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("id").descending());
        if (search != null && !search.isEmpty()) {
            return quotationRepository.searchQuotations(search, pageRequest);
        }
        return quotationRepository.findAll(pageRequest);
    }

    public Quotation getQuotationById(Long id) {
        return quotationRepository.findById(id).orElseThrow(() -> new RuntimeException("Quotation not found"));
    }

    /**
     * Read path for the UI/PDF. Structure (floor/room/category/ordering + material-labour split +
     * dims) is BOQ-owned and NOT editable in the quotation, so on every view we project it live from
     * the linked BOQ onto each traceable line (matched by boqItemId). This guarantees the quotation
     * always mirrors the BOQ's Floor→Room→Category structure — including quotations generated before
     * the upgrade (whose items have null floor/room) and BOQs organised by room with no floor set.
     * Pricing (rate/discount/GST/total/status/remarks) is never touched. readOnly: the in-memory
     * projection is enough for display/PDF; an explicit "Sync from BOQ" is what persists it.
     */
    @Transactional(readOnly = true)
    public Quotation getQuotationForView(Long id) {
        Quotation quotation = getQuotationById(id);
        if (projectStructureFromBoq(quotation)) {
            recalculateTotals(quotation);
        }
        return quotation;
    }

    private boolean projectStructureFromBoq(Quotation quotation) {
        if (quotation.getBoq() == null || quotation.getBoq().getId() == null || quotation.getItems() == null) return false;
        boolean anyTraceable = quotation.getItems().stream().anyMatch(i -> i.getBoqItemId() != null);
        if (!anyTraceable) return false;
        Map<Long, BoqItem> boqItems = new HashMap<>();
        boqRepository.findById(quotation.getBoq().getId())
                .ifPresent(boq -> boq.getItems().forEach(bi -> boqItems.put(bi.getId(), bi)));
        if (boqItems.isEmpty()) return false;
        boolean changed = false;
        for (QuotationItem qi : quotation.getItems()) {
            if (qi.getBoqItemId() == null) continue;
            BoqItem bi = boqItems.get(qi.getBoqItemId());
            if (bi == null) continue;
            // Always refresh structure from the BOQ — it is the source of truth for floor/room/category,
            // even when the BOQ leaves floor blank and only organises by room.
            copyBoqStructureToQuotationItem(bi, qi);
            changed = true;
        }
        return changed;
    }

    @Transactional
    public Quotation createQuotation(Quotation quotation, User user) {
        if (quotation.getBoq() == null || quotation.getBoq().getId() == null) {
            throw new IllegalArgumentException("A quotation must be generated from a BOQ revision — use 'Generate Quotation' from the BOQ page.");
        }
        resolveRefs(quotation);
        linkCollections(quotation);

        if (quotation.getQuotationNumber() == null) {
            quotation.setQuotationNumber("QT-" + System.currentTimeMillis());
        }

        recalculateTotals(quotation);
        Quotation saved = quotationRepository.save(quotation);
        logActivity(saved, "CREATED", "Quotation created.", user);
        return saved;
    }

    @Transactional
    public Quotation updateQuotation(Long id, Quotation quotationDetails, User user) {
        Quotation quotation = getQuotationById(id);

        // Once a quotation is customer-approved (or converted), only managers/admins may still edit
        // it — a sales user can no longer silently reprice an agreed quotation.
        if (("APPROVED".equals(quotation.getStatus()) || "CONVERTED".equals(quotation.getStatus()))
                && !isManagerOrAdmin(user)) {
            throw new IllegalStateException("This quotation is " + quotation.getStatus()
                    + " and can only be edited by a manager or admin.");
        }

        // customer/lead/siteVisit/measurement/boq are intentionally not updatable — a quotation
        // inherits its full lineage from the BOQ revision it was generated from (see
        // createQuotation's guard); letting an update swap any of them would undermine that
        // invariant. Only pricing, workflow, and commercial-terms fields are editable.
        quotation.setStatus(quotationDetails.getStatus());
        quotation.setPriority(quotationDetails.getPriority());
        quotation.setCurrency(quotationDetails.getCurrency());
        quotation.setQuotationDate(quotationDetails.getQuotationDate());
        quotation.setExpiryDate(quotationDetails.getExpiryDate());
        quotation.setTermsAndConditions(quotationDetails.getTermsAndConditions());

        updateCollections(quotation, quotationDetails);

        recalculateTotals(quotation);
        Quotation saved = quotationRepository.save(quotation);
        logActivity(saved, "UPDATED", "Quotation details updated.", user);
        return saved;
    }

    @Transactional
    public Quotation duplicateQuotation(Long id, User user) {
        Quotation original = getQuotationById(id);
        Quotation copy = new Quotation();
        copy.setQuotationNumber("QT-" + System.currentTimeMillis());
        copy.setCustomer(original.getCustomer());
        copy.setLead(original.getLead());
        copy.setBoq(original.getBoq());
        copy.setMeasurement(original.getMeasurement());
        copy.setQuotationMode(original.getQuotationMode());
        copy.setStatus("DRAFT");
        copy.setCurrency(original.getCurrency());
        copy.setTermsAndConditions(original.getTermsAndConditions());

        copyCollections(original, copy);

        recalculateTotals(copy);
        Quotation saved = quotationRepository.save(copy);
        logActivity(saved, "DUPLICATED", "Created as a duplicate of Quotation #" + original.getQuotationNumber(), user);
        return saved;
    }

    @Transactional
    public Quotation createRevision(Long id, User user) {
        Quotation original = getQuotationById(id);
        Quotation revision = new Quotation();
        revision.setQuotationNumber(original.getQuotationNumber() + "-v" + (original.getRevisionNumber() + 1));
        revision.setCustomer(original.getCustomer());
        revision.setLead(original.getLead());
        revision.setBoq(original.getBoq());
        revision.setMeasurement(original.getMeasurement());
        revision.setQuotationMode(original.getQuotationMode());
        revision.setStatus("DRAFT");
        revision.setCurrency(original.getCurrency());
        revision.setTermsAndConditions(original.getTermsAndConditions());
        revision.setRevisionNumber(original.getRevisionNumber() + 1);
        revision.setParentQuotationId(original.getParentQuotationId() != null ? original.getParentQuotationId() : original.getId());
        revision.setIsLatestVersion(true);

        copyCollections(original, revision);

        recalculateTotals(revision);
        Quotation saved = quotationRepository.save(revision);

        original.setStatus("REVISED");
        original.setIsLatestVersion(false);
        quotationRepository.save(original);

        logActivity(saved, "REVISED", "Created as a new version of Quotation #" + original.getQuotationNumber(), user);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Quotation> getRevisionFamily(Long id) {
        Quotation current = getQuotationById(id);
        Long rootId = current.getParentQuotationId() != null ? current.getParentQuotationId() : current.getId();
        List<Quotation> family = new ArrayList<>();
        family.add(getQuotationById(rootId));
        family.addAll(quotationRepository.findByParentQuotationIdOrderByRevisionNumberDesc(rootId));
        family.sort(Comparator.comparing(Quotation::getRevisionNumber).reversed());
        return family;
    }

    private boolean isManagerOrAdmin(User user) {
        if (user == null || user.getRoles() == null) return false;
        return user.getRoles().stream().map(Role::getName).anyMatch(r ->
                "ROLE_ADMIN".equals(r) || "ROLE_MANAGER".equals(r) || "ROLE_PROJECT_MANAGER".equals(r));
    }

    /**
     * Re-pulls the Floor -> Room -> Category -> Item hierarchy and scope from the linked BOQ while
     * preserving manual pricing. Existing lines are matched by {@code boqItemId}: their structure,
     * ordering, material/labour split, dims and spec are refreshed; their rate/discount/GST/remarks
     * are left untouched. BOQ items not yet on the quotation are appended as new PENDING lines
     * (priced from the BOQ amount). Additive + idempotent — mirrors BoqService.syncFromMeasurement.
     */
    @Transactional
    public Quotation syncFromBoq(Long id, User user) {
        Quotation quotation = getQuotationById(id);
        if (quotation.getBoq() == null || quotation.getBoq().getId() == null) {
            throw new IllegalStateException("This quotation is not linked to a BOQ, so there is nothing to sync.");
        }
        if ("CONVERTED".equals(quotation.getStatus())) {
            throw new IllegalStateException("A converted quotation can no longer be synced from its BOQ.");
        }
        if (("APPROVED".equals(quotation.getStatus())) && !isManagerOrAdmin(user)) {
            throw new IllegalStateException("This quotation is APPROVED and can only be synced by a manager or admin.");
        }

        Boq boq = boqRepository.findById(quotation.getBoq().getId())
                .orElseThrow(() -> new RuntimeException("Linked BOQ not found"));

        Map<Long, QuotationItem> byBoqItemId = new LinkedHashMap<>();
        for (QuotationItem qi : quotation.getItems()) {
            if (qi.getBoqItemId() != null) byBoqItemId.put(qi.getBoqItemId(), qi);
        }

        int refreshed = 0, added = 0;
        for (BoqItem item : boq.getItems()) {
            if (Boolean.FALSE.equals(item.getIsActive())) continue;
            QuotationItem qi = byBoqItemId.get(item.getId());
            if (qi != null) {
                // refresh structure only — leave pricing edits alone
                qi.setItemName(item.getItemName());
                qi.setDescription(item.getDescription());
                qi.setUnit(item.getUnit());
                qi.setQuantity(item.getQuantity() != null ? item.getQuantity() : BigDecimal.ONE);
                copyBoqStructureToQuotationItem(item, qi);
                refreshed++;
            } else {
                QuotationItem ni = new QuotationItem();
                ni.setItemName(item.getItemName());
                ni.setDescription(item.getDescription());
                ni.setUnit(item.getUnit());
                copyBoqStructureToQuotationItem(item, ni);
                ni.setQuantity(item.getQuantity() != null ? item.getQuantity() : BigDecimal.ONE);
                BigDecimal amount = item.getAmount() != null ? item.getAmount() : BigDecimal.ZERO;
                BigDecimal qty = ni.getQuantity().compareTo(BigDecimal.ZERO) != 0 ? ni.getQuantity() : BigDecimal.ONE;
                ni.setRate(amount.divide(qty, 2, RoundingMode.HALF_UP));
                ni.setTotalAmount(amount);
                ni.setCostAmount(amount);
                ni.setBoqItemId(item.getId());
                ni.setStatus("PENDING");
                ni.setQuotation(quotation);
                quotation.getItems().add(ni);
                added++;
            }
        }

        recalculateTotals(quotation);
        Quotation saved = quotationRepository.save(quotation);
        logActivity(saved, "SYNCED_FROM_BOQ",
                "Synced from BOQ — " + refreshed + " item(s) refreshed, " + added + " new item(s) added.", user);
        return saved;
    }

    @Transactional
    public Quotation updateApprovalStatus(Long id, String status, User user) {
        Quotation quotation = getQuotationById(id);
        quotation.setInternalApprovalStatus(status);
        quotation.setApprovedBy(user);
        if ("APPROVED".equals(status)) {
            quotation.setApprovedDate(LocalDateTime.now());
            quotation.setStatus("APPROVED");
        }
        Quotation saved = quotationRepository.save(quotation);
        logActivity(saved, "APPROVAL_STATUS", "Internal approval status changed to " + status, user);
        if ("APPROVED".equals(status)) {
            autoGenerateAdvanceInvoice(saved);
        }
        return saved;
    }

    /** Finance automation: an approved quotation raises a draft advance invoice (idempotent, non-fatal). */
    private void autoGenerateAdvanceInvoice(Quotation quotation) {
        try {
            // REQUIRES_NEW variant — a plain call would join this transaction and, on failure, mark it
            // rollback-only, so approval would still blow up at commit despite this catch.
            financeService.generateFromQuotationIndependently(quotation.getId(), null, true);
        } catch (Exception e) {
            // billing automation must never block quotation approval
            System.out.println("Advance invoice auto-generation skipped for quotation "
                    + quotation.getId() + ": " + e.getMessage());
        }
    }

    // =====================================================================
    // Item-level approval (drives partial execution)
    // =====================================================================

    @Transactional
    public Quotation approveItems(Long id, List<Long> quotationItemIds, User user) {
        Quotation quotation = getQuotationById(id);
        int count = 0;
        for (QuotationItem item : quotation.getItems()) {
            if (!quotationItemIds.contains(item.getId()) || "APPROVED".equals(item.getStatus())) continue;
            item.setStatus("APPROVED");
            count++;
            if (item.getBoqItemId() != null) {
                reserveBoqItemMaterials(item.getBoqItemId());
            }
        }
        rollUpApprovalStatus(quotation, user);
        Quotation saved = quotationRepository.save(quotation);
        logActivity(saved, "ITEMS_APPROVED", count + " item(s) approved by customer", user);
        return saved;
    }

    /**
     * Approving every line is the customer decision — the header status has to follow, otherwise the
     * quotation sits in DRAFT with all items APPROVED and "Create Project" stays disabled with no
     * explanation. Only rolls up once nothing is still PENDING and at least one line was approved.
     */
    private void rollUpApprovalStatus(Quotation quotation, User user) {
        if ("APPROVED".equals(quotation.getStatus()) || "CONVERTED".equals(quotation.getStatus())) {
            return;
        }
        boolean anyPending = quotation.getItems().stream().anyMatch(i -> !"APPROVED".equals(i.getStatus())
                && !"REJECTED".equals(i.getStatus()));
        boolean anyApproved = quotation.getItems().stream().anyMatch(i -> "APPROVED".equals(i.getStatus()));
        if (anyPending || !anyApproved) {
            return;
        }
        quotation.setStatus("APPROVED");
        quotation.setApprovedDate(LocalDateTime.now());
        if (quotation.getApprovedBy() == null) {
            quotation.setApprovedBy(user);
        }
        logActivity(quotation, "APPROVED", "All items decided — quotation marked approved and ready to convert", user);
    }

    @Transactional
    public Quotation rejectItems(Long id, List<Long> quotationItemIds, User user) {
        Quotation quotation = getQuotationById(id);
        int count = 0;
        for (QuotationItem item : quotation.getItems()) {
            if (!quotationItemIds.contains(item.getId())) continue;
            boolean wasApproved = "APPROVED".equals(item.getStatus());
            item.setStatus("REJECTED");
            count++;
            if (item.getBoqItemId() != null) {
                if (wasApproved) releaseBoqItemMaterials(item.getBoqItemId());
                setBoqItemStatus(item.getBoqItemId(), "PENDING");
            }
        }
        rollUpApprovalStatus(quotation, user);
        Quotation saved = quotationRepository.save(quotation);
        logActivity(saved, "ITEMS_REJECTED", count + " item(s) rejected, returned to BOQ as pending", user);
        return saved;
    }

    private void reserveBoqItemMaterials(Long boqItemId) {
        BoqItem boqItem = boqItemRepository.findById(boqItemId).orElse(null);
        if (boqItem == null) return;
        boqItem.setStatus("APPROVED");
        boqItemRepository.save(boqItem);
        for (BoqItemMaterial m : boqItem.getMaterials()) {
            if (m.getProduct() != null && m.getFinalQuantity() != null) {
                inventoryService.reserveStock(m.getProduct().getId(), m.getFinalQuantity().setScale(0, RoundingMode.CEILING).intValue(),
                        "QUOTATION", boqItem.getBoq().getId());
            }
        }
    }

    private void releaseBoqItemMaterials(Long boqItemId) {
        BoqItem boqItem = boqItemRepository.findById(boqItemId).orElse(null);
        if (boqItem == null) return;
        for (BoqItemMaterial m : boqItem.getMaterials()) {
            if (m.getProduct() != null && m.getFinalQuantity() != null) {
                inventoryService.releaseReservation(m.getProduct().getId(), m.getFinalQuantity().setScale(0, RoundingMode.CEILING).intValue(),
                        "QUOTATION", boqItem.getBoq().getId());
            }
        }
    }

    private void setBoqItemStatus(Long boqItemId, String status) {
        boqItemRepository.findById(boqItemId).ifPresent(boqItem -> {
            boqItem.setStatus(status);
            boqItemRepository.save(boqItem);
        });
    }

    @Transactional
    public void reserveInventory(Long id) {
        Quotation quotation = getQuotationById(id);
        for (QuotationItem item : quotation.getItems()) {
            if ("APPROVED".equals(item.getStatus()) && item.getBoqItemId() != null) {
                reserveBoqItemMaterials(item.getBoqItemId());
            }
        }
    }

    @Transactional
    public void releaseInventory(Long id) {
        Quotation quotation = getQuotationById(id);
        for (QuotationItem item : quotation.getItems()) {
            if ("APPROVED".equals(item.getStatus()) && item.getBoqItemId() != null) {
                releaseBoqItemMaterials(item.getBoqItemId());
            }
        }
    }

    // =====================================================================
    // Conversion to project(s)
    // =====================================================================

    @Transactional
    public List<Project> convertToProject(Long id, String splitBy, User user) {
        Quotation quotation = getQuotationById(id);

        if (!"APPROVED".equals(quotation.getStatus())) {
            throw new IllegalStateException("Only a customer-approved quotation can be converted to a project. Current status: "
                    + quotation.getStatus());
        }

        List<QuotationItem> approvedItems = quotation.getItems().stream()
                .filter(i -> "APPROVED".equals(i.getStatus()))
                .toList();
        // Header-level approval ("Mark Approved" or customer signature) flips the quotation to APPROVED
        // without touching individual line statuses. In that case treat every non-rejected line as
        // approved — otherwise conversion throws even though the whole quotation was approved. Mark them
        // APPROVED so downstream reservation/consumption and the persisted state stay consistent.
        if (approvedItems.isEmpty()) {
            approvedItems = quotation.getItems().stream()
                    .filter(i -> !"REJECTED".equals(i.getStatus()))
                    .toList();
            approvedItems.forEach(i -> i.setStatus("APPROVED"));
        }
        if (approvedItems.isEmpty()) {
            throw new IllegalStateException("No approved items to convert. Approve at least one line item first.");
        }

        ensureCustomerForConversion(quotation, user);

        List<Project> projects = new ArrayList<>();
        boolean splitting = "FLOOR".equals(splitBy);
        if (splitting) {
            Map<String, List<QuotationItem>> byFloor = new LinkedHashMap<>();
            for (QuotationItem item : approvedItems) {
                String floor = "Unassigned";
                if (item.getBoqItemId() != null) {
                    BoqItem boqItem = boqItemRepository.findById(item.getBoqItemId()).orElse(null);
                    if (boqItem != null && boqItem.getFloorName() != null) floor = boqItem.getFloorName();
                }
                byFloor.computeIfAbsent(floor, k -> new ArrayList<>()).add(item);
            }
            for (Map.Entry<String, List<QuotationItem>> entry : byFloor.entrySet()) {
                projects.add(buildProject(quotation, entry.getValue(), entry.getKey(), user, false));
            }
        } else {
            projects.add(buildProject(quotation, approvedItems, null, user, true));
        }

        quotation.setProject(projects.get(0));
        quotation.setStatus("CONVERTED");
        quotationRepository.save(quotation);

        syncLeadWithConvertedProject(quotation, projects.get(0), user);

        // Chain the workflow engine: complete the lead workflow, start each project's PROJECT
        // workflow, and generate execution tasks from the approved BOQ (single-project only).
        boolean single = projects.size() == 1;
        for (Project p : projects) {
            workflowTriggerService.onProjectCreated(p, single);
        }

        logActivity(quotation, "CONVERTED", "Converted to " + projects.size() + " project(s): " +
                projects.stream().map(Project::getProjectCode).reduce((a, b) -> a + ", " + b).orElse(""), user);
        return projects;
    }

    /**
     * A lead converted via the old "create project immediately" flow (or any other path) may
     * already have an empty stub Project with no BOQ/quotation attached yet. Reusing it instead of
     * inserting a second row is what prevents a lead ending up with two disconnected Project rows.
     * Only attempted for a non-split conversion, since a floor-split intentionally produces
     * multiple projects from one quotation and a single stub can't stand in for all of them.
     */
    private Project findReusableStubProject(Quotation quotation, boolean allowReuse) {
        if (!allowReuse || quotation.getLead() == null || quotation.getLead().getId() == null) return null;
        List<Project> candidates = projectRepository.findByLeadIdOrderByIdDesc(quotation.getLead().getId()).stream()
                .filter(p -> p.getBoq() == null && p.getQuotation() == null)
                .toList();
        return candidates.size() == 1 ? candidates.get(0) : null;
    }

    /**
     * A quotation raised from a lead carries lead_id but no customer — leads only become customers on
     * conversion. Approving that quotation and starting work *is* the moment they become a customer,
     * so convert here rather than leaving a project (and every document above it) ownerless.
     * LeadService.convertLead also re-links the lead's site visits, measurements and quotations.
     */
    private void ensureCustomerForConversion(Quotation quotation, User user) {
        if (quotation.getCustomer() != null) {
            return;
        }
        Lead lead = quotation.getLead();
        if (lead == null || lead.getId() == null) {
            throw new IllegalStateException("This quotation has no customer and no lead, so the project would have no owner. "
                    + "Link a customer to the quotation before converting.");
        }
        Customer customer = Boolean.TRUE.equals(lead.getIsConverted()) && lead.getConvertedToCustomer() != null
                ? lead.getConvertedToCustomer()
                : leadService.convertLeadToCustomer(lead.getId(), user);
        quotation.setCustomer(customer);
        quotationRepository.save(quotation);
    }

    private Project buildProject(Quotation quotation, List<QuotationItem> items, String floorLabel, User user, boolean allowReuse) {
        Project project = findReusableStubProject(quotation, allowReuse);
        boolean reused = project != null;
        if (project == null) {
            project = new Project();
            String owner = quotation.getCustomer() != null ? quotation.getCustomer().getName()
                    : quotation.getLead() != null ? quotation.getLead().getName()
                    : "Customer";
            project.setProjectName((floorLabel != null ? floorLabel + " - " : "") + "Project for " + owner);
            project.setStatus("PLANNING");
            project.setProgress(0);
        }
        // A reused stub project (from the old direct-conversion path) may predate projectCode being set.
        if (project.getProjectCode() == null) {
            project.setProjectCode("PRJ-" + System.currentTimeMillis() + (floorLabel != null ? "-" + floorLabel.replaceAll("\\s+", "") : ""));
        }
        project.setCustomer(quotation.getCustomer());
        project.setLead(quotation.getLead());
        project.setSiteVisit(quotation.getSiteVisit());
        project.setMeasurement(quotation.getMeasurement());
        project.setBoq(quotation.getBoq());
        project.setQuotation(quotation);
        project.setPriority(quotation.getPriority() != null ? quotation.getPriority() : "MEDIUM");

        // Carry the lead's property / requirement / scheduling attributes and team assignments onto the
        // project so it is self-sufficient after conversion. Contact + address land on the linked Customer.
        applyLeadAttributesToProject(project, quotation.getLead());
        if (project.getStartDate() == null) project.setStartDate(java.time.LocalDate.now());

        BigDecimal budget = items.stream()
                .map(i -> i.getTotalAmount() != null ? i.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        project.setBudget(budget);

        Project savedProject = projectRepository.save(project);

        List<BoqPhase> phases = quotation.getBoq() != null
                ? boqPhaseRepository.findByBoqIdOrderBySequenceAsc(quotation.getBoq().getId())
                : List.of();
        if (!phases.isEmpty()) {
            for (BoqPhase phase : phases) {
                ProjectStage stage = new ProjectStage();
                stage.setProject(savedProject);
                stage.setName(phase.getPhaseName());
                stage.setStatus("PENDING");
                projectStageRepository.save(stage);
            }
        } else {
            String[] defaultStages = {"Planning & Procurement", "Execution & Installation", "Quality Check & Handover"};
            for (String stageName : defaultStages) {
                ProjectStage stage = new ProjectStage();
                stage.setProject(savedProject);
                stage.setName(stageName);
                stage.setStatus("PENDING");
                projectStageRepository.save(stage);
            }
        }

        ProjectActivityLog activityLog = new ProjectActivityLog();
        activityLog.setProject(savedProject);
        activityLog.setUser(user);
        activityLog.setRole("System");
        activityLog.setDescription((reused
                ? "Existing project relinked to Quotation #"
                : "Project converted from Quotation #") + quotation.getQuotationNumber());
        projectActivityLogRepository.save(activityLog);

        // Reservation -> consumption: deduct stock for each approved item's materials, mark BOQ items executed.
        // Along the way, aggregate the BOQ's material lines into the project's inherited material list.
        Map<Long, BigDecimal> requiredByProduct = new LinkedHashMap<>();
        Map<Long, Product> productById = new LinkedHashMap<>();
        Map<Long, String> unitByProduct = new LinkedHashMap<>();
        for (QuotationItem qItem : items) {
            if (qItem.getBoqItemId() == null) continue;
            BoqItem boqItem = boqItemRepository.findById(qItem.getBoqItemId()).orElse(null);
            if (boqItem == null) continue;
            for (BoqItemMaterial m : boqItem.getMaterials()) {
                if (m.getProduct() != null && m.getFinalQuantity() != null) {
                    inventoryService.deductReservedStock(m.getProduct().getId(),
                            m.getFinalQuantity().setScale(0, RoundingMode.CEILING).intValue(),
                            "PROJECT", savedProject.getId());
                    requiredByProduct.merge(m.getProduct().getId(), m.getFinalQuantity(), BigDecimal::add);
                    productById.putIfAbsent(m.getProduct().getId(), m.getProduct());
                    unitByProduct.putIfAbsent(m.getProduct().getId(), m.getUnit());
                }
            }
            boqItem.setStatus("EXECUTED");
            boqItemRepository.save(boqItem);
        }
        for (Map.Entry<Long, BigDecimal> entry : requiredByProduct.entrySet()) {
            ProjectMaterialRequirement requirement = new ProjectMaterialRequirement();
            requirement.setProject(savedProject);
            requirement.setProduct(productById.get(entry.getKey()));
            requirement.setRequiredQty(entry.getValue());
            requirement.setUnit(unitByProduct.get(entry.getKey()));
            requirement.setRemarks("Inherited from BOQ via approved quotation " + quotation.getQuotationNumber()
                    + "; reserved stock was consumed at conversion.");
            projectMaterialRequirementRepository.save(requirement);
        }

        return savedProject;
    }

    /**
     * A Project created from an approved Quotation is the real, BOQ-backed outcome of a lead's
     * pipeline — but until now nothing told the Lead about it, so LeadProfile's "View Project"
     * button and stage tracker stayed blank even after a project existed. Backfills the same fields
     * the "Convert Lead" flow sets, without overwriting who/when the lead was first converted.
     */
    private void syncLeadWithConvertedProject(Quotation quotation, Project primaryProject, User user) {
        Lead lead = quotation.getLead();
        if (lead == null) return;
        boolean alreadyConverted = Boolean.TRUE.equals(lead.getIsConverted());
        lead.setIsConverted(true);
        if (lead.getConvertedToCustomer() == null) lead.setConvertedToCustomer(quotation.getCustomer());
        lead.setConvertedToProject(primaryProject);
        if (!alreadyConverted) {
            lead.setConvertedBy(user);
            lead.setConvertedDate(LocalDateTime.now());
        }
        leadRepository.save(lead);
        copyPreSalesAssetsToProject(lead, quotation.getMeasurement(), primaryProject, user);
    }

    /**
     * Copies the lead's descriptive attributes and team assignments onto the project at conversion so
     * the project screen carries everything captured during pre-sales without re-keying. Each field is
     * only filled when the project doesn't already have a value — so a reused stub project (or manual
     * edits made before conversion) and quotation-derived figures like budget are never clobbered.
     * Contact identity (name/phone/email/GST) intentionally lives on the linked Customer, not here.
     */
    private void applyLeadAttributesToProject(Project project, Lead lead) {
        if (lead == null || project == null) return;

        // Property / site
        if (isBlank(project.getPropertyAddress()))
            project.setPropertyAddress(firstNonBlank(lead.getSiteAddress(), lead.getAddress()));
        if (isBlank(project.getProjectType()))
            project.setProjectType(lead.getPropertyType());
        if (isBlank(project.getProjectCategory()))
            project.setProjectCategory(lead.getRequirementCategory());

        // Requirement / description
        if (isBlank(project.getProjectDescription()))
            project.setProjectDescription(firstNonBlank(lead.getProjectDescription(), lead.getCustomerRequirements()));
        if (isBlank(project.getCustomerNotes()))
            project.setCustomerNotes(firstNonBlank(lead.getCustomerRequirements(), lead.getSpecialRequests()));
        if (isBlank(project.getInternalNotes()))
            project.setInternalNotes(firstNonBlank(lead.getRemarks(), lead.getConversionNotes(), lead.getSiteNotes()));

        // Scheduling
        if (project.getStartDate() == null && lead.getExpectedStartDate() != null)
            project.setStartDate(lead.getExpectedStartDate());
        if (project.getEndDate() == null)
            project.setEndDate(lead.getPreferredCompletionDate() != null
                    ? lead.getPreferredCompletionDate() : lead.getExpectedEndDate());

        // Financials (project.budget is derived from approved items separately — don't touch it)
        if (project.getEstimatedCost() == null)
            project.setEstimatedCost(lead.getExpectedProjectValue() != null
                    ? lead.getExpectedProjectValue() : lead.getEstimatedBudget());

        // Team (defaults from the lead; project owners can reassign later)
        if (project.getProjectManager() == null) project.setProjectManager(lead.getProjectManager());
        if (project.getSalesExecutive() == null) project.setSalesExecutive(lead.getAssignedSalesExecutive());
        if (project.getDesigner() == null) project.setDesigner(lead.getAssignedDesigner());
        if (project.getSiteEngineer() == null) project.setSiteEngineer(lead.getAssignedEngineer());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    /**
     * Consolidates every visual/document asset captured during the pre-sales pipeline onto the newly
     * created project, so the project's Documents tab is a complete, self-contained record after
     * conversion. Three sources are pulled in, all as one-time snapshots at conversion:
     *   1. Lead documents  — property images, floor plans, agreements, site photos.
     *   2. Measurement drawings — floor plans, CAD, sketches, blueprints, layouts.
     *   3. Measurement media   — before/room/measurement photos, videos, voice notes.
     * Deduplicated by fileUrl (across all three sources and against what the project already has), so
     * re-converting or relinking a reused stub project never inserts the same file twice.
     */
    private void copyPreSalesAssetsToProject(Lead lead, Measurement measurement, Project project, User user) {
        if (project == null) return;

        Set<String> existingUrls = projectDocumentRepository.findByProjectId(project.getId()).stream()
                .map(ProjectDocument::getFileUrl)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        // 1) Lead documents — tagged by category (Property Images, Agreements, …); fall back to documentType.
        if (lead != null && lead.getId() != null) {
            String origin = "Imported from lead " + (lead.getLeadNumber() != null ? lead.getLeadNumber() : "#" + lead.getId());
            for (LeadDocument src : leadDocumentRepository.findByLeadId(lead.getId())) {
                copyPreSalesDoc(project, existingUrls, src.getFileName(), src.getFileUrl(),
                        src.getCategory() != null ? src.getCategory() : src.getDocumentType(),
                        src.getUploadedBy() != null ? src.getUploadedBy() : user, src.getDescription(), origin);
            }
        }

        // 2 & 3) The measurement is shared by reference with the project; snapshot its drawings + media
        // into the Documents tab too, so they no longer live only behind the linked measurement.
        if (measurement != null && measurement.getId() != null) {
            String origin = "Imported from measurement #" + measurement.getId();
            for (MeasurementDrawing d : measurementDrawingRepository.findByMeasurementId(measurement.getId())) {
                copyPreSalesDoc(project, existingUrls, d.getFileName(), d.getFilePath(),
                        d.getDrawingType() != null ? d.getDrawingType() : "Drawing",
                        d.getUploadedBy() != null ? d.getUploadedBy() : user, d.getDescription(), origin);
            }
            for (MeasurementMedia m : measurementMediaRepository.findByMeasurementId(measurement.getId())) {
                copyPreSalesDoc(project, existingUrls, m.getFileName(), m.getFilePath(),
                        m.getCategory() != null ? m.getCategory() : (m.getMediaType() != null ? m.getMediaType() : "Photos"),
                        m.getUploadedBy() != null ? m.getUploadedBy() : user, m.getDescription(), origin);
            }
        }
    }

    /**
     * Inserts one ProjectDocument from a pre-sales source, guarding the project_documents column limits
     * (file_name NOT NULL / 200 chars, file_url 500) so a stray long value can never abort the whole
     * conversion transaction. Updates {@code existingUrls} in place so duplicates within this run —
     * across lead/drawing/media sources — are also skipped.
     */
    /**
     * On-demand counterpart to the automatic copy at conversion: backfills an EXISTING project's
     * Documents tab from its lead's documents and its linked measurement's drawings + media. Needed
     * for projects created before that copy existed, or to re-pull assets a user added to the lead /
     * measurement after conversion. Idempotent — deduped by fileUrl, so re-running only adds what's
     * new. Returns how many documents were actually imported.
     */
    @Transactional
    public int importPreSalesAssets(Long projectId, User user) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        int before = projectDocumentRepository.findByProjectId(projectId).size();
        copyPreSalesAssetsToProject(project.getLead(), project.getMeasurement(), project, user);
        return projectDocumentRepository.findByProjectId(projectId).size() - before;
    }

    private void copyPreSalesDoc(Project project, Set<String> existingUrls, String fileName, String fileUrl,
                                 String documentType, User uploadedBy, String description, String origin) {
        if (fileUrl == null || fileUrl.isBlank()) return;        // nothing to link to
        if (fileUrl.length() > 500) return;                      // exceeds column cap; skip rather than fail conversion
        if (!existingUrls.add(fileUrl)) return;                  // already present (project or earlier in this run)

        ProjectDocument doc = new ProjectDocument();
        doc.setProject(project);
        doc.setFileName(fileName == null || fileName.isBlank() ? "Untitled"
                : fileName.length() > 200 ? fileName.substring(0, 200) : fileName);
        doc.setFileUrl(fileUrl);
        doc.setDocumentType(documentType);
        doc.setUploadedBy(uploadedBy);
        doc.setUploadDate(LocalDateTime.now());
        doc.setRemarks(description != null && !description.isBlank() ? description + " — " + origin : origin);
        projectDocumentRepository.save(doc);
    }

    @Transactional
    public Quotation saveSignature(Long id, String signature, User user) {
        Quotation quotation = getQuotationById(id);
        quotation.setCustomerSignatureBase64(signature);
        quotation.setStatus("APPROVED");
        Quotation saved = quotationRepository.save(quotation);
        logActivity(saved, "SIGNED", "Customer signed the quotation.", user);
        autoGenerateAdvanceInvoice(saved);
        return saved;
    }

    public void deleteQuotation(Long id) {
        Quotation quotation = getQuotationById(id);
        quotationRepository.delete(quotation);
    }

    private void linkCollections(Quotation quotation) {
        if (quotation.getItems() != null) quotation.getItems().forEach(i -> i.setQuotation(quotation));
        if (quotation.getDiscounts() != null) quotation.getDiscounts().forEach(i -> i.setQuotation(quotation));
        if (quotation.getTaxes() != null) quotation.getTaxes().forEach(i -> i.setQuotation(quotation));
        if (quotation.getLabours() != null) quotation.getLabours().forEach(i -> i.setQuotation(quotation));
        if (quotation.getAdditionalCharges() != null) quotation.getAdditionalCharges().forEach(i -> i.setQuotation(quotation));
        if (quotation.getTerms() != null) quotation.getTerms().forEach(i -> i.setQuotation(quotation));
        if (quotation.getAttachments() != null) quotation.getAttachments().forEach(i -> i.setQuotation(quotation));
    }

    private void updateCollections(Quotation quotation, Quotation quotationDetails) {
        mergeItemPricing(quotation, quotationDetails);

        quotation.getDiscounts().clear();
        if (quotationDetails.getDiscounts() != null) {
            quotationDetails.getDiscounts().forEach(i -> { i.setQuotation(quotation); quotation.getDiscounts().add(i); });
        }

        quotation.getTaxes().clear();
        if (quotationDetails.getTaxes() != null) {
            quotationDetails.getTaxes().forEach(i -> { i.setQuotation(quotation); quotation.getTaxes().add(i); });
        }

        quotation.getLabours().clear();
        if (quotationDetails.getLabours() != null) {
            quotationDetails.getLabours().forEach(i -> { i.setQuotation(quotation); quotation.getLabours().add(i); });
        }

        quotation.getAdditionalCharges().clear();
        if (quotationDetails.getAdditionalCharges() != null) {
            quotationDetails.getAdditionalCharges().forEach(i -> { i.setQuotation(quotation); quotation.getAdditionalCharges().add(i); });
        }

        quotation.getTerms().clear();
        if (quotationDetails.getTerms() != null) {
            quotationDetails.getTerms().forEach(i -> { i.setQuotation(quotation); quotation.getTerms().add(i); });
        }
    }

    /**
     * Quotation line items are generated from BOQ items and stay locked to that lineage: an update
     * may reprice existing lines (rate, discount %, GST %, remarks) but can never add lines, remove
     * lines, or change what/how much is being quoted — quantities and scope only change by revising
     * the BOQ and regenerating. This is what makes the Measurement → BOQ → Quotation chain the
     * single source of truth.
     */
    private void mergeItemPricing(Quotation quotation, Quotation quotationDetails) {
        if (quotationDetails.getItems() == null) return;
        Map<Long, QuotationItem> existingById = new LinkedHashMap<>();
        for (QuotationItem item : quotation.getItems()) {
            existingById.put(item.getId(), item);
        }
        for (QuotationItem incoming : quotationDetails.getItems()) {
            if (incoming.getId() == null || !existingById.containsKey(incoming.getId())) {
                throw new IllegalArgumentException(
                        "Quotation items are generated from the BOQ and cannot be added manually — revise the BOQ and regenerate the quotation to change its scope.");
            }
            QuotationItem existing = existingById.get(incoming.getId());
            existing.setRate(incoming.getRate());
            existing.setDiscountPercentage(incoming.getDiscountPercentage());
            existing.setGstPercentage(incoming.getGstPercentage());
            existing.setRemarks(incoming.getRemarks());
            // Annotation fields are safe to edit under the scope-lock — they don't change what/how
            // much is being quoted, only how the line is described/priced-out.
            existing.setAdditionalCharges(incoming.getAdditionalCharges() != null
                    ? incoming.getAdditionalCharges() : BigDecimal.ZERO);
            existing.setBrand(incoming.getBrand());
            existing.setSpecification(incoming.getSpecification());
            existing.setColor(incoming.getColor());
            existing.setThickness(incoming.getThickness());
            existing.setGrade(incoming.getGrade());
            existing.setEstimatedDays(incoming.getEstimatedDays());
            existing.setAssignedContractor(incoming.getAssignedContractor());
        }
    }

    private void copyCollections(Quotation original, Quotation copy) {
        if (original.getItems() != null) {
            for (QuotationItem item : original.getItems()) {
                QuotationItem copyItem = new QuotationItem();
                copyItem.setCategory(item.getCategory());
                copyItem.setItemCode(item.getItemCode());
                copyItem.setItemName(item.getItemName());
                copyItem.setDescription(item.getDescription());
                copyItem.setUnit(item.getUnit());
                copyItem.setQuantity(item.getQuantity());
                copyItem.setRate(item.getRate());
                copyItem.setDiscountPercentage(item.getDiscountPercentage());
                copyItem.setGstPercentage(item.getGstPercentage());
                copyItem.setTaxAmount(item.getTaxAmount());
                copyItem.setTotalAmount(item.getTotalAmount());
                copyItem.setCostAmount(item.getCostAmount());
                copyItem.setBoqItemId(item.getBoqItemId());
                copyItem.setStatus("PENDING");
                copyItem.setRemarks(item.getRemarks());
                // Floor -> Room -> Category hierarchy + ordering, material/labour split, dims, annotations
                copyItem.setFloorName(item.getFloorName());
                copyItem.setRoomName(item.getRoomName());
                copyItem.setFloorOrder(item.getFloorOrder());
                copyItem.setRoomOrder(item.getRoomOrder());
                copyItem.setItemOrder(item.getItemOrder());
                copyItem.setMaterialCost(item.getMaterialCost());
                copyItem.setLabourCost(item.getLabourCost());
                copyItem.setLength(item.getLength());
                copyItem.setWidth(item.getWidth());
                copyItem.setHeight(item.getHeight());
                copyItem.setArea(item.getArea());
                copyItem.setBrand(item.getBrand());
                copyItem.setSpecification(item.getSpecification());
                copyItem.setColor(item.getColor());
                copyItem.setThickness(item.getThickness());
                copyItem.setGrade(item.getGrade());
                copyItem.setEstimatedDays(item.getEstimatedDays());
                copyItem.setAssignedContractor(item.getAssignedContractor());
                copyItem.setAdditionalCharges(item.getAdditionalCharges() != null ? item.getAdditionalCharges() : BigDecimal.ZERO);
                copyItem.setQuotation(copy);
                copy.getItems().add(copyItem);
            }
        }

        if (original.getDiscounts() != null) {
            for (QuotationDiscount d : original.getDiscounts()) {
                QuotationDiscount dc = new QuotationDiscount();
                dc.setDiscountType(d.getDiscountType());
                dc.setDescription(d.getDescription());
                dc.setPercentage(d.getPercentage());
                dc.setAmount(d.getAmount());
                dc.setCouponCode(d.getCouponCode());
                dc.setApprovedBy(d.getApprovedBy());
                dc.setQuotation(copy);
                copy.getDiscounts().add(dc);
            }
        }

        if (original.getTaxes() != null) {
            for (QuotationTax t : original.getTaxes()) {
                QuotationTax tc = new QuotationTax();
                tc.setTaxType(t.getTaxType());
                tc.setPercentage(t.getPercentage());
                tc.setAmount(t.getAmount());
                tc.setIsInclusive(t.getIsInclusive());
                tc.setQuotation(copy);
                copy.getTaxes().add(tc);
            }
        }

        if (original.getLabours() != null) {
            for (QuotationLabour l : original.getLabours()) {
                QuotationLabour lc = new QuotationLabour();
                lc.setWorkType(l.getWorkType());
                lc.setLabourCategory(l.getLabourCategory());
                lc.setHours(l.getHours());
                lc.setRate(l.getRate());
                lc.setAmount(l.getAmount());
                lc.setAssignedContractor(l.getAssignedContractor());
                lc.setRemarks(l.getRemarks());
                lc.setQuotation(copy);
                copy.getLabours().add(lc);
            }
        }

        if (original.getAdditionalCharges() != null) {
            for (QuotationAdditionalCharge c : original.getAdditionalCharges()) {
                QuotationAdditionalCharge cc = new QuotationAdditionalCharge();
                cc.setChargeType(c.getChargeType());
                cc.setAmount(c.getAmount());
                cc.setDescription(c.getDescription());
                cc.setQuotation(copy);
                copy.getAdditionalCharges().add(cc);
            }
        }

        if (original.getTerms() != null) {
            for (QuotationTerm t : original.getTerms()) {
                QuotationTerm tc = new QuotationTerm();
                tc.setTermCategory(t.getTermCategory());
                tc.setContent(t.getContent());
                tc.setIsStandard(t.getIsStandard());
                tc.setQuotation(copy);
                copy.getTerms().add(tc);
            }
        }
    }

    private void recalculateTotals(Quotation quotation) {
        BigDecimal totalItems = BigDecimal.ZERO;
        BigDecimal materialTotal = BigDecimal.ZERO;
        BigDecimal labourTotal = BigDecimal.ZERO;
        BigDecimal itemAdditionalCharges = BigDecimal.ZERO;
        if (quotation.getItems() != null) {
            for (QuotationItem item : quotation.getItems()) {
                // Material / labour split is informational (carried from the BOQ) — accumulate it for
                // the Grand Summary regardless of whether the line has a priced rate yet.
                if (item.getMaterialCost() != null) materialTotal = materialTotal.add(item.getMaterialCost());
                if (item.getLabourCost() != null) labourTotal = labourTotal.add(item.getLabourCost());
                if (item.getRate() != null && item.getQuantity() != null) {
                    BigDecimal itemTotal = item.getRate().multiply(item.getQuantity());
                    // discount on item
                    if (item.getDiscountPercentage() != null && item.getDiscountPercentage().compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal disc = itemTotal.multiply(item.getDiscountPercentage().divide(new BigDecimal(100)));
                        itemTotal = itemTotal.subtract(disc);
                    }
                    // per-item additional charges (added to the taxable base for this line)
                    if (item.getAdditionalCharges() != null && item.getAdditionalCharges().compareTo(BigDecimal.ZERO) > 0) {
                        itemTotal = itemTotal.add(item.getAdditionalCharges());
                        itemAdditionalCharges = itemAdditionalCharges.add(item.getAdditionalCharges());
                    }
                    // tax on item
                    if (item.getGstPercentage() != null && item.getGstPercentage().compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal tax = itemTotal.multiply(item.getGstPercentage().divide(new BigDecimal(100)));
                        item.setTaxAmount(tax);
                        itemTotal = itemTotal.add(tax);
                    }
                    item.setTotalAmount(itemTotal);
                    totalItems = totalItems.add(itemTotal);
                }
            }
        }
        quotation.setMaterialTotal(materialTotal);
        quotation.setLabourTotal(labourTotal);

        BigDecimal totalLabour = BigDecimal.ZERO;
        if (quotation.getLabours() != null) {
            for (QuotationLabour lab : quotation.getLabours()) {
                if (lab.getRate() != null && lab.getHours() != null) {
                    lab.setAmount(lab.getRate().multiply(lab.getHours()));
                    totalLabour = totalLabour.add(lab.getAmount());
                }
            }
        }

        BigDecimal totalCharges = BigDecimal.ZERO;
        if (quotation.getAdditionalCharges() != null) {
            for (QuotationAdditionalCharge c : quotation.getAdditionalCharges()) {
                if (c.getAmount() != null) totalCharges = totalCharges.add(c.getAmount());
            }
        }
        // Grand Summary "Additional Charges" = header-level charges + per-item charges (the latter
        // are already inside each item's total, so only header charges join the subtotal here).
        quotation.setAdditionalChargesTotal(totalCharges.add(itemAdditionalCharges));

        BigDecimal subTotal = totalItems.add(totalLabour).add(totalCharges);

        BigDecimal totalDiscount = BigDecimal.ZERO;
        if (quotation.getDiscounts() != null) {
            for (QuotationDiscount d : quotation.getDiscounts()) {
                if (d.getPercentage() != null && d.getPercentage().compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal disc = subTotal.multiply(d.getPercentage().divide(new BigDecimal(100)));
                    d.setAmount(disc);
                    totalDiscount = totalDiscount.add(disc);
                } else if (d.getAmount() != null) {
                    totalDiscount = totalDiscount.add(d.getAmount());
                }
            }
        }
        quotation.setDiscount(totalDiscount);

        BigDecimal afterDiscount = subTotal.subtract(totalDiscount);

        BigDecimal totalTax = BigDecimal.ZERO;
        if (quotation.getTaxes() != null) {
            for (QuotationTax t : quotation.getTaxes()) {
                if (t.getPercentage() != null && t.getPercentage().compareTo(BigDecimal.ZERO) > 0 && !t.getIsInclusive()) {
                    BigDecimal tax = afterDiscount.multiply(t.getPercentage().divide(new BigDecimal(100)));
                    t.setAmount(tax);
                    totalTax = totalTax.add(tax);
                }
            }
        }
        quotation.setGst(totalTax);

        quotation.setGrandTotal(afterDiscount.add(totalTax));
    }

    /**
     * Copies the Floor -> Room -> Category structure, ordering, material/labour split, measurement
     * dims and a material-spec summary from a {@link BoqItem} onto a {@link QuotationItem}. Shared by
     * quotation generation (BoqService) and {@link #syncFromBoq}. Pricing fields (rate/discount/gst)
     * are intentionally NOT touched here so a sync preserves manual pricing.
     */
    public static void copyBoqStructureToQuotationItem(BoqItem item, QuotationItem qi) {
        qi.setCategory(item.getCategory());
        qi.setFloorName(item.getFloorName());
        qi.setRoomName(item.getRoomName());
        qi.setFloorOrder(item.getFloorOrder() != null ? item.getFloorOrder() : 0);
        qi.setRoomOrder(item.getRoomOrder() != null ? item.getRoomOrder() : 0);
        qi.setItemOrder(item.getItemOrder() != null ? item.getItemOrder() : 0);
        qi.setLength(item.getLength());
        qi.setWidth(item.getWidth());
        qi.setHeight(item.getHeight());
        qi.setArea(item.getArea());
        qi.setMaterialCost(item.getMaterialTotal());
        qi.setLabourCost(item.getLabourTotal());
        String spec = buildSpecSummary(item);
        if (spec != null && !spec.isBlank()) {
            qi.setSpecification(spec);
        }
    }

    /** A short, human-readable spec line from the BOQ item's material names (fallback: labour work types). */
    private static String buildSpecSummary(BoqItem item) {
        java.util.LinkedHashSet<String> parts = new java.util.LinkedHashSet<>();
        if (item.getMaterials() != null) {
            for (BoqItemMaterial m : item.getMaterials()) {
                if (m.getMaterialName() != null && !m.getMaterialName().isBlank()) parts.add(m.getMaterialName().trim());
            }
        }
        if (parts.isEmpty() && item.getLabours() != null) {
            for (BoqItemLabour l : item.getLabours()) {
                if (l.getWorkType() != null && !l.getWorkType().isBlank()) parts.add(l.getWorkType().trim());
            }
        }
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    public void logActivity(Quotation quotation, String action, String description, User performedBy) {
        QuotationActivity activity = new QuotationActivity();
        activity.setQuotation(quotation);
        activity.setAction(action);
        activity.setDescription(description);
        activity.setPerformedBy(performedBy);
        quotationActivityRepository.save(activity);
    }
}

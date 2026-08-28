package com.arudra.crm.service;

import com.arudra.crm.dto.boq.BoqDashboardDTO;
import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.*;
import com.arudra.crm.util.MeasurementWorkflow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BoqService {

    public static final List<String> CATEGORIES = List.of(
            "Civil", "Carpentry", "Modular Kitchen", "Wardrobe", "False Ceiling", "Painting",
            "Electrical", "Plumbing", "Flooring", "Glass", "Hardware", "Furniture", "Others");

    public static final List<String> UNITS = List.of(
            "Sqft", "Sqm", "Rft", "Cum", "Nos", "Kg", "Ltr", "Set", "Lump Sum");

    public static final List<String> STATUSES = List.of("DRAFT", "REVIEW", "APPROVED", "REJECTED");

    public static final List<String> ITEM_STATUSES = List.of("PENDING", "SELECTED", "APPROVED", "EXECUTED", "REJECTED");

    public static final List<String> QUOTATION_MODES = List.of("FULL_HOUSE", "PARTIAL", "BUDGET");

    private static final BigDecimal HUNDRED = new BigDecimal(100);

    @Autowired private BoqRepository boqRepository;
    @Autowired private WorkflowTriggerService workflowTriggerService;
    @Autowired private BoqItemRepository boqItemRepository;
    @Autowired private BoqItemMaterialRepository boqItemMaterialRepository;
    @Autowired private BoqItemLabourRepository boqItemLabourRepository;
    @Autowired private BoqPhaseRepository boqPhaseRepository;
    @Autowired private BoqActivityLogRepository activityLogRepository;
    @Autowired private BoqChangeLogRepository changeLogRepository;
    @Autowired private MeasurementRepository measurementRepository;
    @Autowired private MeasurementRoomRepository measurementRoomRepository;
    @Autowired private MeasurementItemRepository measurementItemRepository;
    @Autowired private InventoryItemRepository inventoryItemRepository;
    @Autowired private QuotationRepository quotationRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private QuotationService quotationService;
    @Autowired private InventoryService inventoryService;

    /**
     * Re-resolves {id}-only JSON refs (Customer/Project/Measurement) to managed proxies before save.
     * Without this, Hibernate treats a detached entity whose @Version field is null (as JSON binding
     * produces) as transient and throws PropertyValueException on flush, even for non-cascaded refs.
     */
    private void resolveRefs(Boq boq) {
        if (boq.getCustomer() != null && boq.getCustomer().getId() != null) {
            boq.setCustomer(customerRepository.getReferenceById(boq.getCustomer().getId()));
        }
        if (boq.getProject() != null && boq.getProject().getId() != null) {
            boq.setProject(projectRepository.getReferenceById(boq.getProject().getId()));
        } else {
            boq.setProject(null);
        }
        if (boq.getMeasurement() != null && boq.getMeasurement().getId() != null) {
            boq.setMeasurement(measurementRepository.getReferenceById(boq.getMeasurement().getId()));
        } else {
            boq.setMeasurement(null);
        }
    }

    // =====================================================================
    // Query / list / meta
    // =====================================================================

    @Transactional(readOnly = true)
    public Page<Boq> getBoqs(String search, String status, Long customerId, Long projectId,
            Boolean latestOnly, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 200), Sort.by("id").descending());
        Specification<Boq> spec = Specification.where(BoqSpecification.notDeleted())
                .and(BoqSpecification.hasStatus(status))
                .and(BoqSpecification.hasCustomer(customerId))
                .and(BoqSpecification.hasProject(projectId))
                .and(BoqSpecification.latestVersionOnly(latestOnly))
                .and(BoqSpecification.matchesSearch(search));
        return boqRepository.findAll(spec, pageRequest);
    }

    @Transactional(readOnly = true)
    public Boq getBoqById(Long id) {
        Boq boq = boqRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("BOQ not found with id: " + id));
        if (Boolean.TRUE.equals(boq.getIsDeleted())) {
            throw new ResourceNotFoundException("BOQ not found with id: " + id);
        }
        attachStockWarnings(boq);
        return boq;
    }

    public Map<String, Object> getMeta() {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("categories", CATEGORIES);
        meta.put("units", UNITS);
        meta.put("statuses", STATUSES);
        meta.put("itemStatuses", ITEM_STATUSES);
        meta.put("quotationModes", QUOTATION_MODES);
        return meta;
    }

    @Transactional(readOnly = true)
    public List<Boq> getByCustomer(Long customerId) {
        return boqRepository.findByCustomerIdAndIsDeletedFalseOrderByIdDesc(customerId);
    }

    @Transactional(readOnly = true)
    public List<Boq> getByProject(Long projectId) {
        return boqRepository.findByProjectIdAndIsDeletedFalseOrderByIdDesc(projectId);
    }

    @Transactional(readOnly = true)
    public List<Boq> getByMeasurement(Long measurementId) {
        return boqRepository.findByMeasurementIdAndIsDeletedFalseOrderByIdDesc(measurementId);
    }

    @Transactional(readOnly = true)
    public List<Boq> getByLead(Long leadId) {
        return boqRepository.findByLeadIdAndIsDeletedFalseOrderByIdDesc(leadId);
    }

    /** The Master BOQ (root of the revision chain) for any revision — resolved on read rather than stored, to avoid a driftable duplicate pointer. */
    @Transactional(readOnly = true)
    public Boq resolveMasterBoq(Long boqId) {
        Boq boq = getBoqById(boqId);
        return boq.getParentBoqId() != null ? getBoqById(boq.getParentBoqId()) : boq;
    }

    // =====================================================================
    // CRUD
    // =====================================================================

    @Transactional
    public Boq createBoq(Boq boq, User currentUser) {
        return createBoq(boq, currentUser, true);
    }

    /**
     * @param requireMeasurement enforces "every new BOQ must come from a Measurement" for the public
     *                           manual-create entry point, while internal callers that already resolved
     *                           (or deliberately omit, e.g. a clone of a legacy unlinked BOQ) the
     *                           measurement pass {@code false} to skip the check.
     */
    private Boq createBoq(Boq boq, User currentUser, boolean requireMeasurement) {
        if (requireMeasurement && (boq.getMeasurement() == null || boq.getMeasurement().getId() == null)) {
            throw new IllegalArgumentException("A BOQ must be generated from a Measurement — use 'Generate BOQ' from the Measurement page.");
        }
        resolveRefs(boq);
        boq.setBoqNumber(nextBoqNumber());
        boq.setRevisionNumber(1);
        boq.setIsLatestVersion(true);
        boq.setStatus("DRAFT");
        boq.setCreatedByUser(currentUser);
        linkChildren(boq);
        recalculateTotals(boq);
        Boq saved = boqRepository.save(boq);
        logActivity(saved, "Created", "BOQ created", currentUser);
        return saved;
    }

    @Transactional
    public Boq createFromMeasurement(Long measurementId, User currentUser) {
        Measurement measurement = measurementRepository.findById(measurementId)
                .orElseThrow(() -> new ResourceNotFoundException("Measurement not found with id: " + measurementId));
        if (!boqRepository.findByMeasurementIdAndParentBoqIdIsNullAndIsDeletedFalse(measurementId).isEmpty()) {
            throw new IllegalStateException("A Master BOQ already exists for this measurement — open it and create a revision instead of generating a new one.");
        }
        Boq boq = new Boq();
        boq.setCustomer(resolveCustomer(measurement));
        boq.setProject(measurement.getProject());
        boq.setMeasurement(measurement);
        boq.setLead(measurement.getLead());
        boq.setSiteVisit(measurement.getSiteVisit());
        if (boq.getCustomer() == null && boq.getLead() == null) {
            throw new IllegalStateException("This measurement is not linked to a customer or a lead, so the BOQ would have no owner. "
                    + "Open the measurement, set the customer or lead, then generate the BOQ again.");
        }
        boq.setLinkStatus("LINKED");
        boq.setPropertyName(measurement.getLocation() != null ? measurement.getLocation() : measurement.getSiteAddress());

        List<MeasurementRoom> measuredRooms = measurementRoomRepository.findByMeasurementId(measurementId);
        List<String> emptyRooms = new ArrayList<>();
        List<BoqItem> items = buildItemsFromMeasurement(measuredRooms, emptyRooms);
        boq.setItems(items);

        Boq saved = createBoq(boq, currentUser);
        int phaseCount = createFloorPhases(saved);

        String summary = "Generated from measurement " + measurement.getMeasurementNumber()
                + " with " + items.size() + " item(s) across " + phaseCount + " floor phase(s)";
        if (!emptyRooms.isEmpty()) {
            summary += ". No work recorded for: " + String.join(", ", emptyRooms)
                    + " — tick a scope of work or add items on those rooms, then use Sync from Measurement.";
        }
        logActivity(saved, "Generated from Measurement", summary, currentUser);
        return saved;
    }

    /**
     * Turns a measurement's rooms into BOQ work items. Shared by first generation and later syncs so
     * both produce identical lines.
     *
     * @param emptyRooms collects rooms that yielded nothing, for reporting back to the user.
     */
    private List<BoqItem> buildItemsFromMeasurement(List<MeasurementRoom> measuredRooms, List<String> emptyRooms) {
        List<BoqItem> items = new ArrayList<>();
        for (MeasurementRoom room : measuredRooms) {
            int before = items.size();
            items.addAll(deriveRoomWorkItems(room));
            for (MeasurementItem mi : measurementItemRepository.findByRoomId(room.getId())) {
                BoqItem item = new BoqItem();
                item.setFloorName(room.getFloorNumber());
                item.setRoomName(room.getRoomName());
                item.setCategory(mi.getItemType());
                item.setItemName(mi.getItemName() != null ? mi.getItemName() : mi.getItemType());
                item.setMeasurementRoomId(room.getId());
                item.setMeasurementItemId(mi.getId());
                item.setLength(toBigDecimal(mi.getLength()));
                item.setWidth(toBigDecimal(mi.getWidth()));
                item.setHeight(toBigDecimal(mi.getHeight()));
                item.setArea(toBigDecimal(mi.getArea()));
                item.setPerimeter(toBigDecimal(room.getPerimeter()));
                item.setQuantity(mi.getQuantity() != null ? new BigDecimal(mi.getQuantity()) : BigDecimal.ONE);
                item.setUnit(mi.getUnit() != null ? mi.getUnit() : defaultUnitFor(mi.getItemType()));
                item.setDescription(mi.getNotes());
                item.setStatus("PENDING");
                seedSpecifiedMaterial(item, mi);
                items.add(item);
            }
            if (items.size() == before) {
                emptyRooms.add(room.getRoomName());
            }
        }
        return items;
    }

    /**
     * Pulls rooms/items added to the measurement since the BOQ was generated into the existing BOQ.
     * Without this a BOQ generated from an empty (or partly measured) measurement was a dead end:
     * createFromMeasurement refuses to run twice, and creating a revision only clones what is already
     * there. Additive and idempotent — existing lines, their rates and any manual edits are untouched.
     */
    @Transactional
    public Map<String, Object> syncFromMeasurement(Long boqId, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        if (boq.getMeasurement() == null || boq.getMeasurement().getId() == null) {
            throw new IllegalStateException("This BOQ was not generated from a measurement, so there is nothing to sync.");
        }

        Long measurementId = boq.getMeasurement().getId();
        List<MeasurementRoom> measuredRooms = measurementRoomRepository.findByMeasurementId(measurementId);
        List<String> emptyRooms = new ArrayList<>();

        List<BoqItem> existing = boqItemRepository.findByBoqId(boqId);
        Set<Long> knownItemIds = existing.stream()
                .map(BoqItem::getMeasurementItemId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> knownDerived = existing.stream()
                .filter(i -> i.getMeasurementItemId() == null && i.getMeasurementRoomId() != null)
                .map(i -> i.getMeasurementRoomId() + "|" + i.getItemName())
                .collect(Collectors.toSet());

        List<BoqItem> added = new ArrayList<>();
        for (BoqItem candidate : buildItemsFromMeasurement(measuredRooms, emptyRooms)) {
            boolean alreadyPresent = candidate.getMeasurementItemId() != null
                    ? knownItemIds.contains(candidate.getMeasurementItemId())
                    : knownDerived.contains(candidate.getMeasurementRoomId() + "|" + candidate.getItemName());
            if (alreadyPresent) {
                continue;
            }
            candidate.setBoq(boq);
            candidate.setItemCode(nextItemCode());
            candidate.getMaterials().forEach(m -> { m.setItem(candidate); resolveProductRef(m); });
            candidate.getLabours().forEach(l -> l.setItem(candidate));
            boq.getItems().add(candidate);
            added.add(candidate);
        }

        recalculateTotals(boq);
        Boq savedBoq = boqRepository.save(boq);
        int phaseCount = createFloorPhases(savedBoq);

        String summary = added.isEmpty()
                ? "Already in sync with measurement " + boq.getMeasurement().getMeasurementNumber()
                : "Synced from measurement " + boq.getMeasurement().getMeasurementNumber()
                        + ": added " + added.size() + " item(s) across " + phaseCount + " floor phase(s)";
        if (!emptyRooms.isEmpty()) {
            summary += ". No work recorded for: " + String.join(", ", emptyRooms);
        }
        logActivity(savedBoq, "Synced from Measurement", summary, currentUser);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("itemsAdded", added.size());
        result.put("phases", phaseCount);
        result.put("roomsWithoutWork", emptyRooms);
        result.put("message", summary);
        return result;
    }

    /**
     * Recreates the measurement's floor structure as BoqPhases and files each item under its floor.
     * Without this every generated item lands phase-less, which flattens the BOQ and later forces
     * ProjectService.generateFromBoq into its catch-all "General Works" bucket.
     * Phases are created after the BOQ is saved so the items already have ids to update. Floors are
     * read off the saved items, not the measurement, so a room that produced no work gets no phase.
     */
    private int createFloorPhases(Boq boq) {
        List<BoqItem> savedItems = boqItemRepository.findByBoqId(boq.getId());
        if (savedItems.isEmpty()) {
            return 0;
        }
        // Order floors the way the building is stacked, not the order rooms happened to be measured.
        List<String> floorOrder = new ArrayList<>(MeasurementWorkflow.FLOOR_LEVELS);
        List<String> floors = savedItems.stream()
                .map(i -> i.getFloorName() != null && !i.getFloorName().isBlank() ? i.getFloorName() : UNASSIGNED_FLOOR)
                .distinct()
                .sorted(Comparator.comparingInt((String f) -> {
                    int i = floorOrder.indexOf(f);
                    return i == -1 ? floorOrder.size() : i;
                }).thenComparing(Comparator.naturalOrder()))
                .toList();

        // Reuse phases already on the BOQ so re-syncing never duplicates them. Phase names are the
        // bare floor label for exactly this reason — anything varying (like a room count) would stop
        // matching as soon as the measurement gained a room.
        Map<String, BoqPhase> phasesByFloor = new LinkedHashMap<>();
        for (BoqPhase existing : boqPhaseRepository.findByBoqIdOrderBySequenceAsc(boq.getId())) {
            phasesByFloor.putIfAbsent(existing.getPhaseName(), existing);
        }
        int sequence = phasesByFloor.values().stream()
                .map(BoqPhase::getSequence).filter(Objects::nonNull)
                .max(Integer::compareTo).orElse(0) + 1;

        for (String floor : floors) {
            if (phasesByFloor.containsKey(floor)) {
                continue;
            }
            BoqPhase phase = new BoqPhase();
            phase.setBoq(boq);
            phase.setPhaseName(floor);
            phase.setSequence(sequence++);
            phase.setStatus("PLANNING");
            phase.setIsActive(true);
            phasesByFloor.put(floor, boqPhaseRepository.save(phase));
        }

        for (BoqItem item : savedItems) {
            String floor = item.getFloorName() != null && !item.getFloorName().isBlank()
                    ? item.getFloorName() : UNASSIGNED_FLOOR;
            item.setPhase(phasesByFloor.get(floor));
        }
        boqItemRepository.saveAll(savedItems);
        return phasesByFloor.size();
    }

    private BigDecimal toBigDecimal(Double value) {
        return value != null ? BigDecimal.valueOf(value) : null;
    }

    /** Label for items whose source room had no floor set — mirrors the measurement's own wording. */
    private static final String UNASSIGNED_FLOOR = "Unassigned Floor";

    /** Units per item type, so estimators aren't left guessing on every generated line. */
    private static final Map<String, String> DEFAULT_UNITS = Map.ofEntries(
            Map.entry("Wall", "Sqft"), Map.entry("Ceiling", "Sqft"), Map.entry("Floor", "Sqft"),
            Map.entry("Partition", "Sqft"), Map.entry("False Ceiling", "Sqft"),
            Map.entry("Wall Panelling", "Sqft"), Map.entry("Glass Partition", "Sqft"),
            Map.entry("Mirror", "Sqft"), Map.entry("Screen", "Sqft"),
            Map.entry("Wardrobe", "Sqft"), Map.entry("Cupboard", "Sqft"), Map.entry("Loft", "Sqft"),
            Map.entry("TV Unit", "Sqft"), Map.entry("Kitchen Cabinet", "Sqft"),
            Map.entry("Crockery Unit", "Sqft"), Map.entry("Shelf", "Sqft"),
            Map.entry("Storage Unit", "Sqft"), Map.entry("Study Table", "Sqft"),
            Map.entry("Vanity", "Sqft"),
            Map.entry("Skirting", "Rft"), Map.entry("Railing", "Rft"),
            Map.entry("Curtain / Blind", "Rft"),
            Map.entry("Door", "Nos"), Map.entry("Window", "Nos"), Map.entry("Column", "Nos"),
            Map.entry("Beam", "Nos"), Map.entry("Electrical Point", "Nos"),
            Map.entry("Switch", "Nos"), Map.entry("Socket", "Nos"), Map.entry("Light", "Nos"),
            Map.entry("Fan", "Nos"), Map.entry("AC Point", "Nos"), Map.entry("Plumbing Point", "Nos"));

    private String defaultUnitFor(String itemType) {
        return itemType != null ? DEFAULT_UNITS.getOrDefault(itemType, "Nos") : "Nos";
    }

    /**
     * The finish/material noted on site ("8mm toughened", "Teak ply") used to be dropped on
     * generation. Carry it across as an un-priced material line so the estimator prices the
     * specification that was actually observed, instead of re-deriving it from memory.
     */
    private void seedSpecifiedMaterial(BoqItem item, MeasurementItem source) {
        String material = source.getMaterial();
        if (material == null || material.isBlank()) {
            return;
        }
        BoqItemMaterial line = new BoqItemMaterial();
        line.setItem(item);
        line.setMaterialName(material.trim());
        line.setQuantity(item.getArea() != null ? item.getArea() : item.getQuantity());
        line.setUnit(item.getUnit());
        line.setRemarks("Specified during site measurement — confirm rate and wastage.");
        item.getMaterials().add(line);
    }

    /**
     * The customer is often known further up the chain than the measurement itself — a measurement
     * raised from a lead's site visit carries no customer until the lead converts. Walk the chain
     * rather than inserting a null and hitting the legacy boqs.customer_id NOT NULL constraint.
     * Still null for a genuine lead-only BOQ, which is legitimate: the BOQ hangs off lead_id.
     */
    private Customer resolveCustomer(Measurement measurement) {
        if (measurement.getCustomer() != null) {
            return measurement.getCustomer();
        }
        if (measurement.getSiteVisit() != null && measurement.getSiteVisit().getCustomer() != null) {
            return measurement.getSiteVisit().getCustomer();
        }
        if (measurement.getLead() != null && measurement.getLead().getConvertedToCustomer() != null) {
            return measurement.getLead().getConvertedToCustomer();
        }
        if (measurement.getProject() != null && measurement.getProject().getCustomer() != null) {
            return measurement.getProject().getCustomer();
        }
        return null;
    }

    /**
     * Turns a room's measured areas + scope-of-work flags into quantified BOQ work items, so the
     * site is measured once and quantities flow downstream (Floor Area → tiling qty, Wall Area →
     * putty/paint qty, Ceiling Area → ceiling paint qty). Estimators then attach materials/labour,
     * set rates and wastage, and adjust quantities on the generated BOQ — but never re-enter dimensions.
     */
    private List<BoqItem> deriveRoomWorkItems(MeasurementRoom room) {
        List<BoqItem> derived = new ArrayList<>();
        if (Boolean.TRUE.equals(room.getFlooringRequired())) {
            addDerivedAreaItem(derived, room, "Flooring", "Floor Tiling",
                    firstPositive(room.getTileArea(), room.getFloorArea()), "floor");
        }
        if (Boolean.TRUE.equals(room.getPaintingRequired())) {
            double wallArea = firstPositive(room.getPaintableArea(), room.getWallArea());
            addDerivedAreaItem(derived, room, "Painting", "Wall Putty", wallArea, "paintable wall");
            addDerivedAreaItem(derived, room, "Painting", "Wall Painting", wallArea, "paintable wall");
            addDerivedAreaItem(derived, room, "Painting", "Ceiling Painting",
                    firstPositive(room.getCeilingArea()), "ceiling");
        }
        if (Boolean.TRUE.equals(room.getFalseCeilingRequired())) {
            addDerivedAreaItem(derived, room, "False Ceiling", "False Ceiling",
                    firstPositive(room.getFalseCeilingArea(), room.getCeilingArea()), "ceiling");
        }
        addWoodworkItem(derived, room, room.getWardrobeRequired(), "Wardrobe", "Wardrobe");
        addWoodworkItem(derived, room, room.getKitchenRequired(), "Modular Kitchen", "Modular Kitchen");
        addWoodworkItem(derived, room, room.getTvUnitRequired(), "Carpentry", "TV Unit");
        addWoodworkItem(derived, room, room.getLoftRequired(), "Carpentry", "Loft");
        addWoodworkItem(derived, room, room.getStorageRequired(), "Carpentry", "Storage Unit");
        return derived;
    }

    private double firstPositive(Double... values) {
        for (Double v : values) {
            if (v != null && v > 0) return v;
        }
        return 0;
    }

    private void addDerivedAreaItem(List<BoqItem> out, MeasurementRoom room, String category,
                                    String workName, double area, String sourceLabel) {
        if (area <= 0) return;
        BigDecimal qty = BigDecimal.valueOf(area).setScale(2, RoundingMode.HALF_UP);
        BoqItem item = newRoomWorkItem(room, category, workName);
        item.setQuantity(qty);
        item.setArea(qty);
        item.setUnit("Sqft");
        item.setDescription("Auto-derived from measured " + sourceLabel + " area (" + qty.toPlainString() + " sqft)");
        out.add(item);
    }

    /**
     * Woodwork scope flags carry no per-item area (the room's woodworkArea is a shared lump),
     * so these land as 1 Nos with the measured woodwork area noted for the estimator to split.
     */
    private void addWoodworkItem(List<BoqItem> out, MeasurementRoom room, Boolean required,
                                 String category, String workName) {
        if (!Boolean.TRUE.equals(required)) return;
        BoqItem item = newRoomWorkItem(room, category, workName);
        item.setQuantity(BigDecimal.ONE);
        item.setUnit("Nos");
        if (room.getWoodworkArea() != null && room.getWoodworkArea() > 0) {
            BigDecimal woodwork = BigDecimal.valueOf(room.getWoodworkArea()).setScale(2, RoundingMode.HALF_UP);
            item.setArea(woodwork);
            item.setDescription("Room's measured woodwork area: " + woodwork.toPlainString()
                    + " sqft (shared across this room's woodwork items)");
        }
        out.add(item);
    }

    private BoqItem newRoomWorkItem(MeasurementRoom room, String category, String workName) {
        BoqItem item = new BoqItem();
        item.setFloorName(room.getFloorNumber());
        item.setRoomName(room.getRoomName());
        item.setCategory(category);
        item.setItemName(room.getRoomName() != null ? workName + " - " + room.getRoomName() : workName);
        item.setMeasurementRoomId(room.getId());
        item.setLength(toBigDecimal(room.getLength()));
        item.setWidth(toBigDecimal(room.getWidth()));
        item.setHeight(toBigDecimal(room.getHeight()));
        item.setPerimeter(toBigDecimal(room.getPerimeter()));
        item.setStatus("PENDING");
        if (room.getNotes() != null && !room.getNotes().isBlank()) {
            item.setRemarks(room.getNotes());
        }
        return item;
    }

    @Transactional
    public Boq updateBoq(Long id, Boq updatedData, User currentUser) {
        Boq existing = getBoqById(id);
        ensureEditable(existing);
        resolveRefs(updatedData);
        existing.setCustomer(updatedData.getCustomer());
        existing.setProject(updatedData.getProject());
        existing.setMeasurement(updatedData.getMeasurement());
        existing.setPropertyName(updatedData.getPropertyName());
        existing.setQuotationMode(updatedData.getQuotationMode() != null ? updatedData.getQuotationMode() : existing.getQuotationMode());
        existing.setNotes(updatedData.getNotes());
        existing.setDiscountType(updatedData.getDiscountType() != null ? updatedData.getDiscountType() : existing.getDiscountType());
        existing.setDiscount(updatedData.getDiscount());
        existing.setTaxPercent(updatedData.getTaxPercent());

        existing.getItems().clear();
        if (updatedData.getItems() != null) {
            updatedData.getItems().forEach(i -> { i.setBoq(existing); existing.getItems().add(i); });
        }

        linkChildren(existing);
        recalculateTotals(existing);
        Boq saved = boqRepository.save(existing);
        logActivity(saved, "Updated", "BOQ details updated", currentUser);
        return saved;
    }

    /**
     * Edits only the pricing totals (discount, tax, and the material/labour lump-sum overrides) and
     * recalculates — deliberately separate from {@link #updateBoq} so a totals-only save never rebuilds
     * or wipes the item list. A null/absent material/labour override clears any prior override and
     * restores auto-summing from the line items.
     */
    @Transactional
    public Boq updateTotals(Long id, Map<String, Object> data, User currentUser) {
        Boq existing = getBoqById(id);
        ensureEditable(existing);

        if (data.containsKey("discountType")) {
            Object dt = data.get("discountType");
            existing.setDiscountType("FLAT".equals(dt) ? "FLAT" : "PERCENT");
        }
        if (data.containsKey("discount")) {
            existing.setDiscount(toBigDecimal(data.get("discount")));
        }
        if (data.containsKey("taxPercent")) {
            existing.setTaxPercent(toBigDecimal(data.get("taxPercent")));
        }
        if (data.containsKey("materialTotalOverride")) {
            existing.setMaterialTotalOverride(toBigDecimal(data.get("materialTotalOverride")));
        }
        if (data.containsKey("labourTotalOverride")) {
            existing.setLabourTotalOverride(toBigDecimal(data.get("labourTotalOverride")));
        }

        recalculateTotals(existing);
        Boq saved = boqRepository.save(existing);
        logActivity(saved, "Updated", "BOQ totals adjusted", currentUser);
        return saved;
    }

    /** Lenient JSON-number/string → BigDecimal; blank or null yields null (used to clear an override). */
    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        if (s.isEmpty()) return null;
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid numeric value: " + s);
        }
    }

    @Transactional
    public void deleteBoq(Long id, User currentUser) {
        Boq existing = getBoqById(id);
        if (existing.getParentBoqId() == null) {
            throw new IllegalStateException("BOQ " + existing.getBoqNumber() + " is a Master/root BOQ and cannot be deleted — it may have revisions or history depending on it.");
        }
        if (existing.getQuotation() != null || quotationRepository.existsByBoqId(id)) {
            throw new IllegalStateException("BOQ " + existing.getBoqNumber() + " is referenced by a quotation and cannot be deleted.");
        }
        if (existing.getProject() != null || projectRepository.existsByBoqId(id)) {
            throw new IllegalStateException("BOQ " + existing.getBoqNumber() + " is referenced by a project and cannot be deleted.");
        }
        existing.setIsDeleted(true);
        existing.setDeletedAt(LocalDateTime.now());
        existing.setDeletedBy(currentUser != null ? currentUser.getEmail() : "system");
        boqRepository.save(existing);
        logActivity(existing, "Deleted", "BOQ soft-deleted", currentUser);
    }

    private synchronized String nextBoqNumber() {
        List<String> latest = boqRepository.findLatestBoqNumbers(PageRequest.of(0, 1));
        long next = 1;
        if (!latest.isEmpty()) {
            try {
                next = Long.parseLong(latest.get(0).substring("BOQ-".length())) + 1;
            } catch (NumberFormatException e) {
                return "BOQ-" + System.currentTimeMillis();
            }
        }
        return String.format("BOQ-%06d", next);
    }

    private synchronized String nextItemCode() {
        return "ITM-" + System.currentTimeMillis() % 1_000_000;
    }

    private void linkChildren(Boq boq) {
        if (boq.getItems() == null) return;
        for (BoqItem item : boq.getItems()) {
            item.setBoq(boq);
            if (item.getItemCode() == null) {
                item.setItemCode(nextItemCode());
            }
            if (item.getMaterials() != null) {
                item.getMaterials().forEach(m -> { m.setItem(item); resolveProductRef(m); });
            }
            if (item.getLabours() != null) {
                item.getLabours().forEach(l -> l.setItem(item));
            }
        }
    }

    // =====================================================================
    // Items (top-level: floor/room/item)
    // =====================================================================

    @Transactional
    public BoqItem addItem(Long boqId, BoqItem item, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        item.setBoq(boq);
        item.setItemCode(nextItemCode());
        if (item.getStatus() == null) item.setStatus("PENDING");
        if (item.getIsActive() == null) item.setIsActive(true);
        if (item.getMaterials() != null) item.getMaterials().forEach(m -> m.setItem(item));
        if (item.getLabours() != null) item.getLabours().forEach(l -> l.setItem(item));
        boq.getItems().add(item);
        recalculateTotals(boq);
        // save(boq) on an already-managed entity doesn't force an immediate flush, so the cascaded
        // new item wouldn't have its IDENTITY-generated id yet — flush explicitly before referencing
        // it from BoqChangeLog below, otherwise Hibernate treats it as a transient FK at commit time.
        boqRepository.saveAndFlush(boq);
        item.setOriginItemId(item.getId());
        boqItemRepository.save(item);
        logActivity(boq, "Item Added", item.getCategory() + " - " + item.getItemName() + " added", currentUser);
        logChange(boq, item, null, "ADD_ITEM", "item", null, item.getItemName(), null, currentUser);
        return item;
    }

    @Transactional
    public BoqItem updateItem(Long boqId, Long itemId, BoqItem updated, String reason, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);

        logChange(boq, item, null, "DIMENSIONS_CHANGED", "quantity", item.getQuantity(), updated.getQuantity(), reason, currentUser);
        logChange(boq, item, null, "DIMENSIONS_CHANGED", "length", item.getLength(), updated.getLength(), reason, currentUser);
        logChange(boq, item, null, "DIMENSIONS_CHANGED", "width", item.getWidth(), updated.getWidth(), reason, currentUser);
        logChange(boq, item, null, "DIMENSIONS_CHANGED", "height", item.getHeight(), updated.getHeight(), reason, currentUser);
        String oldRoomKey = item.getFloorName() + "/" + item.getRoomName();
        String newRoomKey = updated.getFloorName() + "/" + updated.getRoomName();
        if (!oldRoomKey.equals(newRoomKey)) {
            logChange(boq, item, null, "ROOM_MOVED", "roomName", oldRoomKey, newRoomKey, reason, currentUser);
        }

        item.setCategory(updated.getCategory());
        item.setItemName(updated.getItemName());
        item.setDescription(updated.getDescription());
        item.setFloorName(updated.getFloorName());
        item.setRoomName(updated.getRoomName());
        item.setLength(updated.getLength());
        item.setWidth(updated.getWidth());
        item.setHeight(updated.getHeight());
        item.setArea(updated.getArea());
        item.setPerimeter(updated.getPerimeter());
        item.setQuantity(updated.getQuantity());
        item.setUnit(updated.getUnit());
        item.setRemarks(updated.getRemarks());
        if (updated.getStatus() != null) item.setStatus(updated.getStatus());
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, "Item Updated", item.getItemName() + " updated", currentUser);
        return item;
    }

    /** One flattened entry from the drag-and-drop layout: the item and the floor/room it now sits in. */
    public record ReorderEntry(Long itemId, String floorName, String roomName) {}

    /**
     * Applies a drag-and-drop layout: re-parents items to their new floor/room and stamps
     * floor/room/item order from their position in the flattened, visual-order list. One pass
     * reproduces any move + reorder of floors, rooms and items.
     */
    @Transactional
    public Boq reorderItems(Long boqId, List<ReorderEntry> entries, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        Map<String, Integer> floorOrders = new LinkedHashMap<>();
        Map<String, Integer> roomOrders = new LinkedHashMap<>();
        int itemIdx = 0;
        for (ReorderEntry e : entries) {
            BoqItem item = getOwnedItem(boq, e.itemId());
            String floor = e.floorName() != null ? e.floorName() : "";
            String room = e.roomName() != null ? e.roomName() : "";
            item.setFloorName(e.floorName());
            item.setRoomName(e.roomName());
            item.setFloorOrder(floorOrders.computeIfAbsent(floor, k -> floorOrders.size()));
            item.setRoomOrder(roomOrders.computeIfAbsent(floor + " " + room, k -> roomOrders.size()));
            item.setItemOrder(itemIdx++);
        }
        recalculateTotals(boq);
        Boq saved = boqRepository.save(boq);
        logActivity(saved, "Reordered", "BOQ floors/rooms/items reorganised", currentUser);
        return saved;
    }

    @Transactional
    public void deleteItem(Long boqId, Long itemId, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);
        boq.getItems().remove(item);
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, "Item Deleted", item.getItemName() + " removed", currentUser);
        logChange(boq, null, null, "REMOVE_ITEM", "item", item.getItemName(), null, null, currentUser);
    }

    /** Soft disable/enable — preserves the item and its history while excluding it from active totals/tasks/inventory. */
    @Transactional
    public BoqItem toggleItemActive(Long boqId, Long itemId, boolean active, String reason, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);
        boolean was = Boolean.TRUE.equals(item.getIsActive());
        item.setIsActive(active);
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, active ? "Item Enabled" : "Item Disabled", item.getItemName() + (active ? " enabled" : " disabled"), currentUser);
        logChange(boq, item, null, active ? "ITEM_ENABLED" : "ITEM_DISABLED", "isActive", was, active, reason, currentUser);
        return item;
    }

    /** Bulk disable/enable every item sharing a (phase, room) — models "Remove Room"/"Add Room back" without losing history. */
    @Transactional
    public List<BoqItem> toggleRoomActive(Long boqId, Long phaseId, String roomName, boolean active, String reason, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        List<BoqItem> affected = new ArrayList<>();
        for (BoqItem item : boq.getItems()) {
            if (item.getPhase() != null && item.getPhase().getId().equals(phaseId) && roomName.equals(item.getRoomName())) {
                item.setIsActive(active);
                affected.add(item);
            }
        }
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, active ? "Room Enabled" : "Room Removed", roomName + (active ? " re-enabled" : " removed") + " (" + affected.size() + " item(s))", currentUser);
        logChange(boq, null, null, active ? "ADD_ROOM" : "REMOVE_ROOM", "roomName", null, roomName + " (" + affected.size() + " items)", reason, currentUser);
        return affected;
    }

    @Transactional
    public void selectItems(Long boqId, List<Long> itemIds, boolean selected, User currentUser) {
        Boq boq = getBoqById(boqId);
        for (BoqItem item : boq.getItems()) {
            if (itemIds.contains(item.getId())) {
                item.setStatus(selected ? "SELECTED" : "PENDING");
            }
        }
        boqRepository.save(boq);
        logActivity(boq, "Items Selected", itemIds.size() + " item(s) marked " + (selected ? "SELECTED" : "PENDING"), currentUser);
    }

    private BoqItem getOwnedItem(Boq boq, Long itemId) {
        return boq.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Item not found with id: " + itemId));
    }

    // =====================================================================
    // Materials
    // =====================================================================

    @Autowired private ProductRepository productRepository;

    @Transactional
    public BoqItemMaterial addMaterial(Long boqId, Long itemId, BoqItemMaterial material, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);
        material.setItem(item);
        resolveProductRef(material);
        applyProductDefaults(material);
        // Persist first (same reason as addLabour) — a transient element in the loaded orphanRemoval
        // materials bag triggers TransientObjectException on flush.
        BoqItemMaterial saved = boqItemMaterialRepository.save(material);
        item.getMaterials().add(saved);
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, "Material Added", saved.getMaterialName() + " added to " + item.getItemName(), currentUser);
        attachStockWarning(saved);
        return saved;
    }

    @Transactional
    public BoqItemMaterial updateMaterial(Long boqId, Long itemId, Long materialId, BoqItemMaterial updated, String reason, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);
        BoqItemMaterial material = item.getMaterials().stream()
                .filter(m -> m.getId().equals(materialId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Material not found with id: " + materialId));

        if (!Objects.equals(material.getMaterialName(), updated.getMaterialName())
                || !Objects.equals(idOf(material.getProduct()), idOf(updated.getProduct()))) {
            logChange(boq, item, null, "MATERIAL_CHANGED", "materialName", material.getMaterialName(), updated.getMaterialName(), reason, currentUser);
        }
        logChange(boq, item, null, "RATE_CHANGED", "sellingRate", material.getSellingRate(), updated.getSellingRate(), reason, currentUser);
        logChange(boq, item, null, "VENDOR_CHANGED", "vendor", material.getVendor(), updated.getVendor(), reason, currentUser);
        logChange(boq, item, null, "QUANTITY_CHANGED", "materialQuantity", material.getQuantity(), updated.getQuantity(), reason, currentUser);

        material.setProduct(updated.getProduct());
        material.setMaterialName(updated.getMaterialName());
        material.setQuantity(updated.getQuantity());
        material.setUnit(updated.getUnit());
        material.setWastePercent(updated.getWastePercent());
        material.setCostPrice(updated.getCostPrice());
        material.setSellingRate(updated.getSellingRate());
        material.setVendor(updated.getVendor());
        material.setRemarks(updated.getRemarks());
        resolveProductRef(material);
        applyProductDefaults(material);
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, "Material Updated", material.getMaterialName() + " updated", currentUser);
        attachStockWarning(material);
        return material;
    }

    private Long idOf(Product product) {
        return product != null ? product.getId() : null;
    }

    @Transactional
    public void deleteMaterial(Long boqId, Long itemId, Long materialId, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);
        item.getMaterials().removeIf(m -> m.getId().equals(materialId));
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, "Material Removed", "Material removed from " + item.getItemName(), currentUser);
    }

    /** Same fix as {@link #resolveRefs}: swap a JSON {id}-only Product ref for a managed proxy. */
    private void resolveProductRef(BoqItemMaterial material) {
        if (material.getProduct() != null && material.getProduct().getId() != null) {
            material.setProduct(productRepository.getReferenceById(material.getProduct().getId()));
        }
    }

    private void applyProductDefaults(BoqItemMaterial material) {
        if (material.getProduct() != null) {
            Product product = material.getProduct();
            if (material.getMaterialName() == null || material.getMaterialName().isBlank()) {
                material.setMaterialName(product.getName());
            }
            if (material.getUnit() == null) material.setUnit(product.getUnit());
            if (material.getCostPrice() == null) {
                material.setCostPrice(product.getCostPrice() != null ? product.getCostPrice() : product.getPrice());
            }
            if (material.getSellingRate() == null) {
                material.setSellingRate(product.getSellingPrice() != null ? product.getSellingPrice() : product.getPrice());
            }
            if (material.getVendor() == null && product.getSupplier() != null) {
                material.setVendor(product.getSupplier().getName());
            }
        }
    }

    private void attachStockWarnings(Boq boq) {
        if (boq.getItems() == null) return;
        for (BoqItem item : boq.getItems()) {
            if (item.getMaterials() != null) {
                item.getMaterials().forEach(this::attachStockWarning);
            }
        }
    }

    private void attachStockWarning(BoqItemMaterial material) {
        if (material.getProduct() == null || material.getFinalQuantity() == null) return;
        List<InventoryItem> stock = inventoryItemRepository.findByProductId(material.getProduct().getId());
        int available = stock.stream().mapToInt(InventoryItem::getAvailableQuantity).sum();
        material.setAvailableStock(available);
        if (BigDecimal.valueOf(available).compareTo(material.getFinalQuantity()) < 0) {
            material.setStockWarning("Only " + available + " " + (material.getUnit() != null ? material.getUnit() : "") +
                    " available in stock, " + material.getFinalQuantity() + " required.");
        }
    }

    // =====================================================================
    // Labour
    // =====================================================================

    @Transactional
    public BoqItemLabour addLabour(Long boqId, Long itemId, BoqItemLabour labour, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);
        labour.setItem(item);
        // Persist the child first so it carries an id. Adding a transient entity to the already-loaded
        // orphanRemoval labours bag makes Hibernate throw TransientObjectException during flush.
        BoqItemLabour saved = boqItemLabourRepository.save(labour);
        item.getLabours().add(saved);
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, "Labour Added", (saved.getWorkType() != null ? saved.getWorkType() : "Labour") + " added to " + item.getItemName(), currentUser);
        return saved;
    }

    @Transactional
    public BoqItemLabour updateLabour(Long boqId, Long itemId, Long labourId, BoqItemLabour updated, String reason, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);
        BoqItemLabour labour = item.getLabours().stream()
                .filter(l -> l.getId().equals(labourId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Labour not found with id: " + labourId));

        logChange(boq, item, null, "LABOUR_CHANGED", "workType", labour.getWorkType(), updated.getWorkType(), reason, currentUser);
        logChange(boq, item, null, "RATE_CHANGED", "labourRate", labour.getRate(), updated.getRate(), reason, currentUser);

        labour.setWorkType(updated.getWorkType());
        labour.setLabourCategory(updated.getLabourCategory());
        labour.setQuantity(updated.getQuantity());
        labour.setRate(updated.getRate());
        labour.setContractorName(updated.getContractorName());
        labour.setRemarks(updated.getRemarks());
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, "Labour Updated", "Labour updated on " + item.getItemName(), currentUser);
        return labour;
    }

    @Transactional
    public void deleteLabour(Long boqId, Long itemId, Long labourId, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqItem item = getOwnedItem(boq, itemId);
        item.getLabours().removeIf(l -> l.getId().equals(labourId));
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, "Labour Removed", "Labour removed from " + item.getItemName(), currentUser);
    }

    // =====================================================================
    // Phases
    // =====================================================================

    @Transactional(readOnly = true)
    public List<BoqPhase> getPhases(Long boqId) {
        return boqPhaseRepository.findByBoqIdOrderBySequenceAsc(boqId);
    }

    @Transactional
    public BoqPhase addPhase(Long boqId, BoqPhase phase, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        phase.setBoq(boq);
        if (phase.getIsActive() == null) phase.setIsActive(true);
        BoqPhase saved = boqPhaseRepository.save(phase);
        logActivity(boq, "Phase Added", phase.getPhaseName() + " added", currentUser);
        logChange(boq, null, saved, "ADD_FLOOR", "phase", null, saved.getPhaseName(), null, currentUser);
        return saved;
    }

    @Transactional
    public BoqPhase updatePhase(Long boqId, Long phaseId, BoqPhase updated, String reason, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqPhase phase = boqPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found with id: " + phaseId));
        logChange(boq, null, phase, "RATE_CHANGED", "budget", phase.getBudget(), updated.getBudget(), reason, currentUser);
        phase.setPhaseName(updated.getPhaseName());
        phase.setSequence(updated.getSequence());
        phase.setStatus(updated.getStatus());
        phase.setBudget(updated.getBudget());
        phase.setCompletionPercent(updated.getCompletionPercent());
        BoqPhase saved = boqPhaseRepository.save(phase);
        logActivity(boq, "Phase Updated", phase.getPhaseName() + " updated", currentUser);
        return saved;
    }

    @Transactional
    public void deletePhase(Long boqId, Long phaseId, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        boqPhaseRepository.deleteById(phaseId);
        logActivity(boq, "Phase Deleted", "Phase " + phaseId + " removed", currentUser);
        logChange(boq, null, null, "REMOVE_FLOOR", "phase", String.valueOf(phaseId), null, null, currentUser);
    }

    /** Soft disable/enable a whole phase (e.g. customer drops a floor) — preserves history, unlike delete. */
    @Transactional
    public BoqPhase togglePhaseActive(Long boqId, Long phaseId, boolean active, String reason, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqPhase phase = boqPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found with id: " + phaseId));
        boolean was = Boolean.TRUE.equals(phase.getIsActive());
        phase.setIsActive(active);
        boqPhaseRepository.save(phase);
        recalculateTotals(boq);
        boqRepository.save(boq);
        logActivity(boq, active ? "Phase Enabled" : "Phase Disabled", phase.getPhaseName() + (active ? " enabled" : " disabled"), currentUser);
        logChange(boq, null, phase, active ? "PHASE_ENABLED" : "PHASE_DISABLED", "isActive", was, active, reason, currentUser);
        return phase;
    }

    /** Moves the given items into a brand-new phase within the same BOQ ("Split Work into Phases"). */
    @Transactional
    public BoqPhase splitPhase(Long boqId, Long sourcePhaseId, String newPhaseName, List<Long> itemIds, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqPhase source = boqPhaseRepository.findById(sourcePhaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found with id: " + sourcePhaseId));
        BoqPhase newPhase = new BoqPhase();
        newPhase.setBoq(boq);
        newPhase.setPhaseName(newPhaseName);
        newPhase.setSequence(source.getSequence());
        newPhase.setStatus("PLANNING");
        newPhase.setIsActive(true);
        newPhase = boqPhaseRepository.save(newPhase);

        int moved = 0;
        for (BoqItem item : boq.getItems()) {
            if (itemIds.contains(item.getId())) {
                item.setPhase(newPhase);
                moved++;
            }
        }
        boqRepository.save(boq);
        logActivity(boq, "Phase Split", moved + " item(s) split from " + source.getPhaseName() + " into new phase " + newPhaseName, currentUser);
        logChange(boq, null, newPhase, "PHASE_SPLIT", "phase", source.getPhaseName(), newPhaseName + " (" + moved + " items)", null, currentUser);
        return newPhase;
    }

    /** Moves all items from phase B into phase A and disables B ("Merge Phases"). */
    @Transactional
    public BoqPhase mergePhases(Long boqId, Long phaseIdA, Long phaseIdB, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqPhase target = boqPhaseRepository.findById(phaseIdA)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found with id: " + phaseIdA));
        BoqPhase source = boqPhaseRepository.findById(phaseIdB)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found with id: " + phaseIdB));

        int moved = 0;
        for (BoqItem item : boq.getItems()) {
            if (item.getPhase() != null && item.getPhase().getId().equals(phaseIdB)) {
                item.setPhase(target);
                moved++;
            }
        }
        source.setIsActive(false);
        boqPhaseRepository.save(source);
        boqRepository.save(boq);
        logActivity(boq, "Phases Merged", source.getPhaseName() + " merged into " + target.getPhaseName() + " (" + moved + " item(s))", currentUser);
        logChange(boq, null, target, "PHASE_MERGED", "phase", source.getPhaseName(), target.getPhaseName(), null, currentUser);
        return target;
    }

    /** Bulk-moves every item sharing a (phase, room) to a different phase ("Move rooms between floors"). */
    @Transactional
    public List<BoqItem> moveRoom(Long boqId, Long phaseId, String roomName, Long targetPhaseId, User currentUser) {
        Boq boq = getBoqById(boqId);
        ensureEditable(boq);
        BoqPhase targetPhase = boqPhaseRepository.findById(targetPhaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found with id: " + targetPhaseId));
        List<BoqItem> affected = new ArrayList<>();
        for (BoqItem item : boq.getItems()) {
            if (item.getPhase() != null && item.getPhase().getId().equals(phaseId) && roomName.equals(item.getRoomName())) {
                item.setPhase(targetPhase);
                affected.add(item);
            }
        }
        boqRepository.save(boq);
        logActivity(boq, "Room Moved", roomName + " moved to " + targetPhase.getPhaseName() + " (" + affected.size() + " item(s))", currentUser);
        logChange(boq, null, targetPhase, "ROOM_MOVED", "roomName", roomName + " (phase " + phaseId + ")", roomName + " (phase " + targetPhaseId + ")", null, currentUser);
        return affected;
    }

    // =====================================================================
    // Auto calculation
    // =====================================================================

    private void recalculateTotals(Boq boq) {
        BigDecimal boqMaterialTotal = BigDecimal.ZERO;
        BigDecimal boqLabourTotal = BigDecimal.ZERO;

        if (boq.getItems() != null) {
            for (BoqItem item : boq.getItems()) {
                // Disabled items/phases (customer dropped this floor/room) are excluded from active
                // totals so approving a scope change immediately recalculates project cost, but their
                // computed amount fields are left untouched (not zeroed) so history/reports stay intact.
                boolean active = !Boolean.FALSE.equals(item.getIsActive())
                        && (item.getPhase() == null || !Boolean.FALSE.equals(item.getPhase().getIsActive()));

                BigDecimal itemMaterialTotal = BigDecimal.ZERO;
                if (item.getMaterials() != null) {
                    for (BoqItemMaterial m : item.getMaterials()) {
                        if (m.getQuantity() == null || m.getSellingRate() == null) continue;
                        BigDecimal waste = m.getWastePercent() != null ? m.getWastePercent() : BigDecimal.ZERO;
                        BigDecimal finalQty = m.getQuantity().multiply(BigDecimal.ONE.add(waste.divide(HUNDRED, 6, RoundingMode.HALF_UP)));
                        m.setFinalQuantity(finalQty);
                        BigDecimal amount = finalQty.multiply(m.getSellingRate()).setScale(2, RoundingMode.HALF_UP);
                        m.setAmount(amount);
                        itemMaterialTotal = itemMaterialTotal.add(amount);
                    }
                }

                BigDecimal itemLabourTotal = BigDecimal.ZERO;
                if (item.getLabours() != null) {
                    for (BoqItemLabour l : item.getLabours()) {
                        if (l.getQuantity() == null || l.getRate() == null) continue;
                        BigDecimal amount = l.getQuantity().multiply(l.getRate()).setScale(2, RoundingMode.HALF_UP);
                        l.setAmount(amount);
                        itemLabourTotal = itemLabourTotal.add(amount);
                    }
                }

                item.setMaterialTotal(itemMaterialTotal);
                item.setLabourTotal(itemLabourTotal);
                item.setAmount(itemMaterialTotal.add(itemLabourTotal));

                if (active) {
                    boqMaterialTotal = boqMaterialTotal.add(itemMaterialTotal);
                    boqLabourTotal = boqLabourTotal.add(itemLabourTotal);
                }
            }
        }

        // A manual override (entered on the Totals card) replaces the summed total; null falls back to
        // the item-derived sum computed above, so clearing the override restores auto-calculation.
        BigDecimal effectiveMaterialTotal = boq.getMaterialTotalOverride() != null
                ? boq.getMaterialTotalOverride() : boqMaterialTotal;
        BigDecimal effectiveLabourTotal = boq.getLabourTotalOverride() != null
                ? boq.getLabourTotalOverride() : boqLabourTotal;

        boq.setMaterialTotal(effectiveMaterialTotal);
        boq.setLabourTotal(effectiveLabourTotal);
        BigDecimal subtotal = effectiveMaterialTotal.add(effectiveLabourTotal);
        boq.setSubtotal(subtotal);

        BigDecimal discountInput = boq.getDiscount() != null ? boq.getDiscount() : BigDecimal.ZERO;
        BigDecimal discountAmount;
        if ("FLAT".equals(boq.getDiscountType())) {
            discountAmount = discountInput;
        } else {
            discountAmount = subtotal.multiply(discountInput.divide(HUNDRED, 6, RoundingMode.HALF_UP));
        }
        discountAmount = discountAmount.setScale(2, RoundingMode.HALF_UP);
        boq.setDiscountAmount(discountAmount);

        BigDecimal afterDiscount = subtotal.subtract(discountAmount);
        BigDecimal taxPercent = boq.getTaxPercent() != null ? boq.getTaxPercent() : BigDecimal.ZERO;
        BigDecimal taxAmount = afterDiscount.multiply(taxPercent.divide(HUNDRED, 6, RoundingMode.HALF_UP))
                .setScale(2, RoundingMode.HALF_UP);
        boq.setTaxAmount(taxAmount);

        boq.setGrandTotal(afterDiscount.add(taxAmount));
    }

    // =====================================================================
    // Clone / revisions / compare
    // =====================================================================

    @Transactional
    public Boq cloneBoq(Long id, User currentUser) {
        Boq original = getBoqById(id);
        Boq copy = new Boq();
        copy.setCustomer(original.getCustomer());
        copy.setProject(original.getProject());
        copy.setMeasurement(original.getMeasurement());
        copy.setPropertyName(original.getPropertyName());
        copy.setNotes(original.getNotes());
        copy.setDiscountType(original.getDiscountType());
        copy.setDiscount(original.getDiscount());
        copy.setTaxPercent(original.getTaxPercent());
        copy.setMaterialTotalOverride(original.getMaterialTotalOverride());
        copy.setLabourTotalOverride(original.getLabourTotalOverride());
        copy.setLead(original.getLead());
        copy.setSiteVisit(original.getSiteVisit());
        copy.setLinkStatus(original.getLinkStatus());

        // Map old item id -> cloned item, so phases can be cloned too and items repointed to their clone
        // (mirrors createRevision — a clone must not silently drop floor/phase grouping either).
        List<BoqItem> clonedItems = cloneItems(original.getItems());
        Map<Long, BoqItem> clonedItemsByOriginalId = new LinkedHashMap<>();
        int idx = 0;
        for (BoqItem originalItem : original.getItems() != null ? original.getItems() : List.<BoqItem>of()) {
            clonedItemsByOriginalId.put(originalItem.getId(), clonedItems.get(idx++));
        }
        copy.setItems(clonedItems);

        List<BoqPhase> clonedPhases = new ArrayList<>();
        Map<Long, BoqPhase> clonedPhaseByOriginalId = new LinkedHashMap<>();
        for (BoqPhase phase : boqPhaseRepository.findByBoqIdOrderBySequenceAsc(original.getId())) {
            BoqPhase clone = new BoqPhase();
            clone.setBoq(copy);
            clone.setPhaseName(phase.getPhaseName());
            clone.setSequence(phase.getSequence());
            clone.setStatus(phase.getStatus());
            clone.setBudget(phase.getBudget());
            clone.setCompletionPercent(phase.getCompletionPercent());
            clone.setIsActive(true);
            clonedPhases.add(clone);
            clonedPhaseByOriginalId.put(phase.getId(), clone);
        }
        copy.setPhases(clonedPhases);

        // A clone may originate from a legacy measurement-less BOQ — don't re-block that on delete.
        Boq saved = createBoq(copy, currentUser, false);

        // Repoint each cloned item's phase to its cloned phase (must happen after save so both sides have ids).
        // Unlike a revision, a clone is an unrelated BOQ, so originItemId is left unset (no lineage to track).
        for (BoqItem originalItem : original.getItems() != null ? original.getItems() : List.<BoqItem>of()) {
            BoqItem clonedItem = clonedItemsByOriginalId.get(originalItem.getId());
            if (clonedItem == null || originalItem.getPhase() == null) continue;
            clonedItem.setPhase(clonedPhaseByOriginalId.get(originalItem.getPhase().getId()));
        }
        boqRepository.save(saved);

        logActivity(saved, "Cloned", "Cloned from BOQ " + original.getBoqNumber(), currentUser);
        return saved;
    }

    @Transactional
    public Boq createRevision(Long id, User currentUser) {
        return createRevision(id, null, currentUser);
    }

    @Transactional
    public Boq createRevision(Long id, String reason, User currentUser) {
        Boq original = getBoqById(id);

        Boq revision = new Boq();
        revision.setCustomer(original.getCustomer());
        revision.setProject(original.getProject());
        revision.setMeasurement(original.getMeasurement());
        revision.setLead(original.getLead());
        revision.setSiteVisit(original.getSiteVisit());
        revision.setLinkStatus(original.getLinkStatus());
        revision.setPropertyName(original.getPropertyName());
        revision.setNotes(original.getNotes());
        revision.setDiscountType(original.getDiscountType());
        revision.setDiscount(original.getDiscount());
        revision.setTaxPercent(original.getTaxPercent());
        revision.setMaterialTotalOverride(original.getMaterialTotalOverride());
        revision.setLabourTotalOverride(original.getLabourTotalOverride());
        revision.setBoqNumber(nextBoqNumber());
        revision.setRevisionNumber(original.getRevisionNumber() + 1);
        revision.setParentBoqId(original.getParentBoqId() != null ? original.getParentBoqId() : original.getId());
        revision.setIsLatestVersion(true);
        revision.setStatus("DRAFT");
        revision.setRevisionReason(reason);
        revision.setCreatedByUser(currentUser);

        // Map old item id -> cloned item, so phases can be cloned too and items repointed to their clone.
        List<BoqItem> clonedItems = cloneItems(original.getItems());
        Map<Long, BoqItem> clonedItemsByOriginalId = new LinkedHashMap<>();
        int idx = 0;
        for (BoqItem original2 : original.getItems() != null ? original.getItems() : List.<BoqItem>of()) {
            clonedItemsByOriginalId.put(original2.getId(), clonedItems.get(idx++));
        }
        revision.setItems(clonedItems);

        // Fixes a pre-existing gap: createRevision used to silently drop phases, so revised BOQs
        // lost their floor/phase breakdown. Clone them too and repoint each item's phase reference.
        List<BoqPhase> clonedPhases = new ArrayList<>();
        Map<Long, BoqPhase> clonedPhaseByOriginalId = new LinkedHashMap<>();
        for (BoqPhase phase : boqPhaseRepository.findByBoqIdOrderBySequenceAsc(original.getId())) {
            BoqPhase clone = new BoqPhase();
            clone.setBoq(revision);
            clone.setPhaseName(phase.getPhaseName());
            clone.setSequence(phase.getSequence());
            clone.setStatus(phase.getStatus());
            clone.setBudget(phase.getBudget());
            clone.setCompletionPercent(phase.getCompletionPercent());
            clone.setIsActive(true);
            clonedPhases.add(clone);
            clonedPhaseByOriginalId.put(phase.getId(), clone);
        }
        revision.setPhases(clonedPhases);

        linkChildren(revision);
        recalculateTotals(revision);
        Boq savedRevision = boqRepository.save(revision);

        // Repoint each cloned item's phase to its cloned phase (must happen after save so both sides have ids),
        // and inherit originItemId unchanged so the same logical item can be diffed across every revision.
        for (BoqItem originalItem : original.getItems() != null ? original.getItems() : List.<BoqItem>of()) {
            BoqItem clonedItem = clonedItemsByOriginalId.get(originalItem.getId());
            if (clonedItem == null) continue;
            clonedItem.setOriginItemId(originalItem.getOriginItemId() != null ? originalItem.getOriginItemId() : originalItem.getId());
            if (originalItem.getPhase() != null) {
                clonedItem.setPhase(clonedPhaseByOriginalId.get(originalItem.getPhase().getId()));
            }
        }
        boqRepository.save(savedRevision);

        original.setIsLatestVersion(false);
        boqRepository.save(original);

        BigDecimal budgetDifference = savedRevision.getGrandTotal().subtract(original.getGrandTotal());
        String revisionSummary = "Version " + savedRevision.getRevisionNumber() + " created (" + savedRevision.getBoqNumber() + ")"
                + (reason != null && !reason.isBlank() ? " — reason: " + reason : "")
                + " — budget difference: " + budgetDifference;
        logActivity(original, "Revision Created", revisionSummary, currentUser);
        logActivity(savedRevision, "Created", "Created as revision of " + original.getBoqNumber()
                + (reason != null && !reason.isBlank() ? " (" + reason + ")" : ""), currentUser);
        return savedRevision;
    }

    private List<BoqItem> cloneItems(List<BoqItem> items) {
        List<BoqItem> clones = new ArrayList<>();
        if (items == null) return clones;
        for (BoqItem item : items) {
            BoqItem clone = new BoqItem();
            clone.setCategory(item.getCategory());
            clone.setItemName(item.getItemName());
            clone.setDescription(item.getDescription());
            clone.setFloorName(item.getFloorName());
            clone.setRoomName(item.getRoomName());
            clone.setMeasurementRoomId(item.getMeasurementRoomId());
            clone.setMeasurementItemId(item.getMeasurementItemId());
            clone.setLength(item.getLength());
            clone.setWidth(item.getWidth());
            clone.setHeight(item.getHeight());
            clone.setArea(item.getArea());
            clone.setPerimeter(item.getPerimeter());
            clone.setQuantity(item.getQuantity());
            clone.setUnit(item.getUnit());
            clone.setStatus("PENDING");
            clone.setRemarks(item.getRemarks());

            List<BoqItemMaterial> materials = new ArrayList<>();
            if (item.getMaterials() != null) {
                for (BoqItemMaterial m : item.getMaterials()) {
                    BoqItemMaterial mc = new BoqItemMaterial();
                    mc.setItem(clone);
                    mc.setProduct(m.getProduct());
                    mc.setMaterialName(m.getMaterialName());
                    mc.setQuantity(m.getQuantity());
                    mc.setUnit(m.getUnit());
                    mc.setWastePercent(m.getWastePercent());
                    mc.setCostPrice(m.getCostPrice());
                    mc.setSellingRate(m.getSellingRate());
                    mc.setVendor(m.getVendor());
                    mc.setRemarks(m.getRemarks());
                    mc.setAmount(m.getAmount());
                    materials.add(mc);
                }
            }
            clone.setMaterials(materials);

            List<BoqItemLabour> labours = new ArrayList<>();
            if (item.getLabours() != null) {
                for (BoqItemLabour l : item.getLabours()) {
                    BoqItemLabour lc = new BoqItemLabour();
                    lc.setItem(clone);
                    lc.setWorkType(l.getWorkType());
                    lc.setLabourCategory(l.getLabourCategory());
                    lc.setQuantity(l.getQuantity());
                    lc.setRate(l.getRate());
                    lc.setContractorName(l.getContractorName());
                    lc.setRemarks(l.getRemarks());
                    lc.setAmount(l.getAmount());
                    labours.add(lc);
                }
            }
            clone.setLabours(labours);

            clones.add(clone);
        }
        return clones;
    }

    @Transactional(readOnly = true)
    public List<Boq> getRevisionFamily(Long id) {
        Boq current = getBoqById(id);
        Long rootId = current.getParentBoqId() != null ? current.getParentBoqId() : current.getId();
        List<Boq> family = new ArrayList<>();
        family.add(getBoqById(rootId));
        family.addAll(boqRepository.findByParentBoqIdAndIsDeletedFalseOrderByRevisionNumberDesc(rootId));
        family.sort(Comparator.comparing(Boq::getRevisionNumber).reversed());
        return family;
    }

    @Transactional(readOnly = true)
    public List<Boq> compareVersions(Long id1, Long id2) {
        return List.of(getBoqById(id1), getBoqById(id2));
    }

    /**
     * Real item/phase-level diff between two BOQ revisions, matched by {@link BoqItem#getOriginItemId()}
     * (stable across clones, unlike the row id) rather than the raw-entity stub {@link #compareVersions}.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> compareVersionsDetailed(Long id1, Long id2) {
        Boq a = getBoqById(id1);
        Boq b = getBoqById(id2);

        Map<Long, BoqItem> itemsA = new LinkedHashMap<>();
        for (BoqItem item : a.getItems()) itemsA.put(item.getOriginItemId() != null ? item.getOriginItemId() : item.getId(), item);
        Map<Long, BoqItem> itemsB = new LinkedHashMap<>();
        for (BoqItem item : b.getItems()) itemsB.put(item.getOriginItemId() != null ? item.getOriginItemId() : item.getId(), item);

        List<Map<String, Object>> itemsAdded = new ArrayList<>();
        List<Map<String, Object>> itemsRemoved = new ArrayList<>();
        List<Map<String, Object>> itemsChanged = new ArrayList<>();

        for (Map.Entry<Long, BoqItem> entry : itemsB.entrySet()) {
            BoqItem inA = itemsA.get(entry.getKey());
            BoqItem inB = entry.getValue();
            if (inA == null) {
                itemsAdded.add(itemSummary(inB));
            } else {
                List<Map<String, Object>> fieldDiffs = diffItemFields(inA, inB);
                if (!fieldDiffs.isEmpty()) {
                    Map<String, Object> row = itemSummary(inB);
                    row.put("changes", fieldDiffs);
                    itemsChanged.add(row);
                }
            }
        }
        for (Map.Entry<Long, BoqItem> entry : itemsA.entrySet()) {
            if (!itemsB.containsKey(entry.getKey())) {
                itemsRemoved.add(itemSummary(entry.getValue()));
            }
        }

        Map<String, BoqPhase> phasesA = new LinkedHashMap<>();
        for (BoqPhase p : boqPhaseRepository.findByBoqIdOrderBySequenceAsc(a.getId())) phasesA.put(p.getPhaseName(), p);
        Map<String, BoqPhase> phasesB = new LinkedHashMap<>();
        for (BoqPhase p : boqPhaseRepository.findByBoqIdOrderBySequenceAsc(b.getId())) phasesB.put(p.getPhaseName(), p);

        List<String> phasesAdded = new ArrayList<>();
        List<String> phasesRemoved = new ArrayList<>();
        for (String name : phasesB.keySet()) if (!phasesA.containsKey(name)) phasesAdded.add(name);
        for (String name : phasesA.keySet()) if (!phasesB.containsKey(name)) phasesRemoved.add(name);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fromRevision", a.getRevisionNumber());
        result.put("toRevision", b.getRevisionNumber());
        result.put("itemsAdded", itemsAdded);
        result.put("itemsRemoved", itemsRemoved);
        result.put("itemsChanged", itemsChanged);
        result.put("phasesAdded", phasesAdded);
        result.put("phasesRemoved", phasesRemoved);
        result.put("grandTotalFrom", a.getGrandTotal());
        result.put("grandTotalTo", b.getGrandTotal());
        result.put("grandTotalDelta", b.getGrandTotal().subtract(a.getGrandTotal()));
        return result;
    }

    private Map<String, Object> itemSummary(BoqItem item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("itemId", item.getId());
        row.put("itemName", item.getItemName());
        row.put("floorName", item.getFloorName());
        row.put("roomName", item.getRoomName());
        row.put("amount", item.getAmount());
        return row;
    }

    private List<Map<String, Object>> diffItemFields(BoqItem a, BoqItem b) {
        List<Map<String, Object>> diffs = new ArrayList<>();
        addFieldDiff(diffs, "itemName", a.getItemName(), b.getItemName());
        addFieldDiff(diffs, "quantity", a.getQuantity(), b.getQuantity());
        addFieldDiff(diffs, "length", a.getLength(), b.getLength());
        addFieldDiff(diffs, "width", a.getWidth(), b.getWidth());
        addFieldDiff(diffs, "height", a.getHeight(), b.getHeight());
        addFieldDiff(diffs, "floorName", a.getFloorName(), b.getFloorName());
        addFieldDiff(diffs, "roomName", a.getRoomName(), b.getRoomName());
        addFieldDiff(diffs, "amount", a.getAmount(), b.getAmount());
        addFieldDiff(diffs, "isActive", a.getIsActive(), b.getIsActive());
        return diffs;
    }

    private void addFieldDiff(List<Map<String, Object>> diffs, String field, Object oldVal, Object newVal) {
        if (Objects.equals(oldVal, newVal)) return;
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("field", field);
        row.put("previousValue", oldVal);
        row.put("newValue", newVal);
        diffs.add(row);
    }

    // =====================================================================
    // Approval workflow
    // =====================================================================

    @Transactional
    public Boq submitForReview(Long id, User currentUser) {
        Boq boq = getBoqById(id);
        boq.setStatus("REVIEW");
        Boq saved = boqRepository.save(boq);
        logActivity(saved, "Submitted for Review", "BOQ submitted for review", currentUser);
        return saved;
    }

    @Transactional
    public Boq approveBoq(Long id, User currentUser) {
        Boq boq = getBoqById(id);
        boq.setStatus("APPROVED");
        boq.setApprovedBy(currentUser);
        boq.setApprovedDate(LocalDateTime.now());
        Boq saved = boqRepository.save(boq);
        reserveBoqMaterials(saved);
        logActivity(saved, "Approved", "BOQ approved", currentUser);
        notify("BOQ Approved", saved.getBoqNumber() + " has been approved.", saved, currentUser);
        workflowTriggerService.onBoqApproved(saved); // advance the lead workflow → Quotation tasks
        return saved;
    }

    @Transactional
    public Boq rejectBoq(Long id, String reason, User currentUser) {
        Boq boq = getBoqById(id);
        boolean wasApproved = "APPROVED".equals(boq.getStatus());
        boq.setStatus("REJECTED");
        boq.setRejectionReason(reason);
        Boq saved = boqRepository.save(boq);
        if (wasApproved) {
            releaseBoqMaterials(saved);
        }
        logActivity(saved, "Rejected", reason != null ? reason : "BOQ rejected", currentUser);
        notify("BOQ Rejected", saved.getBoqNumber() + " was rejected" + (reason != null ? ": " + reason : "") + ".", saved, currentUser);
        return saved;
    }

    /** Reserves stock for every catalog-linked material once the BOQ is approved, per the spec's "reserve on BOQ approval" rule. */
    private void reserveBoqMaterials(Boq boq) {
        for (BoqItem item : boq.getItems()) {
            for (BoqItemMaterial material : item.getMaterials()) {
                if (material.getProduct() == null) continue;
                int qty = reservableQuantity(material);
                if (qty <= 0) continue;
                inventoryService.reserveStock(material.getProduct().getId(), qty, "BOQ", boq.getId());
            }
        }
    }

    /** Symmetric release, used if an approved BOQ is later reverted (e.g. rejected after the fact). */
    private void releaseBoqMaterials(Boq boq) {
        for (BoqItem item : boq.getItems()) {
            for (BoqItemMaterial material : item.getMaterials()) {
                if (material.getProduct() == null) continue;
                int qty = reservableQuantity(material);
                if (qty <= 0) continue;
                inventoryService.releaseReservation(material.getProduct().getId(), qty, "BOQ", boq.getId());
            }
        }
    }

    private int reservableQuantity(BoqItemMaterial material) {
        BigDecimal qty = material.getFinalQuantity() != null ? material.getFinalQuantity() : material.getQuantity();
        return qty != null ? qty.setScale(0, RoundingMode.CEILING).intValue() : 0;
    }

    // =====================================================================
    // Integration: generate Quotation from a BOQ (full house / partial / budget)
    // =====================================================================

    @Transactional
    public Quotation generateQuotationFromBoq(Long id, String mode, List<Long> itemIds, BigDecimal budgetCap, User currentUser) {
        Boq boq = getBoqById(id);
        if (!"APPROVED".equals(boq.getStatus())) {
            throw new IllegalStateException("Only approved BOQs can be converted to a quotation.");
        }

        String resolvedMode = mode != null ? mode : "FULL_HOUSE";
        List<BoqItem> included = new ArrayList<>();

        if ("PARTIAL".equals(resolvedMode)) {
            for (BoqItem item : boq.getItems()) {
                boolean inIdList = itemIds != null && itemIds.contains(item.getId());
                boolean isSelected = (itemIds == null || itemIds.isEmpty()) && "SELECTED".equals(item.getStatus());
                if (inIdList || isSelected) included.add(item);
            }
        } else if ("BUDGET".equals(resolvedMode)) {
            BigDecimal running = BigDecimal.ZERO;
            BigDecimal cap = budgetCap != null ? budgetCap : BigDecimal.ZERO;
            for (BoqItem item : boq.getItems()) {
                if (!"PENDING".equals(item.getStatus()) && !"SELECTED".equals(item.getStatus())) continue;
                BigDecimal next = running.add(item.getAmount() != null ? item.getAmount() : BigDecimal.ZERO);
                if (next.compareTo(cap) <= 0) {
                    included.add(item);
                    running = next;
                }
            }
        } else {
            included.addAll(boq.getItems());
        }

        if (included.isEmpty()) {
            throw new IllegalStateException("No items matched the requested quotation scope.");
        }

        Quotation quotation = new Quotation();
        quotation.setCustomer(boq.getCustomer());
        quotation.setProject(boq.getProject());
        quotation.setMeasurement(boq.getMeasurement());
        quotation.setLead(boq.getLead());
        quotation.setSiteVisit(boq.getSiteVisit());
        quotation.setBoq(boq);
        quotation.setQuotationDate(java.time.LocalDate.now());
        quotation.setPreparedBy(currentUser);
        quotation.setQuotationMode(resolvedMode);
        if ("BUDGET".equals(resolvedMode)) quotation.setBudgetCap(budgetCap);

        List<QuotationItem> qItems = new ArrayList<>();
        for (BoqItem item : included) {
            QuotationItem qi = new QuotationItem();
            qi.setCategory(item.getCategory());
            qi.setItemName(item.getItemName());
            qi.setDescription(item.getDescription());
            qi.setUnit(item.getUnit());
            com.arudra.crm.service.QuotationService.copyBoqStructureToQuotationItem(item, qi);
            qi.setQuantity(item.getQuantity() != null ? item.getQuantity() : BigDecimal.ONE);
            BigDecimal totalAmount = item.getAmount() != null ? item.getAmount() : BigDecimal.ZERO;
            BigDecimal qty = qi.getQuantity() != null && qi.getQuantity().compareTo(BigDecimal.ZERO) != 0 ? qi.getQuantity() : BigDecimal.ONE;
            qi.setRate(totalAmount.divide(qty, 2, RoundingMode.HALF_UP));
            qi.setTotalAmount(totalAmount);
            qi.setCostAmount(totalAmount);
            qi.setBoqItemId(item.getId());
            qi.setStatus("PENDING");
            qItems.add(qi);
        }
        quotation.setItems(qItems);

        Quotation saved = quotationService.createQuotation(quotation, currentUser);

        for (BoqItem item : included) {
            item.setStatus("SELECTED");
        }
        boq.setQuotation(saved);
        boqRepository.save(boq);
        logActivity(boq, "Quotation Generated",
                "Quotation " + saved.getQuotationNumber() + " (" + resolvedMode + ") generated with " + included.size() + " item(s)",
                currentUser);
        return saved;
    }

    // =====================================================================
    // Reports
    // =====================================================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRoomWiseCost(Long boqId) {
        return groupItemCost(boqId, BoqItem::getRoomName, "room");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getFloorWiseCost(Long boqId) {
        return groupItemCost(boqId, BoqItem::getFloorName, "floor");
    }

    private List<Map<String, Object>> groupItemCost(Long boqId, java.util.function.Function<BoqItem, String> keyFn, String keyLabel) {
        Boq boq = getBoqById(boqId);
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        for (BoqItem item : boq.getItems()) {
            String key = keyFn.apply(item);
            if (key == null) key = "Unassigned";
            totals.merge(key, item.getAmount() != null ? item.getAmount() : BigDecimal.ZERO, BigDecimal::add);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : totals.entrySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put(keyLabel, entry.getKey());
            row.put("totalCost", entry.getValue());
            result.add(row);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMaterialConsumption(Long boqId) {
        Boq boq = getBoqById(boqId);
        Map<String, Map<String, Object>> rows = new LinkedHashMap<>();
        for (BoqItem item : boq.getItems()) {
            for (BoqItemMaterial m : item.getMaterials()) {
                String key = m.getMaterialName();
                Map<String, Object> row = rows.computeIfAbsent(key, k -> {
                    Map<String, Object> r = new LinkedHashMap<>();
                    r.put("materialName", key);
                    r.put("unit", m.getUnit());
                    r.put("totalQuantity", BigDecimal.ZERO);
                    r.put("totalAmount", BigDecimal.ZERO);
                    return r;
                });
                BigDecimal qty = (BigDecimal) row.get("totalQuantity");
                BigDecimal amt = (BigDecimal) row.get("totalAmount");
                row.put("totalQuantity", qty.add(m.getFinalQuantity() != null ? m.getFinalQuantity() : BigDecimal.ZERO));
                row.put("totalAmount", amt.add(m.getAmount() != null ? m.getAmount() : BigDecimal.ZERO));
            }
        }
        return new ArrayList<>(rows.values());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getInventoryRequirement(Long boqId) {
        Boq boq = getBoqById(boqId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (BoqItem item : boq.getItems()) {
            for (BoqItemMaterial m : item.getMaterials()) {
                if (m.getProduct() == null) continue;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("productId", m.getProduct().getId());
                row.put("materialName", m.getMaterialName());
                row.put("requiredQuantity", m.getFinalQuantity());
                row.put("availableStock", m.getAvailableStock());
                row.put("stockWarning", m.getStockWarning());
                result.add(row);
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getLabourCost(Long boqId) {
        Boq boq = getBoqById(boqId);
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        for (BoqItem item : boq.getItems()) {
            for (BoqItemLabour l : item.getLabours()) {
                String key = l.getWorkType() != null ? l.getWorkType() : "General";
                totals.merge(key, l.getAmount() != null ? l.getAmount() : BigDecimal.ZERO, BigDecimal::add);
            }
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : totals.entrySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("workType", entry.getKey());
            row.put("totalCost", entry.getValue());
            result.add(row);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getProfitReport(Long boqId) {
        Boq boq = getBoqById(boqId);
        BigDecimal cost = boq.getMaterialTotal().add(boq.getLabourTotal());
        BigDecimal sellingPrice = boq.getGrandTotal();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("costTotal", cost);
        result.put("sellingTotal", sellingPrice);
        result.put("profit", sellingPrice.subtract(cost));
        return result;
    }

    @Transactional(readOnly = true)
    public List<BoqItem> getPendingWork(Long boqId) {
        return boqItemRepository.findByBoqIdAndStatus(boqId, "PENDING");
    }

    @Transactional(readOnly = true)
    public List<BoqItem> getApprovedWork(Long boqId) {
        return boqItemRepository.findByBoqIdAndStatus(boqId, "APPROVED");
    }

    // =====================================================================
    // Dashboard
    // =====================================================================

    @Transactional(readOnly = true)
    public BoqDashboardDTO getDashboard() {
        BoqDashboardDTO dto = new BoqDashboardDTO();
        dto.setTotalBoqs(boqRepository.countByIsLatestVersionTrue());
        dto.setDraft(boqRepository.countByStatus("DRAFT"));
        dto.setPendingReview(boqRepository.countByStatus("REVIEW"));
        dto.setApproved(boqRepository.countByStatus("APPROVED"));
        dto.setRejected(boqRepository.countByStatus("REJECTED"));
        BigDecimal totalValue = boqRepository.sumTotalBoqValue();
        dto.setTotalBoqValue(totalValue != null ? totalValue : BigDecimal.ZERO);

        dto.setApprovedQuotations(quotationRepository.countByStatus("APPROVED"));
        dto.setPendingQuotations(quotationRepository.countByStatus("DRAFT") + quotationRepository.countByStatus("SENT"));
        dto.setPartialQuotations(quotationRepository.countByQuotationMode("PARTIAL"));
        dto.setRevisionCount(quotationRepository.countByRevisionNumberGreaterThan(0));
        BigDecimal approvedValue = quotationRepository.sumGrandTotalByStatus("APPROVED");
        dto.setApprovedValue(approvedValue != null ? approvedValue : BigDecimal.ZERO);
        BigDecimal pendingValue = quotationRepository.sumGrandTotalByStatus("DRAFT");
        dto.setPendingValue(pendingValue != null ? pendingValue : BigDecimal.ZERO);
        return dto;
    }

    // =====================================================================
    // Activity log
    // =====================================================================

    @Transactional(readOnly = true)
    public List<BoqActivityLog> getActivityLog(Long boqId) {
        return activityLogRepository.findByBoqIdOrderByActionTimeDesc(boqId);
    }

    /** Field-level edit history (Modified By/Date/Reason/Previous/New Value) for the "Editable BOQ" audit trail. */
    @Transactional(readOnly = true)
    public List<BoqChangeLog> getChangeLog(Long boqId) {
        return changeLogRepository.findByBoqIdOrderByModifiedDateDesc(boqId);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private void notify(String title, String message, Boq boq, User currentUser) {
        User recipient = boq.getCreatedByUser();
        if (recipient == null || (currentUser != null && recipient.getId().equals(currentUser.getId()))) {
            return;
        }
        notificationService.dispatch(title, message, "BOQ", recipient.getId(), "/boq/" + boq.getId());
    }

    /**
     * Locks an APPROVED BOQ against further edits — the "never overwrite an approved version" rule.
     * To keep editing, the caller must create a new DRAFT revision first (POST /{id}/revisions),
     * which the frontend's existing "New Revision" button already does.
     */
    private void ensureEditable(Boq boq) {
        if ("APPROVED".equals(boq.getStatus())) {
            throw new IllegalStateException("BOQ " + boq.getBoqNumber() + " is approved — create a new revision to edit it.");
        }
    }

    /** Writes one BoqChangeLog row per changed field; no-ops if the values are equal (nothing to log). */
    private void logChange(Boq boq, BoqItem item, BoqPhase phase, String changeType, String fieldName,
            Object oldVal, Object newVal, String reason, User currentUser) {
        if (Objects.equals(oldVal, newVal)) return;
        BoqChangeLog log = new BoqChangeLog();
        log.setBoq(boq);
        log.setBoqItem(item);
        log.setBoqPhase(phase);
        log.setChangeType(changeType);
        log.setFieldName(fieldName);
        log.setPreviousValue(oldVal != null ? oldVal.toString() : null);
        log.setNewValue(newVal != null ? newVal.toString() : null);
        log.setReason(reason);
        log.setModifiedBy(currentUser);
        log.setModifiedDate(LocalDateTime.now());
        log.setRevisionNumber(boq.getRevisionNumber());
        changeLogRepository.save(log);
    }

    private void logActivity(Boq boq, String actionType, String description, User currentUser) {
        BoqActivityLog log = new BoqActivityLog();
        log.setBoq(boq);
        log.setActionType(actionType);
        log.setDescription(description);
        log.setPerformedBy(currentUser != null ? currentUser.getName() : "System");
        log.setRole(currentUser != null && !currentUser.getRoles().isEmpty()
                ? currentUser.getRoles().iterator().next().getName() : null);
        log.setActionTime(LocalDateTime.now());
        activityLogRepository.save(log);
    }
}

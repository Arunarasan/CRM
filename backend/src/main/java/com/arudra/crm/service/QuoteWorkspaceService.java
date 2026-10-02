package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.BoqRepository;
import com.arudra.crm.repository.LeadRepository;
import com.arudra.crm.repository.MeasurementRepository;
import com.arudra.crm.repository.QuotationRepository;
import com.arudra.crm.util.MeasurementWorkflow;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Backend for the lead's combined "Measurement & Quotation" workspace. Measurement, BOQ and Quotation
 * stay separate records (project conversion, material requirements and progress tracking rely on
 * them) — this service just removes the hand-offs between them:
 * <ul>
 *   <li>{@link #startPricing}: opens the pricing sheet straight away, creating the measurement and the
 *       BOQ if they don't exist yet — no "complete the measurement first" gate.</li>
 *   <li>{@link #generateQuotation}: one step that finishes the measurement, approves the pricing and
 *       raises the quotation. The quotation's own approval (customer/internal) is unchanged.</li>
 *   <li>{@link #liveQuote} / {@link #customerApproval} / {@link #reopen}: the single combined Quote page.
 *       The sheet stays editable while a quotation mirrors it; the customer approves from the sheet
 *       (which then locks); a change after approval opens a new sheet and so a new quotation.</li>
 * </ul>
 */
@Service
public class QuoteWorkspaceService {

    private final LeadRepository leadRepository;
    private final MeasurementRepository measurementRepository;
    private final BoqRepository boqRepository;
    private final MeasurementService measurementService;
    private final BoqService boqService;
    private final QuotationService quotationService;
    private final QuotationRepository quotationRepository;
    private final LiveQuoteSync liveQuoteSync;

    public QuoteWorkspaceService(LeadRepository leadRepository, MeasurementRepository measurementRepository,
                                 BoqRepository boqRepository, MeasurementService measurementService,
                                 BoqService boqService, QuotationService quotationService,
                                 QuotationRepository quotationRepository, LiveQuoteSync liveQuoteSync) {
        this.leadRepository = leadRepository;
        this.measurementRepository = measurementRepository;
        this.boqRepository = boqRepository;
        this.measurementService = measurementService;
        this.boqService = boqService;
        this.quotationService = quotationService;
        this.quotationRepository = quotationRepository;
        this.liveQuoteSync = liveQuoteSync;
    }

    /**
     * The sheet's quotation, created on first use (PDF / send / approve) and otherwise brought up to
     * date with the sheet. The sheet is NOT approved or locked — it stays the place to keep editing.
     */
    @Transactional
    public Quotation liveQuote(Long boqId, User currentUser) {
        Boq boq = boqService.getBoqById(boqId);
        if (boq.getItems() == null || boq.getItems().stream().noneMatch(i -> !Boolean.FALSE.equals(i.getIsActive()))) {
            throw new IllegalStateException("Tick at least one item before making the quotation.");
        }
        Quotation live = liveQuoteSync.findLive(boqId);
        if (live != null) return quotationService.syncLiveFromBoq(live.getId(), boqId);
        if ("APPROVED".equals(boq.getStatus())) {
            throw new IllegalStateException("This price sheet was approved by the customer — make a new quotation to change it.");
        }
        Measurement measurement = boq.getMeasurement();
        if (measurement != null && !MeasurementWorkflow.COMPLETED.equals(measurement.getStatus())) {
            measurementService.autoComplete(measurement.getId(),
                    "Completed automatically — quotation made from " + boq.getBoqNumber(), currentUser);
        }
        Quotation created = boqService.createLiveQuotation(boqId, currentUser);
        return quotationService.syncLiveFromBoq(created.getId(), boqId);
    }

    /**
     * Customer approved what is ticked on the sheet: the quotation is synced one last time and approved
     * with every line, and the sheet is approved (locked, materials reserved).
     */
    @Transactional
    public Quotation customerApproval(Long boqId, User currentUser) {
        Quotation quote = liveQuote(boqId, currentUser);
        Boq boq = boqService.getBoqById(boqId);
        if (!"APPROVED".equals(boq.getStatus())) boqService.approveBoq(boqId, currentUser);
        List<Long> ids = quote.getItems().stream().map(QuotationItem::getId).filter(java.util.Objects::nonNull).toList();
        return quotationService.customerApprove(quote.getId(), ids, currentUser);
    }

    /**
     * A change after the customer approved (or on a sheet locked by the older flow): its quotation is marked REVISED and a new editable
     * sheet revision is opened — its quotation (made on next use) gets a new number. Not allowed once a
     * project exists.
     */
    @Transactional
    public Boq reopen(Long boqId, User currentUser) {
        for (Quotation q : quotationRepository.findByBoq_IdOrderByIdDesc(boqId)) {
            if ("CONVERTED".equals(q.getStatus())) {
                throw new IllegalStateException("A project was already created from this quotation, so it can't be changed here.");
            }
            // Approved quotes, and a still-open quote on an older locked sheet, are superseded by the new one.
            if ("APPROVED".equals(q.getStatus()) || QuotationService.isLive(q)) {
                q.setStatus("REVISED");
                quotationRepository.save(q);
            }
        }
        return boqService.createRevision(boqId, "Changed after customer approval", currentUser);
    }

    @Transactional
    public Map<String, Object> startPricing(Long leadId, User currentUser) {
        Lead lead = leadRepository.findById(leadId)
                .orElseThrow(() -> new ResourceNotFoundException("Lead not found with id: " + leadId));

        Measurement measurement = currentMeasurement(leadId);
        boolean measurementCreated = false;
        if (measurement == null) {
            Measurement m = new Measurement();
            m.setLead(lead);
            m.setPropertyType(lead.getPropertyType());
            m.setSiteAddress(lead.getAddress());
            m.setLocation(lead.getCity());
            m.setMeasurementDate(LocalDate.now());
            measurement = measurementService.createMeasurement(m, currentUser);
            measurementCreated = true;
        }
        // Pricing has started, so the measurement is being worked on.
        if (List.of(MeasurementWorkflow.DRAFT, MeasurementWorkflow.ASSIGNED, MeasurementWorkflow.ACCEPTED)
                .contains(measurement.getStatus())) {
            measurement = measurementService.startMeasurement(measurement.getId(), currentUser);
        }

        Boq boq = latestBoq(measurement.getId());
        boolean boqCreated = false;
        if (boq == null) {
            boq = boqService.createFromMeasurement(measurement.getId(), currentUser);
            boqCreated = true;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("measurementId", measurement.getId());
        result.put("boqId", boq.getId());
        result.put("measurementCreated", measurementCreated);
        result.put("boqCreated", boqCreated);
        return result;
    }

    @Transactional
    public Quotation generateQuotation(Long boqId, User currentUser) {
        Boq boq = boqService.getBoqById(boqId);
        if (boq.getItems() == null || boq.getItems().stream().noneMatch(i -> !Boolean.FALSE.equals(i.getIsActive()))) {
            throw new IllegalStateException("Add at least one item to the pricing before generating a quotation.");
        }
        Measurement measurement = boq.getMeasurement();
        if (measurement != null && !MeasurementWorkflow.COMPLETED.equals(measurement.getStatus())) {
            measurementService.autoComplete(measurement.getId(),
                    "Completed automatically — quotation generated from " + boq.getBoqNumber(), currentUser);
        }
        if (!"APPROVED".equals(boq.getStatus())) {
            boqService.approveBoq(boqId, currentUser);
        }
        return boqService.generateQuotationFromBoq(boqId, "FULL_HOUSE", null, null, currentUser);
    }

    /** The lead's working measurement: the latest non-deleted, latest-revision one. */
    private Measurement currentMeasurement(Long leadId) {
        return measurementRepository.findByLeadId(leadId).stream()
                .filter(m -> !Boolean.TRUE.equals(m.getIsDeleted()))
                .filter(m -> !MeasurementWorkflow.CANCELLED.equals(m.getStatus()))
                .filter(m -> !Boolean.FALSE.equals(m.getIsLatestRevision()))
                .max(Comparator.comparing(Measurement::getId))
                .orElse(null);
    }

    /** Latest revision in the measurement's BOQ family (revisions keep the measurement link). */
    private Boq latestBoq(Long measurementId) {
        return boqRepository.findByMeasurementIdAndIsDeletedFalseOrderByIdDesc(measurementId).stream()
                .filter(b -> !Boolean.FALSE.equals(b.getIsLatestVersion()))
                .findFirst()
                .orElse(null);
    }
}

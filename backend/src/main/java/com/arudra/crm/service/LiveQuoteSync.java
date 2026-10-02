package com.arudra.crm.service;

import com.arudra.crm.entity.Quotation;
import com.arudra.crm.repository.QuotationRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps a pricing sheet's live quotation identical to the sheet. BoqService calls {@link #sync} after
 * every committed sheet change (items, sizes, material/labour lines, discount, GST), so the quotation —
 * and anything that reads it: PDF, print, quotation lists — always shows what the sheet shows, until
 * the customer approves it. Runs in its own transaction; failures are logged by the caller.
 */
@Component
public class LiveQuoteSync {

    private final QuotationRepository quotationRepository;
    private final QuotationService quotationService;

    public LiveQuoteSync(QuotationRepository quotationRepository, @Lazy QuotationService quotationService) {
        this.quotationRepository = quotationRepository;
        this.quotationService = quotationService;
    }

    /** The newest still-live quotation raised from this sheet, if any. */
    @Transactional(readOnly = true)
    public Quotation findLive(Long boqId) {
        return quotationRepository.findByBoq_IdOrderByIdDesc(boqId).stream()
                .filter(QuotationService::isLive)
                .findFirst().orElse(null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sync(Long boqId) {
        Quotation live = findLive(boqId);
        if (live != null) quotationService.syncLiveFromBoq(live.getId(), boqId);
    }
}

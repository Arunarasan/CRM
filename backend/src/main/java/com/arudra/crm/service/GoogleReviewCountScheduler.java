package com.arudra.crm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Periodically reconciles the Google review count so pending QR reviews get auto-verified without
 * anyone clicking. No-op unless the Places API is configured. Runs every 30 minutes.
 */
@Component
public class GoogleReviewCountScheduler {

    private static final Logger log = LoggerFactory.getLogger(GoogleReviewCountScheduler.class);

    private final GoogleReviewCountService countService;

    public GoogleReviewCountScheduler(GoogleReviewCountService countService) {
        this.countService = countService;
    }

    @Scheduled(fixedDelay = 30 * 60_000, initialDelay = 2 * 60_000)
    public void sync() {
        if (!countService.isConfigured()) return;
        try {
            Map<String, Object> r = countService.reconcile();
            Object verified = r.get("autoVerified");
            if (verified instanceof Integer v && v > 0) {
                log.info("Google count sync: +{} review(s) → auto-verified {} pending", r.get("delta"), v);
            }
        } catch (Exception e) {
            log.warn("Scheduled Google review count sync failed", e);
        }
    }
}

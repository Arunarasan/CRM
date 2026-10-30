package com.arudra.crm.service;

import com.arudra.crm.entity.AttendanceSession;
import com.arudra.crm.repository.AttendanceSessionRepository;
import com.arudra.crm.storage.PrivateFileStore;
import com.arudra.crm.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Kiosk selfies are audit evidence, not records to keep forever: once a punch is older than
 * {@code app.kiosk.selfie-retention-days} (default 7) its photo is deleted from storage and the link
 * cleared. A punch still waiting for HR approval keeps its photo until HR decides. The attendance
 * itself (times, face distance, hours, pay) is untouched.
 */
@Component
public class KioskSelfieCleanup {

    private static final Logger log = LoggerFactory.getLogger(KioskSelfieCleanup.class);

    @Autowired private AttendanceSessionRepository sessionRepository;
    @Autowired private StorageService storageService;
    @Autowired private PrivateFileStore privateStore;
    @Value("${app.kiosk.selfie-retention-days:7}") private int retentionDays;

    @Scheduled(cron = "0 30 3 * * *")
    public void purgeOldSelfies() {
        if (retentionDays <= 0) return; // 0 = keep forever
        List<AttendanceSession> old = sessionRepository.findWithOldSelfies(LocalDate.now().minusDays(retentionDays));
        int files = 0;
        for (AttendanceSession s : old) {
            if (drop(s.getSelfieInUrl())) { s.setSelfieInUrl(null); files++; }
            if (drop(s.getSelfieOutUrl())) { s.setSelfieOutUrl(null); files++; }
            sessionRepository.save(s);
        }
        if (files > 0) log.info("Kiosk selfie cleanup: removed {} photos older than {} days", files, retentionDays);
    }

    /** True when the link can be cleared (the file is deleted, or is already gone). */
    private boolean drop(String url) {
        if (url == null) return false;
        try {
            if (PrivateFileStore.isPrivateUrl(url)) privateStore.delete(PrivateFileStore.keyFromUrl(url));
            else if (url.contains("/uploads/")) storageService.delete(url.substring(url.indexOf("/uploads/") + 9).split("[?#]")[0]);
            return true;
        } catch (Exception e) {
            log.warn("Kiosk selfie {} could not be deleted yet: {}", url, e.getMessage());
            return false; // keep the link so tomorrow's run retries
        }
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.SiteSetting;
import com.arudra.crm.repository.SiteSettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/**
 * Global on/off switch for the whole customer portal, stored as a {@code portal.enabled} row in
 * site_settings. When off, every portal request is rejected (503) — used for maintenance or to take
 * the portal offline for everyone. Defaults to enabled when the setting is absent.
 */
@Service
public class PortalPolicyService {

    public static final String KEY = "portal.enabled";

    private final SiteSettingRepository settingRepository;

    public PortalPolicyService(SiteSettingRepository settingRepository) {
        this.settingRepository = settingRepository;
    }

    @Transactional(readOnly = true)
    public boolean isEnabled() {
        return settingRepository.findBySettingKeyAndIsDeletedFalse(KEY)
                .map(s -> !"false".equalsIgnoreCase(s.getSettingValue()))
                .orElse(true);
    }

    /** Rejects the request with 503 when the portal is globally disabled. */
    public void assertEnabled() {
        if (!isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "The customer portal is temporarily unavailable. Please check back soon.");
        }
    }

    @Transactional
    public boolean setEnabled(boolean enabled) {
        SiteSetting s = settingRepository.findBySettingKeyAndIsDeletedFalse(KEY)
                .orElseGet(() -> {
                    SiteSetting n = new SiteSetting();
                    n.setSettingKey(KEY);
                    n.setGroupName("Portal");
                    n.setLabel("Customer portal enabled");
                    n.setInputType("text");
                    return n;
                });
        s.setSettingValue(enabled ? "true" : "false");
        settingRepository.save(s);
        return enabled;
    }
}

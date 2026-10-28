package com.arudra.crm.controller;

import com.arudra.crm.service.PayslipSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The printed payslip layout only (no schedule or pay lines) — any signed-in user, since employees print their own. */
@RestController
@RequestMapping("/api/payslip-template")
public class PayslipTemplateController {

    private final PayslipSettingsService settings;

    public PayslipTemplateController(PayslipSettingsService settings) {
        this.settings = settings;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PayslipSettingsService.Template> template() {
        return ResponseEntity.ok(settings.template());
    }
}

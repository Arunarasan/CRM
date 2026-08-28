package com.arudra.crm.service;

import com.arudra.crm.dto.website.WebsiteLeadRequest;
import com.arudra.crm.entity.Lead;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Turns a website contact/consultation submission into a CRM {@link Lead}, tagged with the website
 * source. Reuses {@link LeadService#createLead} (null acting user) so the full lead workflow —
 * numbering, admin notification, first task — fires exactly as for an internally-created lead.
 *
 * Duplicate handling and attaching to an existing authenticated customer are added in Phase 7.
 */
@Service
public class WebsiteLeadService {

    private final LeadService leadService;

    public WebsiteLeadService(LeadService leadService) {
        this.leadService = leadService;
    }

    public Lead createFromWebsite(WebsiteLeadRequest req, String source) {
        if (req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("Name is required.");
        }

        Lead lead = new Lead();
        lead.setName(req.name().trim());
        lead.setLeadSource(source);
        lead.setStatus("New");
        lead.setPriority("Medium");

        if (notBlank(req.phone())) lead.setMobileNumber(req.phone().trim());
        // Only set email when it looks like an address — the entity has an @Email constraint.
        if (notBlank(req.email()) && req.email().contains("@")) lead.setEmail(req.email().trim());
        if (notBlank(req.location())) lead.setCity(req.location().trim());
        if (notBlank(req.projectType())) lead.setRequirementCategory(req.projectType().trim());
        if (notBlank(req.propertyType())) lead.setPropertyType(req.propertyType().trim());
        lead.setAreaSqft(parseDecimal(req.area()));

        lead.setRemarks(buildRemarks(req));

        return leadService.createLead(lead, null);
    }

    private String buildRemarks(WebsiteLeadRequest req) {
        StringBuilder sb = new StringBuilder();
        if (notBlank(req.message())) sb.append(req.message().trim());
        if (notBlank(req.budget())) sb.append("\nBudget: ").append(req.budget().trim());
        if (notBlank(req.preferredDate())) sb.append("\nPreferred date: ").append(req.preferredDate().trim());
        if (notBlank(req.concept())) sb.append("\nDesign Studio concept: ").append(req.concept().trim());
        return sb.length() == 0 ? null : sb.toString();
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private BigDecimal parseDecimal(String s) {
        if (!notBlank(s)) return null;
        try {
            return new BigDecimal(s.trim().replaceAll("[^0-9.]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

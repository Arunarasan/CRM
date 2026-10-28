package com.arudra.crm.service;

import com.arudra.crm.entity.Lead;
import com.arudra.crm.entity.User;

import java.util.stream.Collectors;

/**
 * Who may edit a lead's quote. Once an admin (or the assign screen) names lead managers, only those people
 * and admins may; a lead with no manager keeps the old open behaviour.
 */
public final class LeadQuoteAccess {

    private LeadQuoteAccess() {}

    public static boolean isAdmin(User u) {
        return u != null && u.getRoles() != null && u.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
    }

    public static boolean isManager(Lead lead, User u) {
        return lead != null && u != null && lead.getLeadManagers().stream().anyMatch(m -> m.getId().equals(u.getId()));
    }

    public static boolean canEdit(Lead lead, User u) {
        if (lead == null || lead.getLeadManagers().isEmpty() || u == null) return true; // no manager, or a system job
        return isAdmin(u) || isManager(lead, u);
    }

    public static void require(Lead lead, User u) {
        if (!canEdit(lead, u)) {
            String names = lead.getLeadManagers().stream().map(User::getName).collect(Collectors.joining(", "));
            throw new IllegalStateException("Only the lead manager (" + names + ") or an admin can edit this lead's quote.");
        }
    }
}

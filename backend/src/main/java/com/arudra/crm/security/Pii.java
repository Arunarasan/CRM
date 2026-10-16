package com.arudra.crm.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;

/**
 * Masking rules for identity/bank numbers (Aadhaar, PAN, bank account, IFSC) — DPDP Act data
 * minimisation. API responses show "••••••1234" unless the caller pays people (admin, payroll,
 * finance). A masked value sent back by an edit form never overwrites the real one ({@link #keep}).
 */
public final class Pii {

    private static final char BULLET = '•';
    private static final Set<String> REVEAL = Set.of(
            "ROLE_ADMIN", "ROLE_ACCOUNTS", "ROLE_FINANCE_MANAGER",
            "PAYROLL_READ", "PAYROLL_PROCESS", "FINANCE_READ", "FINANCE_WRITE");

    private Pii() {}

    /** "ABCDE1234F" → "••••••234F": only the last four characters stay visible. */
    public static String mask(String value) {
        if (value == null || value.isEmpty()) return value;
        String v = value.trim();
        int keep = Math.min(4, Math.max(0, v.length() - 4));
        return String.valueOf(BULLET).repeat(Math.max(4, v.length() - keep)) + v.substring(v.length() - keep);
    }

    public static boolean isMasked(String value) {
        return value != null && value.indexOf(BULLET) >= 0;
    }

    /** For entity setters: a masked value means "unchanged", so the current value is kept. */
    public static String keep(String incoming, String current) {
        return isMasked(incoming) && current != null ? current : incoming;
    }

    /** True when the signed-in caller may see full numbers. */
    public static boolean callerMayReveal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        for (GrantedAuthority a : auth.getAuthorities()) {
            if (REVEAL.contains(a.getAuthority())) return true;
        }
        return false;
    }
}

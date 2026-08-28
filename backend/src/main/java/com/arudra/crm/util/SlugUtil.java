package com.arudra.crm.util;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Generates URL-safe slugs for website catalog entities (products, services, portfolio…).
 * Used by the CMS admin layer when a slug is not supplied; uniqueness is enforced by the
 * caller against the relevant repository.
 */
public final class SlugUtil {

    private SlugUtil() {}

    public static String toSlug(String input) {
        if (input == null || input.isBlank()) return "";
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return normalized.toLowerCase(Locale.ENGLISH)
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("[\\s-]+", "-")
                .replaceAll("^-|-$", "");
    }
}

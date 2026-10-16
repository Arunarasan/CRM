package com.arudra.crm.security;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Set;

/** One password rule for every place a password is set, plus a secure temporary-password generator. */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 10;

    // The most-used passwords that still clear the length rule (plus this app's old default).
    private static final Set<String> COMMON = Set.of(
            "password123", "password1234", "password12", "passw0rd123", "1234567890", "12345678910",
            "0123456789", "9876543210", "1111111111", "0000000000", "1234512345", "qwertyuiop",
            "qwerty1234", "qwerty12345", "asdfghjkl1", "iloveyou123", "welcome123", "welcome@123",
            "admin12345", "admin@1234", "administrator", "letmein123", "abc1234567", "abcd123456",
            "changeme123", "password@123", "password!23", "p@ssword123", "india12345", "arudra1234",
            "arudra@123", "jbdecor123", "employee123", "default123", "login12345", "secret1234");

    private static final String TEMP_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordPolicy() {}

    /** Returns a user-facing reason the password is not allowed, or null when it is fine. */
    public static String validate(String password, String email) {
        if (password == null || password.length() < MIN_LENGTH) {
            return "Password must be at least " + MIN_LENGTH + " characters.";
        }
        String lower = password.toLowerCase(Locale.ROOT);
        if (COMMON.contains(lower) || lower.chars().distinct().count() < 4) {
            return "This password is too common or easy to guess. Choose a different one.";
        }
        if (email != null && !email.isBlank()) {
            String local = email.toLowerCase(Locale.ROOT).split("@")[0];
            if (lower.equals(email.toLowerCase(Locale.ROOT)) || (local.length() >= 4 && lower.contains(local))) {
                return "Password must not contain your email address.";
            }
        }
        return null;
    }

    /** Random 14-character temporary password (no look-alike characters). */
    public static String generateTemporary() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 14; i++) sb.append(TEMP_CHARS.charAt(RANDOM.nextInt(TEMP_CHARS.length())));
        return sb.toString();
    }
}

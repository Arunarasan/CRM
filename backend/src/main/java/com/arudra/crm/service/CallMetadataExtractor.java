package com.arudra.crm.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the caller's number, the call date/time, the direction and (sometimes) the contact name out
 * of a phone call-recording file name. Android dialers and recorder apps name files in a handful of
 * shapes, e.g.
 * <pre>
 *   Call@+919876543210_20261004_143022.m4a        (Call recorder apps)
 *   Call recording Roshan_241004_143022.m4a       (Samsung: contact name, yyMMdd_HHmmss)
 *   +91 98765 43210_20261004143022.amr            (MIUI / OnePlus)
 *   9876543210-2026-10-04-14-30-22.mp3
 *   Roshan (9876543210) - 04-10-2026 14-30.m4a
 * </pre>
 * Anything not found is left null — the admin fills it in on screen.
 */
public final class CallMetadataExtractor {

    private CallMetadataExtractor() {}

    public record CallMeta(String phoneNumber, LocalDateTime calledAt, String direction, String contactName) {}

    // Indian mobile with optional country code / leading 0, and any other +international number.
    private static final List<Pattern> PHONE = List.of(
            Pattern.compile("(?<!\\d)(?:\\+?91[\\s-]?|0)?([6-9]\\d{4}[\\s-]?\\d{5})(?!\\d)"),
            Pattern.compile("(?<!\\d)(\\+\\d{10,13})(?!\\d)"));

    // yyyyMMdd[sep]HHmm[ss] and yyyy-MM-dd[sep]HH-mm[-ss]
    private static final Pattern YMD = Pattern.compile(
            "(?<!\\d)(20\\d{2})[-_.]?(\\d{2})[-_.]?(\\d{2})[\\sT_.\\-]*(\\d{2})[-_.:]?(\\d{2})(?:[-_.:]?(\\d{2}))?(?!\\d)");
    // dd-MM-yyyy[sep]HH-mm[-ss]
    private static final Pattern DMY = Pattern.compile(
            "(?<!\\d)(\\d{2})[-_.](\\d{2})[-_.](20\\d{2})[\\s_\\-]+(\\d{2})[-_.:](\\d{2})(?:[-_.:](\\d{2}))?(?!\\d)");
    // Samsung yyMMdd_HHmmss
    private static final Pattern YYMMDD = Pattern.compile(
            "(?<!\\d)(\\d{2})(\\d{2})(\\d{2})[_\\-](\\d{2})(\\d{2})(\\d{2})(?!\\d)");
    // 10 digits with no separators: ddMMyyHHmm (Realme / OPPO / OnePlus "number-2009261923") or yyMMddHHmm
    private static final Pattern TEN = Pattern.compile("(?<!\\d)(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})(?!\\d)");
    // Date only, no time
    private static final Pattern DATE_ONLY = Pattern.compile("(?<!\\d)(20\\d{2})[-_.]?(\\d{2})[-_.]?(\\d{2})(?!\\d)");

    private static final Pattern NOISE = Pattern.compile(
            "(?i)\\b(call(s)?|recording(s)?|record|rec|audio|voice|incoming|outgoing|missed|in|out|phone|aud)\\b");

    public static CallMeta parse(String fileName) {
        if (fileName == null) return new CallMeta(null, null, null, null);
        String base = fileName.contains(".") ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
        String rest = base;

        LocalDateTime when = null;
        for (Pattern p : List.of(YMD, DMY, YYMMDD)) {
            Matcher m = p.matcher(rest);
            while (m.find()) {
                LocalDateTime t = toDateTime(p, m);
                if (t != null) {
                    when = t;
                    rest = rest.substring(0, m.start()) + " " + rest.substring(m.end());
                    break;
                }
            }
            if (when != null) break;
        }
        if (when == null) {
            Matcher m = TEN.matcher(rest);
            while (m.find()) {
                // Both readings can be valid dates — take the more recent one (calls are recent).
                LocalDateTime dmy = safe(2000 + i(m, 3), i(m, 2), i(m, 1), i(m, 4), i(m, 5), 0);
                LocalDateTime ymd = safe(2000 + i(m, 1), i(m, 2), i(m, 3), i(m, 4), i(m, 5), 0);
                LocalDateTime t = dmy == null ? ymd : ymd == null ? dmy : (dmy.isAfter(ymd) ? dmy : ymd);
                if (t != null) {
                    when = t;
                    rest = rest.substring(0, m.start()) + " " + rest.substring(m.end());
                    break;
                }
            }
        }
        if (when == null) {
            Matcher m = DATE_ONLY.matcher(rest);
            if (m.find()) {
                when = safe(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)), 0, 0, 0);
                if (when != null) rest = rest.substring(0, m.start()) + " " + rest.substring(m.end());
            }
        }

        String phone = null;
        for (Pattern p : PHONE) {
            Matcher m = p.matcher(rest);
            if (m.find()) {
                phone = normalizePhone(m.group());
                rest = rest.substring(0, m.start()) + " " + rest.substring(m.end());
                break;
            }
        }

        String lower = base.toLowerCase(Locale.ROOT);
        String direction = lower.matches(".*(incoming|\\bin\\b|[_\\-]in[_\\-]).*") ? "IN"
                : lower.matches(".*(outgoing|\\bout\\b|[_\\-]out[_\\-]).*") ? "OUT" : null;

        String name = NOISE.matcher(rest.replaceAll("[_@#()\\[\\]+\\-.,]", " ")).replaceAll(" ")
                .replaceAll("\\d+", " ").replaceAll("\\s+", " ").trim();
        if (name.length() < 2 || name.length() > 60 || !name.matches(".*\\p{L}.*")) name = null;

        return new CallMeta(phone, when, direction, name);
    }

    /** +91XXXXXXXXXX for Indian mobiles; other numbers keep their leading + and digits. */
    public static String normalizePhone(String raw) {
        if (raw == null) return null;
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() == 10) return "+91" + digits;
        if (digits.length() == 11 && digits.startsWith("0")) return "+91" + digits.substring(1);
        if (digits.length() == 12 && digits.startsWith("91")) return "+" + digits;
        if (digits.length() < 6) return null;
        return raw.trim().startsWith("+") ? "+" + digits : digits;
    }

    /** Last 10 digits, used to match a number against leads stored in any format. */
    public static String last10(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        return digits.length() >= 10 ? digits.substring(digits.length() - 10) : null;
    }

    private static LocalDateTime toDateTime(Pattern p, Matcher m) {
        int sec = m.group(6) != null ? Integer.parseInt(m.group(6)) : 0;
        if (p == YMD) {
            return safe(i(m, 1), i(m, 2), i(m, 3), i(m, 4), i(m, 5), sec);
        }
        if (p == DMY) {
            return safe(i(m, 3), i(m, 2), i(m, 1), i(m, 4), i(m, 5), sec);
        }
        return safe(2000 + i(m, 1), i(m, 2), i(m, 3), i(m, 4), i(m, 5), sec);
    }

    private static int i(Matcher m, int g) {
        return Integer.parseInt(m.group(g));
    }

    private static LocalDateTime safe(int y, int mo, int d, int h, int mi, int s) {
        if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
        try {
            LocalDateTime t = LocalDateTime.of(y, mo, d, h, mi, s);
            return t.isAfter(LocalDateTime.now().plusDays(1)) ? null : t;
        } catch (java.time.DateTimeException e) {
            return null;
        }
    }
}

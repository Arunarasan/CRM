package com.arudra.crm.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Parses the text a ZKTeco / eSSL machine pushes over the ADMS ("iclock") protocol.
 *
 * An ATTLOG upload is one punch per line, tab-separated:
 * <pre>PIN  yyyy-MM-dd HH:mm:ss  status  verify  workcode  reserved...</pre>
 * Firmware varies: trailing fields may be missing, separators may be runs of spaces, line endings may
 * be CRLF. Lines that can't be read are skipped (and counted) rather than failing the whole batch,
 * so one odd line never makes the machine resend everything.
 */
public final class AdmsParser {

    private AdmsParser() {}

    public record Punch(String pin, LocalDateTime time, Integer status, Integer verify, String workCode, String rawLine) {}

    public record Result(List<Punch> punches, int skippedLines) {}

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern PIN = Pattern.compile("^[A-Za-z0-9]{1,20}$");

    /** Parses an ATTLOG body. Never throws; unreadable lines are counted in {@link Result#skippedLines()}. */
    public static Result parseAttLog(String body) {
        List<Punch> out = new ArrayList<>();
        int skipped = 0;
        if (body == null || body.isBlank()) return new Result(out, 0);
        for (String raw : body.split("\\r?\\n|\\r")) {
            String line = raw.strip();
            if (line.isEmpty()) continue;
            Punch p = parseLine(line);
            if (p == null) skipped++;
            else out.add(p);
        }
        return new Result(out, skipped);
    }

    static Punch parseLine(String line) {
        String[] f = line.contains("\t") ? line.split("\t") : splitSpaces(line);
        if (f.length < 2) return null;
        String pin = f[0].trim();
        if (!PIN.matcher(pin).matches()) return null;
        LocalDateTime time;
        try {
            time = LocalDateTime.parse(f[1].trim(), TIME);
        } catch (DateTimeParseException e) {
            return null;
        }
        Integer status = f.length > 2 ? intOrNull(f[2]) : null;
        Integer verify = f.length > 3 ? intOrNull(f[3]) : null;
        String work = f.length > 4 ? blankToNull(f[4]) : null;
        String rawLine = line.length() > 255 ? line.substring(0, 255) : line;
        return new Punch(pin, time, status, verify, work, rawLine);
    }

    /** "1023 2026-10-09 09:02:11 0 1" — rejoin the date and time that a space split tore apart. */
    private static String[] splitSpaces(String line) {
        String[] parts = line.trim().split("\\s+");
        if (parts.length < 3) return parts;
        List<String> f = new ArrayList<>();
        f.add(parts[0]);
        f.add(parts[1] + " " + parts[2]);
        for (int i = 3; i < parts.length; i++) f.add(parts[i]);
        return f.toArray(new String[0]);
    }

    /** Number of non-blank lines — what the machine expects acknowledged for tables we only log. */
    public static int countLines(String body) {
        if (body == null || body.isBlank()) return 0;
        int n = 0;
        for (String l : body.split("\\r?\\n|\\r")) if (!l.isBlank()) n++;
        return n;
    }

    private static Integer intOrNull(String s) {
        try {
            return s == null || s.isBlank() ? null : Integer.valueOf(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : (s.trim().length() > 20 ? s.trim().substring(0, 20) : s.trim());
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.AttendanceShift;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pure shift arithmetic for biometric attendance — no I/O, so it is unit-tested directly.
 *
 * Rules (all minutes):
 *   late           = check-in − (shift start + grace), floored at 0.
 *                    e.g. start 09:00, grace 15, check-in 09:23 ⇒ late 8.
 *   early departure= shift end − check-out, floored at 0.
 *   working        = gross time between check-in and check-out (summed across the day's sessions).
 *   unpaid break   = the shift break, deducted only on a day of at least the half-day threshold.
 *   overtime       = (working − unpaid break) − shift net working minutes, floored at 0, when enabled.
 *   status         = HALF_DAY below the half-day threshold, else LATE when late, else PRESENT.
 * A shift whose end is not after its start runs overnight (its end is on the next day).
 */
public final class AttendanceShiftCalculator {

    public static final String PRESENT = "PRESENT";
    public static final String LATE = "LATE";
    public static final String HALF_DAY = "HALF_DAY";

    private AttendanceShiftCalculator() {}

    /** The subset of a shift the arithmetic needs; null-safe defaults. */
    public record ShiftSpec(LocalTime start, LocalTime end, int graceMinutes, int breakMinutes,
                            int netWorkingMinutes, boolean overtimeEnabled, int halfDayThresholdMinutes) {

        public static ShiftSpec of(AttendanceShift s) {
            if (s == null) return null;
            int span = spanMinutes(s.getStartTime(), s.getEndTime());
            int brk = nz(s.getBreakMinutes());
            int net = s.getWorkingHours() != null
                    ? s.getWorkingHours().multiply(java.math.BigDecimal.valueOf(60)).intValue()
                    : Math.max(0, span - brk);
            return new ShiftSpec(s.getStartTime(), s.getEndTime(), nz(s.getGracePeriodMinutes()), brk, net,
                    !Boolean.FALSE.equals(s.getOvertimeEnabled()),
                    s.getHalfDayThresholdMinutes() == null ? 240 : s.getHalfDayThresholdMinutes());
        }

        public boolean overnight() {
            return !end.isAfter(start);
        }

        public LocalDateTime startOn(LocalDate date) {
            return date.atTime(start);
        }

        public LocalDateTime endOn(LocalDate date) {
            return overnight() ? date.plusDays(1).atTime(end) : date.atTime(end);
        }
    }

    public record Figures(int workingMinutes, int lateMinutes, int earlyDepartureMinutes, int overtimeMinutes,
                          int unpaidBreakMinutes, String status) {}

    /** Gross minutes of a shift's span, wrapping past midnight. */
    public static int spanMinutes(LocalTime start, LocalTime end) {
        if (start == null || end == null) return 0;
        long m = Duration.between(start, end).toMinutes();
        return (int) (m <= 0 ? m + 24 * 60 : m);
    }

    /** Net working hours (span − break) for storing on the shift, in hours with two decimals. */
    public static java.math.BigDecimal netWorkingHours(LocalTime start, LocalTime end, int breakMinutes) {
        int net = Math.max(0, spanMinutes(start, end) - Math.max(0, breakMinutes));
        return java.math.BigDecimal.valueOf(net).divide(java.math.BigDecimal.valueOf(60), 2, java.math.RoundingMode.HALF_UP);
    }

    public static int lateMinutes(ShiftSpec shift, LocalDate attendanceDate, LocalDateTime checkIn) {
        if (shift == null || checkIn == null) return 0;
        LocalDateTime allowed = shift.startOn(attendanceDate).plusMinutes(shift.graceMinutes());
        return (int) Math.max(0, Duration.between(allowed, checkIn).toMinutes());
    }

    public static String checkInStatus(ShiftSpec shift, LocalDate attendanceDate, LocalDateTime checkIn) {
        return lateMinutes(shift, attendanceDate, checkIn) > 0 ? LATE : PRESENT;
    }

    /**
     * Figures for a completed day.
     *
     * @param firstCheckIn      the day's first check-in
     * @param lastCheckOut      the day's last check-out
     * @param grossWorkedMinutes worked minutes summed across sessions (== span for a single session)
     */
    public static Figures complete(ShiftSpec shift, LocalDate attendanceDate, LocalDateTime firstCheckIn,
                                   LocalDateTime lastCheckOut, int grossWorkedMinutes) {
        int working = Math.max(0, grossWorkedMinutes);
        if (shift == null) {
            return new Figures(working, 0, 0, 0, 0, PRESENT);
        }
        int late = lateMinutes(shift, attendanceDate, firstCheckIn);
        int early = lastCheckOut == null ? 0
                : (int) Math.max(0, Duration.between(lastCheckOut, shift.endOn(attendanceDate)).toMinutes());
        boolean halfDay = working < shift.halfDayThresholdMinutes();
        int unpaidBreak = halfDay ? 0 : Math.min(shift.breakMinutes(), working);
        int net = working - unpaidBreak;
        int overtime = shift.overtimeEnabled() ? Math.max(0, net - shift.netWorkingMinutes()) : 0;
        String status = halfDay ? HALF_DAY : late > 0 ? LATE : PRESENT;
        return new Figures(working, late, early, overtime, unpaidBreak, status);
    }

    /** Minutes between two times-of-day where an end before the start means the next day. */
    public static int minutesBetween(LocalTime in, LocalTime out) {
        if (in == null || out == null) return 0;
        long m = Duration.between(in, out).toMinutes();
        return (int) (m < 0 ? m + 24 * 60 : m);
    }

    public static Set<DayOfWeek> weekOffDays(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        return Arrays.stream(csv.split(","))
                .map(s -> s.trim().toUpperCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try { return DayOfWeek.valueOf(s); } catch (IllegalArgumentException e) { return null; }
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toUnmodifiableSet());
    }

    public static boolean isWeekOff(AttendanceShift shift, LocalDate date) {
        String days = shift == null ? "SUNDAY" : shift.getWeekOffDays();
        return weekOffDays(days).contains(date.getDayOfWeek());
    }

    /** "8h 57m" style label. */
    public static String formatMinutes(Integer minutes) {
        if (minutes == null) return "—";
        int m = Math.max(0, minutes);
        return (m / 60) + "h " + (m % 60) + "m";
    }

    private static int nz(Integer v) { return v == null ? 0 : v; }
}

package com.arudra.crm.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * Pure pairing logic for fingerprint-machine punches — no database, so every rule is unit-tested.
 *
 * Given one employee's punches (sorted, in server-local time) it plans the attendance sessions for a
 * range of days:
 * <ul>
 *   <li><b>Double taps</b> — a punch within {@code duplicateTapSeconds} of the previous kept punch is dropped.</li>
 *   <li><b>Pairing</b> — per day, in → out → in → out… by default; or by the machine's In/Out keys when
 *       every punch that day came from a machine set to use them (an out with nothing open is ignored).</li>
 *   <li><b>Night shift</b> — a day ending with an open clock-in is closed by the next day's first punch
 *       when it comes within {@code maxShiftHours} and before noon. The session is split at midnight
 *       (in → 23:59:59 on the first day, 00:00 → out on the next) because sessions are per-day.</li>
 *   <li><b>Missing clock-out</b> — an open clock-in on a past day is planned as an open, flagged session;
 *       on today it's simply "still at work".</li>
 * </ul>
 */
public final class MachinePairingPlanner {

    private MachinePairingPlanner() {}

    /** A punch as the planner sees it. {@code id} links back to the stored punch. */
    public record P(long id, LocalDateTime time, Integer status, boolean useKeys) {}

    /** One planned session on {@code day}. {@code out == null} means open (still in, or missing clock-out). */
    public record SessionPlan(LocalDate day, LocalTime in, LocalTime out, P inPunch, P outPunch,
                              boolean missingOut, boolean fromPreviousDay, boolean toNextDay) {}

    public enum Outcome { USED, DUPLICATE_TAP, IGNORED }

    public record Plan(Map<LocalDate, List<SessionPlan>> sessions, Map<Long, Outcome> outcomes) {}

    static final LocalTime END_OF_DAY = LocalTime.of(23, 59, 59);
    static final LocalTime NIGHT_CLOSE_BEFORE = LocalTime.NOON;

    private record Pair(P in, P out) {}

    private record Paired(List<Pair> pairs, List<P> orphans) {
        P openIn() {
            if (pairs.isEmpty()) return null;
            Pair last = pairs.get(pairs.size() - 1);
            return last.out() == null ? last.in() : null;
        }
    }

    /**
     * Plans sessions for every day in {@code [from, to]}. {@code punches} should cover at least two days
     * either side so night shifts and double taps at the edges are judged correctly.
     */
    public static Plan plan(List<P> punches, LocalDate from, LocalDate to, LocalDate today,
                            int duplicateTapSeconds, int maxShiftHours) {
        Map<Long, Outcome> outcomes = new HashMap<>();

        // 1) Drop double taps.
        List<P> sorted = new ArrayList<>(punches);
        sorted.sort(Comparator.comparing(P::time).thenComparing(P::id));
        List<P> kept = new ArrayList<>();
        for (P p : sorted) {
            if (!kept.isEmpty() && Duration.between(kept.get(kept.size() - 1).time(), p.time()).getSeconds() < duplicateTapSeconds) {
                outcomes.put(p.id(), Outcome.DUPLICATE_TAP);
            } else {
                kept.add(p);
            }
        }

        // 2) Group by day.
        TreeMap<LocalDate, List<P>> byDay = new TreeMap<>();
        for (P p : kept) byDay.computeIfAbsent(p.time().toLocalDate(), d -> new ArrayList<>()).add(p);

        // 3) Walk days in order, deciding whether each day's first punch closes yesterday's open shift.
        LocalDate start = from.minusDays(1);
        LocalDate end = to.plusDays(1);
        Map<LocalDate, List<P>> own = new HashMap<>();
        Map<LocalDate, Paired> paired = new HashMap<>();
        Map<LocalDate, P> borrowed = new HashMap<>(); // day -> its first punch, used as yesterday's out

        LocalDate seed = start.minusDays(1);
        own.put(seed, byDay.getOrDefault(seed, List.of()));
        paired.put(seed, pair(own.get(seed)));
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            List<P> todays = byDay.getOrDefault(d, List.of());
            P prevOpen = paired.get(d.minusDays(1)).openIn();
            List<P> mine = todays;
            if (prevOpen != null && !todays.isEmpty()) {
                P first = todays.get(0);
                boolean closesShift = Duration.between(prevOpen.time(), first.time()).compareTo(Duration.ofHours(maxShiftHours)) <= 0
                        && first.time().toLocalTime().isBefore(NIGHT_CLOSE_BEFORE)
                        && (!first.useKeys() || isOut(first.status()));
                if (closesShift) {
                    borrowed.put(d, first);
                    mine = todays.subList(1, todays.size());
                }
            }
            own.put(d, mine);
            paired.put(d, pair(mine));
        }

        // 4) Turn each requested day into sessions.
        Map<LocalDate, List<SessionPlan>> out = new TreeMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            List<SessionPlan> list = new ArrayList<>();
            P carriedOut = borrowed.get(d);
            if (carriedOut != null) {
                P carriedIn = paired.get(d.minusDays(1)).openIn();
                list.add(new SessionPlan(d, LocalTime.MIDNIGHT, carriedOut.time().toLocalTime(), carriedIn, carriedOut, false, true, false));
                outcomes.put(carriedOut.id(), Outcome.USED);
            }
            Paired pd = paired.get(d);
            for (P o : pd.orphans()) outcomes.put(o.id(), Outcome.IGNORED);
            P closer = borrowed.get(d.plusDays(1));
            for (Pair pr : pd.pairs()) {
                outcomes.put(pr.in().id(), Outcome.USED);
                if (pr.out() != null) {
                    outcomes.put(pr.out().id(), Outcome.USED);
                    list.add(new SessionPlan(d, pr.in().time().toLocalTime(), pr.out().time().toLocalTime(), pr.in(), pr.out(), false, false, false));
                } else {
                    boolean last = pr == pd.pairs().get(pd.pairs().size() - 1);
                    if (last && closer != null) {
                        list.add(new SessionPlan(d, pr.in().time().toLocalTime(), END_OF_DAY, pr.in(), closer, false, false, true));
                    } else {
                        // Only the day's last clock-in can still be "at work" (and only today); any other open one was never closed.
                        list.add(new SessionPlan(d, pr.in().time().toLocalTime(), null, pr.in(), null, !last || d.isBefore(today), false, false));
                    }
                }
            }
            list.sort(Comparator.comparing(SessionPlan::in));
            out.put(d, list);
        }
        return new Plan(out, outcomes);
    }

    /** Pairs one day's punches. Uses In/Out keys only when every punch that day came from a key-trusting machine. */
    private static Paired pair(List<P> day) {
        List<Pair> pairs = new ArrayList<>();
        List<P> orphans = new ArrayList<>();
        boolean keys = !day.isEmpty() && day.stream().allMatch(P::useKeys);
        P open = null;
        for (P p : day) {
            boolean isIn = keys && p.status() != null ? isIn(p.status()) : open == null;
            if (isIn) {
                if (open != null) pairs.add(new Pair(open, null)); // keys mode: a second "in" — the first never got its out
                open = p;
            } else if (open != null) {
                pairs.add(new Pair(open, p));
                open = null;
            } else {
                orphans.add(p); // keys mode: an "out" with nothing open
            }
        }
        if (open != null) pairs.add(new Pair(open, null));
        return new Paired(pairs, orphans);
    }

    /** Machine status codes: 0 in, 1 out, 2 break-out, 3 break-in, 4 overtime-in, 5 overtime-out. */
    static boolean isIn(Integer status) {
        return status != null && (status == 0 || status == 3 || status == 4);
    }

    static boolean isOut(Integer status) {
        return status != null && (status == 1 || status == 2 || status == 5);
    }
}

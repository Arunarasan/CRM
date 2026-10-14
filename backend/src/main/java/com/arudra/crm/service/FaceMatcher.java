package com.arudra.crm.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 1:N face identification on 128-number descriptors. Pure maths, no Spring, so it is easy to test.
 *
 * Each employee scores as the closest of their enrolled samples. The kiosk then decides on the
 * single best employee: close enough to trust ({@link #CONFIDENT_MAX}), close enough to accept but
 * flag for HR ({@link #ACCEPT_MAX}), or not recognised. If the runner-up is almost as close, the
 * result is "ambiguous" instead of guessing between two people.
 */
public final class FaceMatcher {

    /** At or below this the match is trusted outright. */
    public static final double CONFIDENT_MAX = 0.42;
    /** Above CONFIDENT_MAX and at or below this the punch is accepted but flagged for HR. */
    public static final double ACCEPT_MAX = 0.50;
    /** If a different employee is within this much of the best, refuse rather than guess. */
    public static final double AMBIGUITY_MARGIN = 0.04;

    private FaceMatcher() {}

    public enum Verdict { CONFIDENT, WEAK, NOT_RECOGNISED, AMBIGUOUS }

    /** A sample owned by an employee. */
    public record Sample(long employeeId, double[] descriptor) {}

    public record Result(Verdict verdict, Long employeeId, double distance) {
        public boolean matched() {
            return verdict == Verdict.CONFIDENT || verdict == Verdict.WEAK;
        }
    }

    public static Result identify(double[] live, List<Sample> samples) {
        Map<Long, Double> best = new HashMap<>();
        for (Sample s : samples) {
            if (s.descriptor() == null || s.descriptor().length != live.length) continue;
            best.merge(s.employeeId(), distance(live, s.descriptor()), Math::min);
        }
        if (best.isEmpty()) return new Result(Verdict.NOT_RECOGNISED, null, Double.NaN);

        long bestId = -1;
        double bestDist = Double.MAX_VALUE;
        double secondDist = Double.MAX_VALUE;
        for (Map.Entry<Long, Double> e : best.entrySet()) {
            double d = e.getValue();
            if (d < bestDist) {
                secondDist = bestDist;
                bestDist = d;
                bestId = e.getKey();
            } else if (d < secondDist) {
                secondDist = d;
            }
        }
        if (bestDist > ACCEPT_MAX) return new Result(Verdict.NOT_RECOGNISED, null, bestDist);
        if (secondDist - bestDist < AMBIGUITY_MARGIN && secondDist <= ACCEPT_MAX + AMBIGUITY_MARGIN) {
            return new Result(Verdict.AMBIGUOUS, null, bestDist);
        }
        return new Result(bestDist <= CONFIDENT_MAX ? Verdict.CONFIDENT : Verdict.WEAK, bestId, bestDist);
    }

    public static double distance(double[] a, double[] b) {
        double s = 0;
        for (int i = 0; i < a.length; i++) {
            double d = a[i] - b[i];
            s += d * d;
        }
        return Math.sqrt(s);
    }
}

package com.arudra.crm.service;

import java.util.Map;

/**
 * Turns per-employee fingerprint match scores into a decision. Pure logic, no Spring.
 *
 * SourceAFIS gives a similarity score per comparison, higher is closer; the false-match rate of one
 * comparison falls roughly tenfold for every 10 points (40 is about 0.01%). Identification compares a
 * finger with every enrolled template, so the risk multiplies by how many there are; the defaults are
 * therefore stricter than the library's "40": a score of {@link #ACCEPT_MIN} still records the punch
 * but sends it to HR, and only {@link #CONFIDENT_MIN} or more is trusted outright. These are starting
 * values to be calibrated with real scans from the chosen sensor.
 */
public final class FingerprintPolicy {

    public static final double ACCEPT_MIN = 50;
    public static final double CONFIDENT_MIN = 70;
    /** If another employee scores within this of the best (and at least ACCEPT_MIN), refuse rather than guess. */
    public static final double AMBIGUITY_MARGIN = 15;

    private FingerprintPolicy() {}

    public enum Verdict { CONFIDENT, WEAK, NOT_RECOGNISED, AMBIGUOUS }

    public record Decision(Verdict verdict, Long employeeId, double score) {
        public boolean matched() {
            return verdict == Verdict.CONFIDENT || verdict == Verdict.WEAK;
        }
    }

    /** @param bestPerEmployee each employee's best score against the probe */
    public static Decision decide(Map<Long, Double> bestPerEmployee) {
        long bestId = -1;
        double best = 0;
        double second = 0;
        for (Map.Entry<Long, Double> e : bestPerEmployee.entrySet()) {
            double s = e.getValue();
            if (s > best) {
                second = best;
                best = s;
                bestId = e.getKey();
            } else if (s > second) {
                second = s;
            }
        }
        if (bestId < 0 || best < ACCEPT_MIN) return new Decision(Verdict.NOT_RECOGNISED, null, best);
        if (second >= ACCEPT_MIN && best - second < AMBIGUITY_MARGIN) return new Decision(Verdict.AMBIGUOUS, null, best);
        return new Decision(best >= CONFIDENT_MIN ? Verdict.CONFIDENT : Verdict.WEAK, bestId, best);
    }
}

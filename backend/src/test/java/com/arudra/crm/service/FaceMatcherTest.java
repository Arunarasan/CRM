package com.arudra.crm.service;

import com.arudra.crm.service.FaceMatcher.Sample;
import com.arudra.crm.service.FaceMatcher.Verdict;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FaceMatcherTest {

    /** A 128-number vector: `base` everywhere, first value nudged by `shift`. Distance between two of them = |shift diff|. */
    private static double[] vec(double base, double shift) {
        double[] v = new double[128];
        java.util.Arrays.fill(v, base);
        v[0] = base + shift;
        return v;
    }

    @Test
    void closeFaceIsConfident() {
        var r = FaceMatcher.identify(vec(0.1, 0.10), List.of(new Sample(1, vec(0.1, 0)), new Sample(2, vec(-0.5, 0))));
        assertEquals(Verdict.CONFIDENT, r.verdict());
        assertEquals(1L, r.employeeId());
        assertEquals(0.10, r.distance(), 1e-9);
    }

    @Test
    void borderlineFaceIsAcceptedButWeak() {
        var r = FaceMatcher.identify(vec(0.1, 0.52), List.of(new Sample(1, vec(0.1, 0)), new Sample(2, vec(-0.5, 0))));
        assertEquals(Verdict.WEAK, r.verdict());
        assertEquals(1L, r.employeeId());
    }

    @Test
    void farFaceIsNotRecognised() {
        var r = FaceMatcher.identify(vec(0.1, 0.9), List.of(new Sample(1, vec(0.1, 0)), new Sample(2, vec(-0.5, 0))));
        assertEquals(Verdict.NOT_RECOGNISED, r.verdict());
        assertNull(r.employeeId());
        assertFalse(r.matched());
    }

    @Test
    void twoEmployeesAlmostEquallyCloseIsAmbiguous() {
        // live is 0.30 from employee 1 and 0.32 from employee 2: too close to call
        var r = FaceMatcher.identify(vec(0.1, 0.30), List.of(new Sample(1, vec(0.1, 0)), new Sample(2, vec(0.1, 0.62))));
        assertEquals(Verdict.AMBIGUOUS, r.verdict());
        assertFalse(r.matched());
    }

    @Test
    void bestOfAnEmployeesSamplesIsUsed() {
        // employee 1 has a far sample and a near one; the near one decides
        var r = FaceMatcher.identify(vec(0.1, 0.05),
                List.of(new Sample(1, vec(0.1, 0.9)), new Sample(1, vec(0.1, 0.0)), new Sample(2, vec(-0.5, 0))));
        assertEquals(Verdict.CONFIDENT, r.verdict());
        assertEquals(1L, r.employeeId());
    }

    @Test
    void nobodyEnrolledIsNotRecognised() {
        assertEquals(Verdict.NOT_RECOGNISED, FaceMatcher.identify(vec(0.1, 0), List.of()).verdict());
    }
}

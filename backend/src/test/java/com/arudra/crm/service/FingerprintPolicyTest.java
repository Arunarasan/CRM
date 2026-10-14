package com.arudra.crm.service;

import com.arudra.crm.service.FingerprintPolicy.Verdict;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class FingerprintPolicyTest {

    @Test
    void highScoreIsConfident() {
        var d = FingerprintPolicy.decide(Map.of(1L, 120.0, 2L, 3.0));
        assertEquals(Verdict.CONFIDENT, d.verdict());
        assertEquals(1L, d.employeeId());
    }

    @Test
    void middleScoreIsAcceptedButWeak() {
        var d = FingerprintPolicy.decide(Map.of(1L, 55.0, 2L, 3.0));
        assertEquals(Verdict.WEAK, d.verdict());
        assertEquals(1L, d.employeeId());
    }

    @Test
    void lowScoreIsNotRecognised() {
        var d = FingerprintPolicy.decide(Map.of(1L, 30.0, 2L, 12.0));
        assertEquals(Verdict.NOT_RECOGNISED, d.verdict());
        assertNull(d.employeeId());
    }

    @Test
    void twoCloseHighScoresAreAmbiguous() {
        var d = FingerprintPolicy.decide(Map.of(1L, 90.0, 2L, 80.0));
        assertEquals(Verdict.AMBIGUOUS, d.verdict());
        assertFalse(d.matched());
    }

    @Test
    void aClearWinnerBeatsAnOkRunnerUp() {
        var d = FingerprintPolicy.decide(Map.of(1L, 140.0, 2L, 55.0));
        assertEquals(Verdict.CONFIDENT, d.verdict());
    }

    @Test
    void nobodyEnrolledIsNotRecognised() {
        assertEquals(Verdict.NOT_RECOGNISED, FingerprintPolicy.decide(Map.of()).verdict());
    }
}

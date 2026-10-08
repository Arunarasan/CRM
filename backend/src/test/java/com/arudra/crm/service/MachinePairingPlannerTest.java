package com.arudra.crm.service;

import com.arudra.crm.service.MachinePairingPlanner.Outcome;
import com.arudra.crm.service.MachinePairingPlanner.P;
import com.arudra.crm.service.MachinePairingPlanner.Plan;
import com.arudra.crm.service.MachinePairingPlanner.SessionPlan;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Fingerprint-machine pairing rules: alternation, double taps, missing clock-out, night shift, In/Out keys. */
class MachinePairingPlannerTest {

    private static final LocalDate D1 = LocalDate.of(2026, 10, 5);
    private static final LocalDate D2 = D1.plusDays(1);
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 9);

    private final List<P> punches = new ArrayList<>();
    private long nextId = 1;

    private P punch(LocalDate day, int h, int m, int s) {
        return punch(day, h, m, s, null, false);
    }

    private P punch(LocalDate day, int h, int m, int s, Integer status, boolean keys) {
        P p = new P(nextId++, LocalDateTime.of(day, LocalTime.of(h, m, s)), status, keys);
        punches.add(p);
        return p;
    }

    private Plan plan(LocalDate from, LocalDate to, LocalDate today) {
        return MachinePairingPlanner.plan(punches, from, to, today, 120, 12);
    }

    private static void session(SessionPlan s, String in, String out) {
        assertEquals(LocalTime.parse(in), s.in(), "in");
        assertEquals(out == null ? null : LocalTime.parse(out), s.out(), "out");
    }

    @Test
    void alternatesInOutAcrossTheDay() {
        punch(D1, 9, 0, 0); punch(D1, 13, 0, 0); punch(D1, 14, 0, 0); punch(D1, 18, 0, 0);
        List<SessionPlan> s = plan(D1, D1, TODAY).sessions().get(D1);
        assertEquals(2, s.size());
        session(s.get(0), "09:00", "13:00");
        session(s.get(1), "14:00", "18:00");
        assertFalse(s.get(1).missingOut());
    }

    @Test
    void doubleTapWithinTwoMinutesIsIgnored() {
        punch(D1, 9, 0, 0);
        P tap = punch(D1, 9, 1, 30);
        punch(D1, 18, 0, 0);
        Plan p = plan(D1, D1, TODAY);
        assertEquals(Outcome.DUPLICATE_TAP, p.outcomes().get(tap.id()));
        assertEquals(1, p.sessions().get(D1).size());
        session(p.sessions().get(D1).get(0), "09:00", "18:00");
    }

    @Test
    void forgottenClockOutOnAPastDayIsFlaggedButTodayIsStillAtWork() {
        punch(D1, 9, 0, 0);
        SessionPlan past = plan(D1, D1, TODAY).sessions().get(D1).get(0);
        assertNull(past.out());
        assertTrue(past.missingOut());

        SessionPlan running = plan(D1, D1, D1).sessions().get(D1).get(0);
        assertNull(running.out());
        assertFalse(running.missingOut());
    }

    @Test
    void forgottenClockOutIsNotPairedWithNextMorning() {
        punch(D1, 9, 0, 0);            // forgot to punch out
        punch(D2, 9, 0, 0); punch(D2, 18, 0, 0);
        Plan p = plan(D1, D2, TODAY);
        assertTrue(p.sessions().get(D1).get(0).missingOut());
        assertEquals(1, p.sessions().get(D2).size());
        session(p.sessions().get(D2).get(0), "09:00", "18:00");
    }

    @Test
    void nightShiftIsSplitAtMidnight() {
        punch(D1, 20, 0, 0);
        punch(D2, 5, 0, 0);
        punch(D2, 20, 0, 0);           // next night starts
        Plan p = plan(D1, D2, TODAY);
        List<SessionPlan> d1 = p.sessions().get(D1);
        assertEquals(1, d1.size());
        session(d1.get(0), "20:00", "23:59:59");
        assertTrue(d1.get(0).toNextDay());
        List<SessionPlan> d2 = p.sessions().get(D2);
        assertEquals(2, d2.size());
        session(d2.get(0), "00:00", "05:00");
        assertTrue(d2.get(0).fromPreviousDay());
        assertNull(d2.get(1).out());   // 20:00 still open — next day's punch isn't loaded
    }

    @Test
    void lateEveningForgottenOutBeyondShiftLimitIsNotANightShift() {
        punch(D1, 17, 0, 0);           // forgot out at 18:00
        punch(D2, 8, 30, 0);           // 15.5 h later — more than the 12 h limit
        punch(D2, 18, 0, 0);
        Plan p = plan(D1, D2, TODAY);
        assertTrue(p.sessions().get(D1).get(0).missingOut());
        session(p.sessions().get(D2).get(0), "08:30", "18:00");
    }

    @Test
    void lateArrivingPunchesProduceTheSameResult() {
        // Punches can arrive out of order after an internet outage; the plan only depends on the set.
        P a = punch(D1, 18, 0, 0);
        P b = punch(D1, 9, 0, 0);
        List<SessionPlan> s = plan(D1, D1, TODAY).sessions().get(D1);
        assertEquals(1, s.size());
        session(s.get(0), "09:00", "18:00");
        assertEquals(b.id(), s.get(0).inPunch().id());
        assertEquals(a.id(), s.get(0).outPunch().id());
    }

    @Test
    void inOutKeysWhenTheMachineUsesThem() {
        punch(D1, 9, 0, 0, 0, true);    // in
        punch(D1, 12, 0, 0, 0, true);   // in again — morning one never got an out
        punch(D1, 17, 0, 0, 1, true);   // out
        P orphan = punch(D1, 17, 30, 0, 1, true); // out with nothing open
        Plan p = plan(D1, D1, TODAY);
        List<SessionPlan> s = p.sessions().get(D1);
        assertEquals(2, s.size());
        session(s.get(0), "09:00", null);
        assertTrue(s.get(0).missingOut());
        session(s.get(1), "12:00", "17:00");
        assertEquals(Outcome.IGNORED, p.outcomes().get(orphan.id()));
    }

    @Test
    void emptyDayPlansNothing() {
        assertTrue(plan(D1, D1, TODAY).sessions().get(D1).isEmpty());
    }
}

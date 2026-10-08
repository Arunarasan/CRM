package com.arudra.crm.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/** ADMS ATTLOG parsing across the firmware variations seen in the field. */
class AdmsParserTest {

    @Test
    void parsesStandardTabSeparatedLines() {
        AdmsParser.Result r = AdmsParser.parseAttLog(
                "1023\t2026-10-09 09:02:11\t0\t1\t0\t0\t0\t0\t0\t0\n"
                        + "1045\t2026-10-09 18:30:00\t1\t15\t\t0\n");
        assertEquals(2, r.punches().size());
        assertEquals(0, r.skippedLines());
        AdmsParser.Punch p = r.punches().get(0);
        assertEquals("1023", p.pin());
        assertEquals(LocalDateTime.of(2026, 10, 9, 9, 2, 11), p.time());
        assertEquals(0, p.status());
        assertEquals(1, p.verify());
        assertEquals(15, r.punches().get(1).verify());
        assertNull(r.punches().get(1).workCode());
    }

    @Test
    void toleratesCrlfMissingFieldsAndSpaces() {
        AdmsParser.Result r = AdmsParser.parseAttLog(
                "7\t2026-10-09 09:00:00\r\n"            // only PIN + time
                        + "  8 2026-10-09 09:05:00 0 1  \r\n" // space separated
                        + "\r\n");
        assertEquals(2, r.punches().size());
        assertNull(r.punches().get(0).status());
        assertEquals("8", r.punches().get(1).pin());
        assertEquals(LocalDateTime.of(2026, 10, 9, 9, 5), r.punches().get(1).time());
        assertEquals(1, r.punches().get(1).verify());
    }

    @Test
    void skipsUnreadableLinesWithoutFailingTheBatch() {
        AdmsParser.Result r = AdmsParser.parseAttLog(
                "garbage\n"
                        + "1023\tnot-a-date\t0\t1\n"
                        + "bad pin!\t2026-10-09 09:00:00\n"
                        + "1023\t2026-10-09 09:02:11\t0\t1\n");
        assertEquals(1, r.punches().size());
        assertEquals(3, r.skippedLines());
    }

    @Test
    void emptyBodyAndLineCount() {
        assertTrue(AdmsParser.parseAttLog(null).punches().isEmpty());
        assertTrue(AdmsParser.parseAttLog("  \n").punches().isEmpty());
        assertEquals(2, AdmsParser.countLines("USER PIN=1\tName=A\nFP PIN=1\tFID=0\n\n"));
    }
}

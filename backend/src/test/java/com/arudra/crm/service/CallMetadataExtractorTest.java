package com.arudra.crm.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class CallMetadataExtractorTest {

    private static CallMetadataExtractor.CallMeta p(String name) {
        return CallMetadataExtractor.parse(name);
    }

    @Test
    void callRecorderAppStyle() {
        var m = p("Call@+919876543210_20261004_143022.m4a");
        assertEquals("+919876543210", m.phoneNumber());
        assertEquals(LocalDateTime.of(2026, 10, 4, 14, 30, 22), m.calledAt());
    }

    @Test
    void samsungContactNameAndShortDate() {
        var m = p("Call recording Roshan_241004_143022.m4a");
        assertNull(m.phoneNumber());
        assertEquals(LocalDateTime.of(2024, 10, 4, 14, 30, 22), m.calledAt());
        assertEquals("Roshan", m.contactName());
    }

    @Test
    void spacedNumberAndCompactTimestamp() {
        var m = p("+91 98765 43210_20261004143022.amr");
        assertEquals("+919876543210", m.phoneNumber());
        assertEquals(LocalDateTime.of(2026, 10, 4, 14, 30, 22), m.calledAt());
    }

    @Test
    void dashedDateTime() {
        var m = p("9876543210-2026-10-04-14-30-22.mp3");
        assertEquals("+919876543210", m.phoneNumber());
        assertEquals(LocalDateTime.of(2026, 10, 4, 14, 30, 22), m.calledAt());
    }

    @Test
    void dayFirstDateWithNameAndNumber() {
        var m = p("Roshan (9876543210) - 04-10-2026 14-30.m4a");
        assertEquals("+919876543210", m.phoneNumber());
        assertEquals(LocalDateTime.of(2026, 10, 4, 14, 30, 0), m.calledAt());
        assertEquals("Roshan", m.contactName());
    }

    @Test
    void realmeStyleNumberDashTenDigitTime() {
        var m = p("+919344693633-2009261923.m4a");
        assertEquals("+919344693633", m.phoneNumber());
        assertEquals(LocalDateTime.of(2026, 9, 20, 19, 23, 0), m.calledAt());
        assertNull(m.contactName());
    }

    @Test
    void directionFromName() {
        assertEquals("IN", p("incoming_9876543210_20261004_143022.mp3").direction());
        assertEquals("OUT", p("outgoing_9876543210_20261004_143022.mp3").direction());
    }

    @Test
    void nothingRecognisable() {
        var m = p("recording.m4a");
        assertNull(m.phoneNumber());
        assertNull(m.calledAt());
        assertNull(m.contactName());
    }

    @Test
    void normalisesNumbers() {
        assertEquals("+919876543210", CallMetadataExtractor.normalizePhone("09876543210"));
        assertEquals("+919876543210", CallMetadataExtractor.normalizePhone("98765-43210"));
        assertEquals("9876543210", CallMetadataExtractor.last10("+91 98765 43210"));
    }
}

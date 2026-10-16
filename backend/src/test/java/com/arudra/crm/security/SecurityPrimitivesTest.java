package com.arudra.crm.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class SecurityPrimitivesTest {

    private static PiiCryptoConverter converter() {
        byte[] key = new byte[32];
        new java.security.SecureRandom().nextBytes(key);
        return new PiiCryptoConverter(Base64.getEncoder().encodeToString(key), new MockEnvironment());
    }

    @Test
    void piiRoundTripsAndIsNotPlainText() {
        PiiCryptoConverter c = converter();
        String stored = c.convertToDatabaseColumn("123456789012");
        assertTrue(stored.startsWith("enc:v1:"));
        assertFalse(stored.contains("123456789012"));
        assertEquals("123456789012", c.convertToEntityAttribute(stored));
        assertNotEquals(stored, c.convertToDatabaseColumn("123456789012")); // random IV
    }

    @Test
    void legacyPlainValuesStillRead() {
        assertEquals("ABCDE1234F", converter().convertToEntityAttribute("ABCDE1234F"));
    }

    @Test
    void maskKeepsLastFourAndMaskedEchoKeepsStoredValue() {
        assertEquals("••••••••9012", Pii.mask("123456789012"));
        assertTrue(Pii.isMasked(Pii.mask("ABCDE1234F")));
        assertEquals("REAL", Pii.keep(Pii.mask("REAL-0000"), "REAL"));
        assertEquals("NEW", Pii.keep("NEW", "REAL"));
    }

    @Test
    void passwordPolicy() {
        assertNotNull(PasswordPolicy.validate("short", null));
        assertNotNull(PasswordPolicy.validate("password123", null));
        assertNotNull(PasswordPolicy.validate("aaaaaaaaaaaa", null));
        assertNotNull(PasswordPolicy.validate("johnsmith-2026", "johnsmith@x.com"));
        assertNull(PasswordPolicy.validate("Blue-Harbor-7731", "a@b.com"));
        assertEquals(14, PasswordPolicy.generateTemporary().length());
    }

    @Test
    void lockoutGrowsAndCaps() {
        assertEquals(30, CustomUserDetailsService.lockDuration(5).toSeconds());
        assertEquals(30, CustomUserDetailsService.lockDuration(500).toSeconds());
        assertFalse(CustomUserDetailsService.shouldLock(4));
        assertTrue(CustomUserDetailsService.shouldLock(5));
        assertFalse(CustomUserDetailsService.shouldLock(7));
        assertTrue(CustomUserDetailsService.shouldLock(8));
        assertTrue(CustomUserDetailsService.shouldLock(11));
    }
}

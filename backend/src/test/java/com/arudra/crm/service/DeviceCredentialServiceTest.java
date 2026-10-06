package com.arudra.crm.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DeviceCredentialServiceTest {

    private final DeviceCredentialService svc = new DeviceCredentialService("unit-test-secret-unit-test-secret-0123456789", 900);

    @Test
    void secretsAreRandomAndOnlyHashesAreCompared() {
        String a = svc.newSecret(), b = svc.newSecret();
        assertNotEquals(a, b);
        assertTrue(a.length() >= 43);
        String hash = svc.hash(a);
        assertNotEquals(a, hash);
        assertTrue(svc.matches(a, hash));
        assertFalse(svc.matches(b, hash));
        assertFalse(svc.matches(null, hash));
        assertFalse(svc.matches(a, null));
    }

    @Test
    void pairingCodesAreTypeableAndNormalised() {
        String code = svc.newPairingCode();
        assertTrue(code.matches("[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}"), code);
        assertEquals(code.replace("-", ""), DeviceCredentialService.normalizePairingCode(" " + code.toLowerCase() + " "));
    }

    @Test
    void tokenRoundTripsDeviceIdentityAndCredentialVersion() {
        String token = svc.issueToken(7L, "uuid-0000-1111-2222", 3);
        var claims = svc.parseToken(token);
        assertEquals(7L, claims.deviceId());
        assertEquals("uuid-0000-1111-2222", claims.deviceUuid());
        assertEquals(3, claims.credentialVersion());
    }

    @Test
    void tokenFromAnotherKeyOrTamperedIsRejected() {
        DeviceCredentialService other = new DeviceCredentialService("a-completely-different-secret-value-xyz-12345", 900);
        String foreign = other.issueToken(7L, "uuid", 1);
        assertThrows(Exception.class, () -> svc.parseToken(foreign));
        String token = svc.issueToken(7L, "uuid", 1);
        String tampered = token.substring(0, token.length() - 2) + (token.endsWith("A") ? "BB" : "AA");
        assertThrows(Exception.class, () -> svc.parseToken(tampered));
    }

    @Test
    void userJwtIsNotAcceptedAsDeviceToken() {
        // A token with the right key but without typ=attendance-device must be refused.
        String userLike = io.jsonwebtoken.Jwts.builder().setSubject("device:1")
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(new byte[32]), io.jsonwebtoken.SignatureAlgorithm.HS256)
                .compact();
        assertThrows(Exception.class, () -> svc.parseToken(userLike));
    }
}

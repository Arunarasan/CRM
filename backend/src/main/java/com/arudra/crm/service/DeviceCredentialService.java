package com.arudra.crm.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;

/**
 * Secrets and short-lived tokens for attendance terminals.
 *
 *  - Device secret: 256 random bits, base64url. Only its SHA-256 is stored (the secret is high-entropy,
 *    so a slow password hash adds nothing); comparisons are constant-time.
 *  - Device access token: an HS256 JWT signed with a key that is domain-separated from the user JWT key,
 *    so a user token can never be replayed as a device token or vice-versa. Claims: sub=device:{id},
 *    typ=attendance-device, did={uuid}, cv={credential version}. Lifetime is short (default 15 min).
 */
@Service
public class DeviceCredentialService {

    public static final String TOKEN_TYPE = "attendance-device";

    private static final SecureRandom RANDOM = new SecureRandom();
    /** Unambiguous upper-case alphabet for codes a person types (no 0/O, 1/I/L). */
    private static final char[] CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();

    private final Key signingKey;
    private final long tokenTtlMillis;

    public DeviceCredentialService(
            @Value("${app.attendance.device.token-secret:${jwt.secret}}") String secret,
            @Value("${app.attendance.device.token-ttl-seconds:900}") long tokenTtlSeconds) {
        this.signingKey = Keys.hmacShaKeyFor(sha256Bytes("arudracs-attendance-device-token|" + secret));
        this.tokenTtlMillis = Math.max(60, tokenTtlSeconds) * 1000L;
    }

    public String newSecret() {
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /** Human-typeable one-time code, e.g. "K7QM-2XRP". ~40 bits; short-lived and rate-limited. */
    public String newPairingCode() {
        StringBuilder sb = new StringBuilder(9);
        for (int i = 0; i < 8; i++) {
            if (i == 4) sb.append('-');
            sb.append(CODE_ALPHABET[RANDOM.nextInt(CODE_ALPHABET.length)]);
        }
        return sb.toString();
    }

    public static String normalizePairingCode(String code) {
        return code == null ? "" : code.replaceAll("[^A-Za-z0-9]", "").toUpperCase(java.util.Locale.ROOT);
    }

    public String hash(String value) {
        return HexFormat.of().formatHex(sha256Bytes(value == null ? "" : value));
    }

    /** Constant-time comparison of a presented secret against a stored hash. */
    public boolean matches(String presented, String storedHash) {
        if (presented == null || storedHash == null) return false;
        byte[] a = hash(presented).getBytes(StandardCharsets.US_ASCII);
        byte[] b = storedHash.getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(a, b);
    }

    public long tokenTtlSeconds() {
        return tokenTtlMillis / 1000L;
    }

    public String issueToken(Long deviceId, String deviceUuid, int credentialVersion) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject("device:" + deviceId)
                .claim("typ", TOKEN_TYPE)
                .claim("did", deviceUuid)
                .claim("cv", credentialVersion)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + tokenTtlMillis))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    /** Parsed, signature- and expiry-checked claims of a device token. */
    public record DeviceTokenClaims(Long deviceId, String deviceUuid, int credentialVersion) {}

    /** @throws io.jsonwebtoken.JwtException / IllegalArgumentException when invalid or expired. */
    public DeviceTokenClaims parseToken(String token) {
        Claims c = Jwts.parserBuilder().setSigningKey(signingKey).build().parseClaimsJws(token).getBody();
        if (!TOKEN_TYPE.equals(c.get("typ", String.class))) throw new IllegalArgumentException("Not a device token.");
        String sub = c.getSubject();
        if (sub == null || !sub.startsWith("device:")) throw new IllegalArgumentException("Bad subject.");
        Number cv = c.get("cv", Number.class);
        return new DeviceTokenClaims(Long.valueOf(sub.substring("device:".length())), c.get("did", String.class),
                cv == null ? -1 : cv.intValue());
    }

    private static byte[] sha256Bytes(String s) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

package com.arudra.crm.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encrypts identity/bank number columns at rest with AES-256-GCM ({@code PII_ENCRYPTION_KEY}).
 * Stored form: {@code enc:v1:<base64(iv | ciphertext+tag)>}. Values without that prefix are read
 * as-is (rows written before encryption; {@code PiiEncryptionBackfill} converts them on start-up).
 *
 * <p>Prod refuses to start without a valid key. Elsewhere a missing key leaves values in plain text
 * (with a warning) so local development keeps working.
 */
@Component
@Converter
public class PiiCryptoConverter implements AttributeConverter<String, String> {

    private static final Logger log = LoggerFactory.getLogger(PiiCryptoConverter.class);
    public static final String PREFIX = "enc:v1:";
    private static final SecureRandom RANDOM = new SecureRandom();

    // Static: Hibernate may create its own converter instance; all share the key Spring configured.
    private static volatile SecretKeySpec key;

    /** Hibernate's no-arg construction path. */
    public PiiCryptoConverter() {}

    @org.springframework.beans.factory.annotation.Autowired
    public PiiCryptoConverter(@Value("${app.pii.encryption-key:}") String keyBase64, Environment environment) {
        boolean prod = environment.acceptsProfiles(Profiles.of("prod"));
        if (keyBase64 == null || keyBase64.isBlank()) {
            if (prod) {
                throw new IllegalStateException("PII_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
            }
            log.warn("PII_ENCRYPTION_KEY not set — Aadhaar/PAN/bank fields are stored in PLAIN TEXT (dev only).");
            return;
        }
        byte[] raw = Base64.getDecoder().decode(keyBase64.trim());
        if (raw.length != 32) throw new IllegalStateException("PII_ENCRYPTION_KEY must be base64 of 32 bytes");
        key = new SecretKeySpec(raw, "AES");
    }

    public static boolean enabled() {
        return key != null;
    }

    @Override
    public String convertToDatabaseColumn(String value) {
        if (value == null || value.isEmpty() || key == null || value.startsWith(PREFIX)) return value;
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(ByteBuffer.allocate(12 + ct.length).put(iv).put(ct).array());
        } catch (Exception e) {
            throw new IllegalStateException("PII encryption failed", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String stored) {
        if (stored == null || !stored.startsWith(PREFIX)) return stored;
        if (key == null) throw new IllegalStateException("Encrypted PII found but PII_ENCRYPTION_KEY is not set");
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, 12));
            return new String(c.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("PII decryption failed (wrong PII_ENCRYPTION_KEY?)", e);
        }
    }
}

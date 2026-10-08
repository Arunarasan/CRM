package com.arudra.crm.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/** Device-key crypto: SPKI parsing and ECDSA verification in both WebCrypto (r||s) and DER forms. */
class DeviceBindingCryptoTest {

    private static KeyPair p256() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        return g.generateKeyPair();
    }

    private static String sign(KeyPair kp, String alg, String nonce) throws Exception {
        Signature s = Signature.getInstance(alg);
        s.initSign(kp.getPrivate());
        s.update(nonce.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.sign());
    }

    @Test
    void verifiesWebCryptoRawAndDerSignatures() throws Exception {
        KeyPair kp = p256();
        PublicKey key = DeviceBindingService.parsePublicKey(Base64.getEncoder().encodeToString(kp.getPublic().getEncoded()));
        String nonce = "abc_DEF-123";

        assertTrue(DeviceBindingService.verifySignature(key, nonce, sign(kp, "SHA256withECDSAinP1363Format", nonce)));
        assertTrue(DeviceBindingService.verifySignature(key, nonce, sign(kp, "SHA256withECDSA", nonce)));
        assertFalse(DeviceBindingService.verifySignature(key, "other", sign(kp, "SHA256withECDSAinP1363Format", nonce)));
        assertFalse(DeviceBindingService.verifySignature(key, nonce, "not-a-signature"));
    }

    @Test
    void rejectsWrongKeyAndNonP256() throws Exception {
        KeyPair a = p256(), b = p256();
        PublicKey keyB = DeviceBindingService.parsePublicKey(Base64.getUrlEncoder().encodeToString(b.getPublic().getEncoded()));
        assertFalse(DeviceBindingService.verifySignature(keyB, "n", sign(a, "SHA256withECDSAinP1363Format", "n")));

        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp384r1"));
        String p384 = Base64.getEncoder().encodeToString(g.generateKeyPair().getPublic().getEncoded());
        assertThrows(IllegalArgumentException.class, () -> DeviceBindingService.parsePublicKey(p384));
        assertThrows(IllegalArgumentException.class, () -> DeviceBindingService.parsePublicKey("garbage"));
    }

    @Test
    void labelsFromUserAgent() {
        assertEquals("Android · Chrome", DeviceBindingService.labelOf(
                "Mozilla/5.0 (Linux; Android 14; 23021RAA2Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"));
        assertEquals("iOS · Safari", DeviceBindingService.labelOf(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"));
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeWebauthnCredential;
import com.arudra.crm.repository.EmployeeWebauthnCredentialRepository;
import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.authenticator.Authenticator;
import com.webauthn4j.authenticator.AuthenticatorImpl;
import com.webauthn4j.converter.AttestedCredentialDataConverter;
import com.webauthn4j.converter.util.ObjectConverter;
import com.webauthn4j.data.*;
import com.webauthn4j.data.attestation.authenticator.AttestedCredentialData;
import com.webauthn4j.data.client.Origin;
import com.webauthn4j.data.client.challenge.Challenge;
import com.webauthn4j.data.client.challenge.DefaultChallenge;
import com.webauthn4j.server.ServerProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebAuthn (platform biometric / passkey) for attendance clock-in verification. Handles the two
 * ceremonies — registering a device's authenticator against an employee, and verifying an assertion
 * at clock-in — using webauthn4j for parsing and signature validation.
 *
 * Challenges are held in-memory per employee for a short window between the "options" and
 * "verify" calls. This is single-instance state; a multi-node deployment would need shared storage.
 */
@Service
public class WebAuthnService {

    private static final Logger log = LoggerFactory.getLogger(WebAuthnService.class);
    private static final long CHALLENGE_TTL_MS = 5 * 60 * 1000L;

    // Fallbacks only. The effective rp-id / origin are normally derived from the request's Origin
    // header so WebAuthn works on whatever host actually serves the portal (see resolve()).
    @Value("${app.webauthn.rp-id:localhost}") private String rpId;
    @Value("${app.webauthn.rp-name:Arudra CRM}") private String rpName;
    @Value("${app.webauthn.origin:http://localhost:5173}") private String origin;

    @Autowired private EmployeeWebauthnCredentialRepository credentialRepository;

    private final WebAuthnManager webAuthnManager = WebAuthnManager.createNonStrictWebAuthnManager();
    private final ObjectConverter objectConverter = new ObjectConverter();
    private final AttestedCredentialDataConverter attestedCredentialDataConverter =
            new AttestedCredentialDataConverter(objectConverter);
    private final SecureRandom random = new SecureRandom();

    /** Pending challenge per employee (register or assert). Carries the origin/rpId the options were
     *  issued for, so the matching verify uses exactly those values. */
    private final Map<Long, ChallengeEntry> challenges = new ConcurrentHashMap<>();

    private record ChallengeEntry(byte[] challenge, String origin, String rpId, long issuedAt) {}

    // --- base64url helpers -------------------------------------------------
    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64URL_DEC = Base64.getUrlDecoder();
    private static String enc(byte[] b) { return B64URL.encodeToString(b); }
    private static byte[] dec(String s) { return B64URL_DEC.decode(s); }

    // --- registration ------------------------------------------------------

    /** Options for navigator.credentials.create — all binary fields are base64url strings. */
    public Map<String, Object> registrationOptions(Employee emp, String originHeader) {
        String[] res = resolve(originHeader);
        byte[] challenge = newChallenge(emp.getId(), res[0], res[1]);

        Map<String, Object> rp = new LinkedHashMap<>();
        rp.put("id", res[1]);
        rp.put("name", rpName);

        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", enc(String.valueOf(emp.getId()).getBytes()));
        user.put("name", emp.getEmail() != null ? emp.getEmail() : ("emp-" + emp.getId()));
        user.put("displayName", (nz(emp.getFirstName()) + " " + nz(emp.getLastName())).trim());

        List<Map<String, Object>> pubKeyCredParams = List.of(
                param(-7),   // ES256
                param(-257)  // RS256
        );

        List<Map<String, Object>> exclude = new ArrayList<>();
        for (EmployeeWebauthnCredential c : credentialRepository.findByEmployeeIdAndIsDeletedFalse(emp.getId())) {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("type", "public-key");
            d.put("id", c.getCredentialId());
            exclude.add(d);
        }

        Map<String, Object> authSel = new LinkedHashMap<>();
        authSel.put("authenticatorAttachment", "platform");
        authSel.put("userVerification", "required");
        authSel.put("residentKey", "preferred");

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("rp", rp);
        options.put("user", user);
        options.put("challenge", enc(challenge));
        options.put("pubKeyCredParams", pubKeyCredParams);
        options.put("timeout", 60_000);
        options.put("attestation", "none");
        options.put("authenticatorSelection", authSel);
        options.put("excludeCredentials", exclude);
        return options;
    }

    /**
     * Verifies a registration response and persists the new credential for the employee.
     * attestationObject / clientDataJSON are base64url strings from navigator.credentials.create.
     */
    @Transactional
    public EmployeeWebauthnCredential registerVerify(Employee emp, String attestationObjectB64,
                                                     String clientDataJSONB64, String deviceLabel) {
        ChallengeEntry entry = takeChallenge(emp.getId());
        try {
            RegistrationRequest request = new RegistrationRequest(dec(attestationObjectB64), dec(clientDataJSONB64));
            ServerProperty serverProperty = new ServerProperty(new Origin(entry.origin()), entry.rpId(), new DefaultChallenge(entry.challenge()), null);
            RegistrationParameters params = new RegistrationParameters(serverProperty, true, true);
            RegistrationData data = webAuthnManager.validate(request, params);

            AttestedCredentialData acd = data.getAttestationObject().getAuthenticatorData().getAttestedCredentialData();
            String credentialId = enc(acd.getCredentialId());
            long signCount = data.getAttestationObject().getAuthenticatorData().getSignCount();

            EmployeeWebauthnCredential cred = credentialRepository.findByCredentialIdAndIsDeletedFalse(credentialId)
                    .orElseGet(EmployeeWebauthnCredential::new);
            cred.setEmployee(emp);
            cred.setCredentialId(credentialId);
            cred.setPublicKey(enc(attestedCredentialDataConverter.convert(acd)));
            cred.setSignCount(signCount);
            cred.setDeviceLabel(deviceLabel == null || deviceLabel.isBlank() ? "Device" : deviceLabel.trim());
            cred.setAttestationType("none");
            cred.setLastUsedAt(LocalDateTime.now());
            return credentialRepository.save(cred);
        } catch (Exception e) {
            log.warn("WebAuthn registration failed for employee {}: {}", emp.getId(), e.toString());
            throw new IllegalStateException("Could not register this device. Please try again.");
        }
    }

    // --- assertion (used at clock-in) --------------------------------------

    /** Options for navigator.credentials.get — base64url challenge + the employee's credential ids. */
    public Map<String, Object> assertionOptions(Employee emp, String originHeader) {
        String[] res = resolve(originHeader);
        byte[] challenge = newChallenge(emp.getId(), res[0], res[1]);
        List<Map<String, Object>> allow = new ArrayList<>();
        for (EmployeeWebauthnCredential c : credentialRepository.findByEmployeeIdAndIsDeletedFalse(emp.getId())) {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("type", "public-key");
            d.put("id", c.getCredentialId());
            allow.add(d);
        }
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("challenge", enc(challenge));
        options.put("rpId", res[1]);
        options.put("timeout", 60_000);
        options.put("userVerification", "required");
        options.put("allowCredentials", allow);
        return options;
    }

    /**
     * Verifies an assertion for the employee. Returns true only when it validates against a stored
     * credential owned by the employee and the pending challenge. Never throws — a failed/absent
     * assertion returns false so the caller can flag the clock-in rather than error out.
     * All fields are base64url strings from navigator.credentials.get.
     */
    @Transactional
    public boolean verifyAssertion(Employee emp, String credentialIdB64, String authenticatorDataB64,
                                   String clientDataJSONB64, String signatureB64, String userHandleB64) {
        if (credentialIdB64 == null || authenticatorDataB64 == null || clientDataJSONB64 == null || signatureB64 == null) {
            return false;
        }
        ChallengeEntry entry = challenges.get(emp.getId());
        if (entry == null || expired(entry)) { challenges.remove(emp.getId()); return false; }

        EmployeeWebauthnCredential cred = credentialRepository.findByCredentialIdAndIsDeletedFalse(credentialIdB64).orElse(null);
        if (cred == null || cred.getEmployee() == null || !emp.getId().equals(cred.getEmployee().getId())) {
            return false;
        }
        try {
            AttestedCredentialData acd = attestedCredentialDataConverter.convert(dec(cred.getPublicKey()));
            Authenticator authenticator = new AuthenticatorImpl(acd, null, cred.getSignCount());

            AuthenticationRequest request = new AuthenticationRequest(
                    dec(credentialIdB64),
                    userHandleB64 == null ? null : dec(userHandleB64),
                    dec(authenticatorDataB64),
                    dec(clientDataJSONB64),
                    dec(signatureB64));
            ServerProperty serverProperty = new ServerProperty(new Origin(entry.origin()), entry.rpId(), new DefaultChallenge(entry.challenge()), null);
            AuthenticationParameters params = new AuthenticationParameters(serverProperty, authenticator, null, true, true);

            AuthenticationData data = webAuthnManager.validate(request, params);

            cred.setSignCount(data.getAuthenticatorData().getSignCount());
            cred.setLastUsedAt(LocalDateTime.now());
            credentialRepository.save(cred);
            challenges.remove(emp.getId());
            return true;
        } catch (Exception e) {
            log.warn("WebAuthn assertion failed for employee {}: {}", emp.getId(), e.toString());
            return false;
        }
    }

    // --- credential management --------------------------------------------

    public List<Map<String, Object>> listCredentials(Employee emp) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (EmployeeWebauthnCredential c : credentialRepository.findByEmployeeIdAndIsDeletedFalse(emp.getId())) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("deviceLabel", c.getDeviceLabel());
            m.put("lastUsedAt", c.getLastUsedAt());
            m.put("createdAt", c.getCreatedAt());
            out.add(m);
        }
        return out;
    }

    @Transactional
    public void deleteCredential(Employee emp, Long id) {
        credentialRepository.findById(id).ifPresent(c -> {
            if (c.getEmployee() != null && emp.getId().equals(c.getEmployee().getId())) {
                c.setIsDeleted(true);
                c.setDeletedAt(LocalDateTime.now());
                credentialRepository.save(c);
            }
        });
    }

    public boolean hasCredential(Employee emp) {
        return credentialRepository.existsByEmployeeIdAndIsDeletedFalse(emp.getId());
    }

    // --- helpers -----------------------------------------------------------

    private byte[] newChallenge(Long employeeId, String resolvedOrigin, String resolvedRpId) {
        byte[] c = new byte[32];
        random.nextBytes(c);
        challenges.put(employeeId, new ChallengeEntry(c, resolvedOrigin, resolvedRpId, System.currentTimeMillis()));
        return c;
    }

    private ChallengeEntry takeChallenge(Long employeeId) {
        ChallengeEntry e = challenges.remove(employeeId);
        if (e == null || expired(e)) throw new IllegalStateException("Registration expired. Please try again.");
        return e;
    }

    private static boolean expired(ChallengeEntry e) {
        return System.currentTimeMillis() - e.issuedAt() > CHALLENGE_TTL_MS;
    }

    /**
     * Resolves the effective [origin, rpId] for this ceremony. Prefers the request's Origin header
     * so WebAuthn works on whatever host serves the portal; falls back to the configured values.
     * rpId is the origin's host (WebAuthn forbids scheme/port/path in rpId, and bare IPs won't work).
     */
    private String[] resolve(String originHeader) {
        if (originHeader != null && !originHeader.isBlank() && originHeader.startsWith("http")) {
            try {
                java.net.URI uri = java.net.URI.create(originHeader.trim());
                String host = uri.getHost();
                if (host != null && !host.isBlank()) {
                    // Normalise to scheme://host[:port] with no trailing slash.
                    String o = uri.getScheme() + "://" + host + (uri.getPort() > -1 ? ":" + uri.getPort() : "");
                    return new String[]{o, host};
                }
            } catch (Exception ignored) { /* fall through to configured defaults */ }
        }
        return new String[]{origin, rpId};
    }

    private static Map<String, Object> param(int alg) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", "public-key");
        m.put("alg", alg);
        return m;
    }

    private static String nz(String s) { return s == null ? "" : s; }
}

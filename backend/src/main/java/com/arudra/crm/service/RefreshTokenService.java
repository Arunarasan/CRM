package com.arudra.crm.service;

import com.arudra.crm.entity.RefreshToken;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.RefreshTokenRepository;
import com.arudra.crm.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Refresh tokens are random 256-bit values handed to the client once; only their SHA-256 hash is
 * stored, so a database leak can't be replayed. Each refresh rotates the token (the old one stops
 * working) and keeps the original expiry, so a session can't be extended forever.
 */
@Service
@Transactional
public class RefreshTokenService {

    /** A refreshed session: the account plus the new raw refresh token for the client. */
    public record Rotation(User user, String refreshToken) {}

    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    /** Issues a new refresh token and returns the raw value (the only time it exists in clear). */
    public String createRefreshToken(Long userId, boolean rememberMe) {
        User user = userRepository.findById(userId).orElseThrow();

        // Delete existing refresh token for this user (only 1 active device allowed in this simple model)
        refreshTokenRepository.deleteByUser(user);
        refreshTokenRepository.flush();

        // 30 days for remember me, 7 days default
        long expiryMillis = rememberMe ? 30L * 24 * 60 * 60 * 1000 : 7L * 24 * 60 * 60 * 1000;
        String raw = newRawToken();
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setExpiryDate(Instant.now().plusMillis(expiryMillis));
        refreshToken.setToken(hash(raw));
        refreshTokenRepository.save(refreshToken);
        return raw;
    }

    /** Swaps a valid, unexpired refresh token for a new one; empty when it is unknown or expired. */
    public Optional<Rotation> rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        Optional<RefreshToken> found = refreshTokenRepository.findByToken(hash(rawToken));
        if (found.isEmpty()) return Optional.empty();
        RefreshToken token = found.get();
        if (token.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(token);
            return Optional.empty();
        }
        String raw = newRawToken();
        token.setToken(hash(raw));
        refreshTokenRepository.save(token);
        return Optional.of(new Rotation(token.getUser(), raw));
    }

    /** Revokes one refresh token (logout from this device). */
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        refreshTokenRepository.findByToken(hash(rawToken)).ifPresent(refreshTokenRepository::delete);
    }

    /** Revokes every refresh token the user holds (disable, delete, password reset/change, logout). */
    public void revokeAll(User user) {
        if (user == null || user.getId() == null) return;
        refreshTokenRepository.deleteByUser(user);
    }

    @Transactional
    public int deleteByUserId(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return refreshTokenRepository.deleteByUser(user);
    }

    private static String newRawToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
